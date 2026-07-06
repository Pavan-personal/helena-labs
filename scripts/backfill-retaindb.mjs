/**
 * One-shot: walks every incident in every workspace and posts it to
 * RetainDB as a `fact` memory scoped to that workspace's project. The
 * copilot's search_incidents tool now hits RetainDB first, so this seeds
 * the memory layer with historical data.
 *
 * Requires DATABASE_URL and RETAINDB_API_KEY set. Safe to re-run — RetainDB
 * treats identical content as an update, not a duplicate.
 *
 *   DATABASE_URL="postgres://..." RETAINDB_API_KEY="wsk_..." \
 *     node scripts/backfill-retaindb.mjs
 */
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const key = process.env.RETAINDB_API_KEY;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
if (!key) {
  console.error('RETAINDB_API_KEY not set');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: 'require', prepare: false });

const rows = await sql`
  select id, workspace_id, title, body, source, severity, channel, created_at
  from incidents
  order by created_at asc
`;

console.log(`Found ${rows.length} incidents to mirror`);

let ok = 0;
let failed = 0;

for (const r of rows) {
  const content =
    `[INC:${r.id}] ${r.title}\n` +
    `Severity: ${r.severity}. Source: ${r.source}.` +
    (r.channel ? ` Channel: #${r.channel}.` : '') +
    `\n${(r.body ?? '').slice(0, 2000)}`;

  try {
    const res = await fetch('https://api.retaindb.com/v1/memory', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project: r.workspace_id,
        content,
        memory_type: 'fact'
      })
    });
    if (!res.ok) {
      failed += 1;
      console.error(`  ${r.id.slice(0, 8)}: HTTP ${res.status}`);
      continue;
    }
    ok += 1;
    process.stdout.write('.');
  } catch (e) {
    failed += 1;
    console.error(`  ${r.id.slice(0, 8)}: ${e.message}`);
  }
}

console.log(`\nBackfilled ${ok} incidents, ${failed} failed`);
await sql.end();
