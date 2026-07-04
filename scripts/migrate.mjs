import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const DIR = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL in .env.local. Get it from Supabase Dashboard -> Settings -> Database -> Connection string -> URI');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', prepare: false, max: 1 });
  const schema = await readFile(join(DIR, 'schema.sql'), 'utf8');

  console.log('Applying schema...');
  await sql.unsafe(schema);
  console.log('Schema applied.');

  const { count } = await sql`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name in ('workspaces','incidents','runbook_drafts','runbooks','usage_events')`.then((r) => r[0]);
  console.log(`Tables present: ${count} / 5`);

  await sql.end();
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
