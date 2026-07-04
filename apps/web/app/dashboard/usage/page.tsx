import { getDefaultWorkspace, usageSummary } from '@helena/db';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const workspace = await getDefaultWorkspace();
  const usage = await usageSummary(workspace.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Usage and cost</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs uppercase text-neutral-500">Total cost</div>
          <div className="text-2xl font-semibold mt-2">
            ${(usage.totalCostCents / 100).toFixed(4)}
          </div>
          <div className="text-xs text-neutral-600 mt-1">approx, based on published rates</div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs uppercase text-neutral-500">Tokens in</div>
          <div className="text-2xl font-semibold mt-2">
            {usage.totalTokensIn.toLocaleString()}
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs uppercase text-neutral-500">Tokens out</div>
          <div className="text-2xl font-semibold mt-2">
            {usage.totalTokensOut.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs uppercase text-neutral-500 mb-3">By role</div>
          {usage.byRole.length === 0 ? (
            <div className="text-sm text-neutral-500">No usage yet.</div>
          ) : (
            <div className="space-y-2">
              {usage.byRole.map((r) => (
                <div key={r.role} className="flex justify-between text-sm">
                  <span>{r.role}</span>
                  <span className="text-neutral-400">
                    {r.count} calls · ${(r.costCents / 100).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs uppercase text-neutral-500 mb-3">By model</div>
          {usage.byModel.length === 0 ? (
            <div className="text-sm text-neutral-500">No usage yet.</div>
          ) : (
            <div className="space-y-2">
              {usage.byModel.map((r) => (
                <div key={r.model} className="flex justify-between text-sm">
                  <span>{r.model}</span>
                  <span className="text-neutral-400">
                    {r.count} calls · ${(r.costCents / 100).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
