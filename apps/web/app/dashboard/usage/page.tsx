import { getServerClient, usageSummary, type UsageEventRow } from '@helena/db';
import { requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ROLE_COLORS: Record<string, string> = {
  vision: '#38bdf8',
  rerank: '#a3e635',
  synth: '#f472b6',
  draft: '#fb923c'
};

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o-mini': '#38bdf8',
  'gemini-2.5-flash-image': '#c084fc',
  'deepseek-v4-flash': '#a3e635',
  'deepseek-v4-pro': '#f472b6'
};

export default async function UsagePage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const usage = await usageSummary(workspace.id);

  const db = getServerClient();
  const { data: rawEvents } = await db
    .from('usage_events')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })
    .limit(2000);

  const events = (rawEvents as UsageEventRow[]) ?? [];
  const byDay = groupByDay(events);
  const totalCalls = events.length;

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Runtime
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Usage &amp; cost</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
          Every BTL call helena makes is logged with role, model, token count, and cost. Costs
          are estimated from published per-model rates, so watch the model breakdown to see how
          routing keeps the bill small.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Total calls" value={totalCalls.toLocaleString()} />
        <Stat
          label="Total spend"
          value={`$${(usage.totalCostCents / 100).toFixed(6)}`}
          hint="approximate, from published rates"
        />
        <Stat label="Input tokens" value={usage.totalTokensIn.toLocaleString()} />
        <Stat label="Output tokens" value={usage.totalTokensOut.toLocaleString()} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4">
            Calls per day, stacked by role
          </div>
          {byDay.length === 0 ? (
            <div className="text-sm text-neutral-500 text-center py-12">
              No usage yet. Run <code>/askoncall</code> or use the Copilot to see live data.
            </div>
          ) : (
            <StackedBarChart data={byDay} />
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4">
            Cost by role
          </div>
          <div className="space-y-3">
            {usage.byRole.length === 0 ? (
              <div className="text-xs text-neutral-500">No data yet.</div>
            ) : (
              usage.byRole
                .sort((a, b) => b.costCents - a.costCents)
                .map((r) => (
                  <RoleRow
                    key={r.role}
                    role={r.role}
                    count={r.count}
                    cost={r.costCents}
                    total={usage.totalCostCents || 1}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4">
          Model routing
        </div>
        {usage.byModel.length === 0 ? (
          <div className="text-xs text-neutral-500">No model routing data yet.</div>
        ) : (
          <div className="space-y-3">
            {usage.byModel
              .sort((a, b) => b.count - a.count)
              .map((m) => (
                <ModelRow
                  key={m.model}
                  model={m.model}
                  count={m.count}
                  cost={m.costCents}
                  total={usage.totalCostCents}
                  totalCalls={totalCalls}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-white tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-neutral-600 mt-1">{hint}</div>}
    </div>
  );
}

function RoleRow({
  role,
  count,
  cost,
  total
}: {
  role: string;
  count: number;
  cost: number;
  total: number;
}) {
  const pct = total > 0 ? (cost / total) * 100 : 100;
  const color = ROLE_COLORS[role] ?? '#a1a1aa';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-300 capitalize">{role}</span>
        <span className="text-neutral-500 tabular-nums">
          {count} × ${(cost / 100).toFixed(6)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-neutral-900 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, pct)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ModelRow({
  model,
  count,
  cost,
  total,
  totalCalls
}: {
  model: string;
  count: number;
  cost: number;
  total: number;
  totalCalls: number;
}) {
  const color = MODEL_COLORS[model] ?? '#71717a';
  const sharePct = totalCalls > 0 ? (count / totalCalls) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-200 font-mono truncate">{model}</span>
          <span className="text-neutral-500 tabular-nums shrink-0 ml-2">
            {count} calls · {sharePct.toFixed(0)}% share
          </span>
        </div>
        <div className="h-1 rounded-full bg-neutral-900 overflow-hidden mt-1">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, sharePct)}%`, background: color }}
          />
        </div>
      </div>
      <div className="text-[11px] text-neutral-600 tabular-nums shrink-0 ml-2">
        ${(cost / 100).toFixed(6)}
      </div>
    </div>
  );
}

interface DayBucket {
  date: string;
  total: number;
  byRole: Record<string, number>;
}

function groupByDay(events: UsageEventRow[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const e of events) {
    const date = new Date(e.created_at).toISOString().slice(0, 10);
    const bucket =
      map.get(date) ?? { date, total: 0, byRole: {} };
    bucket.total += 1;
    bucket.byRole[e.role] = (bucket.byRole[e.role] ?? 0) + 1;
    map.set(date, bucket);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function StackedBarChart({ data }: { data: DayBucket[] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const bars = data.slice(-14); // last 14 days
  const barW = 100 / bars.length;

  return (
    <div>
      <svg viewBox="0 0 100 40" className="w-full h-40" preserveAspectRatio="none">
        {bars.map((b, i) => {
          let yOffset = 40;
          const rects: React.ReactNode[] = [];
          for (const role of Object.keys(b.byRole)) {
            const count = b.byRole[role] ?? 0;
            const h = (count / maxTotal) * 38;
            const color = ROLE_COLORS[role] ?? '#a1a1aa';
            yOffset -= h;
            rects.push(
              <rect
                key={`${i}-${role}`}
                x={i * barW + 0.5}
                y={yOffset}
                width={barW - 1}
                height={h}
                fill={color}
                opacity={0.85}
              />
            );
          }
          return rects;
        })}
      </svg>
      <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-600">
        <span>{bars[0]?.date}</span>
        <span>{bars[bars.length - 1]?.date}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="h-2 w-2 rounded" style={{ background: color }} />
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
