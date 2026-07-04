import { getServerClient } from './client';
import type { LlmRole } from '@helena/shared';

export interface UsageEventRow {
  id: string;
  workspace_id: string;
  role: LlmRole;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  created_at: string;
}

export interface UsageEventInput {
  workspaceId: string;
  role: LlmRole;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}

export async function logUsage(input: UsageEventInput): Promise<void> {
  const db = getServerClient();
  await db.from('usage_events').insert({
    workspace_id: input.workspaceId,
    role: input.role,
    model: input.model,
    tokens_in: input.tokensIn,
    tokens_out: input.tokensOut,
    cost_cents: input.costCents
  });
}

export async function usageSummary(workspaceId: string): Promise<{
  totalCostCents: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byRole: Array<{ role: string; costCents: number; count: number }>;
  byModel: Array<{ model: string; costCents: number; count: number }>;
}> {
  const db = getServerClient();
  const { data } = await db
    .from('usage_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data as UsageEventRow[]) ?? [];
  const roleMap = new Map<string, { costCents: number; count: number }>();
  const modelMap = new Map<string, { costCents: number; count: number }>();
  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const r of rows) {
    totalCost += Number(r.cost_cents);
    totalIn += r.tokens_in;
    totalOut += r.tokens_out;
    const roleAgg = roleMap.get(r.role) ?? { costCents: 0, count: 0 };
    roleAgg.costCents += Number(r.cost_cents);
    roleAgg.count += 1;
    roleMap.set(r.role, roleAgg);
    const modelAgg = modelMap.get(r.model) ?? { costCents: 0, count: 0 };
    modelAgg.costCents += Number(r.cost_cents);
    modelAgg.count += 1;
    modelMap.set(r.model, modelAgg);
  }

  return {
    totalCostCents: totalCost,
    totalTokensIn: totalIn,
    totalTokensOut: totalOut,
    byRole: Array.from(roleMap.entries()).map(([role, v]) => ({ role, ...v })),
    byModel: Array.from(modelMap.entries()).map(([model, v]) => ({ model, ...v }))
  };
}
