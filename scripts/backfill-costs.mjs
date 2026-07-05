/**
 * Recomputes cost_cents for every usage_events row that has cost_cents = 0
 * (or NULL), using the same per-model rack rates the runtime now uses at
 * write time. Run once after the pricing wiring landed:
 *
 *   pnpm dlx tsx scripts/backfill-costs.mjs   # or: node scripts/backfill-costs.mjs
 *
 * Safe to re-run; only touches rows that are still 0.
 */
import postgres from 'postgres';

const PRICING_PER_M_TOKENS = {
  'deepseek-v4-flash': { input: 0.07, output: 0.28 },
  'deepseek-v4-pro': { input: 0.27, output: 1.10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-image': { input: 0.075, output: 0.30 }
};

function estimateCostCents(model, tokensIn, tokensOut) {
  const rate = PRICING_PER_M_TOKENS[model];
  if (!rate) return 0;
  const usd = (Number(tokensIn) * rate.input + Number(tokensOut) * rate.output) / 1_000_000;
  return Math.round(usd * 100 * 10_000) / 10_000;
}

const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require' });

const rows = await sql`
  select id, model, tokens_in, tokens_out
  from usage_events
  where cost_cents = 0 or cost_cents is null
`;

console.log(`Found ${rows.length} rows to backfill`);

let updated = 0;
let skipped = 0;
for (const r of rows) {
  const cost = estimateCostCents(r.model, r.tokens_in, r.tokens_out);
  if (cost === 0) {
    skipped += 1;
    continue;
  }
  await sql`update usage_events set cost_cents = ${cost} where id = ${r.id}`;
  updated += 1;
}

console.log(`Updated ${updated} rows, skipped ${skipped} (unknown model or genuinely 0 tokens)`);
await sql.end();
