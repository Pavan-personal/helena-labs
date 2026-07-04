import OpenAI from 'openai';
import { loadEnv, type LlmRole } from '@helena/shared';
import { logUsage } from '@helena/db';
import { estimateCostCents } from './pricing';

export const VISION_MODEL = 'gpt-4o-mini';
export const TEXT_MODEL = 'deepseek-v4-flash';

let cached: OpenAI | null = null;

export function getBtl(): OpenAI {
  if (cached) return cached;
  const env = loadEnv();
  cached = new OpenAI({
    apiKey: env.BTL_API_KEY,
    baseURL: env.BTL_BASE_URL
  });
  return cached;
}

export interface CallLogInput {
  workspaceId: string;
  role: LlmRole;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export async function recordUsage(input: CallLogInput): Promise<void> {
  const cost = estimateCostCents(input.model, input.tokensIn, input.tokensOut);
  try {
    await logUsage({
      workspaceId: input.workspaceId,
      role: input.role,
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costCents: cost
    });
  } catch (e) {
    console.error('logUsage failed:', e);
  }
}
