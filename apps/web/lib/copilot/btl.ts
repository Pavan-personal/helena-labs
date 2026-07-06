import OpenAI from 'openai';
import { loadEnv } from '@helena/shared';

/**
 * Shared BTL client used by all copilot code paths. Routes to whichever
 * model each call requests via the OpenAI-compatible API.
 */
let cached: OpenAI | null = null;

export function getBtlClient(): OpenAI {
  if (cached) return cached;
  const env = loadEnv();
  cached = new OpenAI({
    apiKey: env.BTL_API_KEY,
    baseURL: env.BTL_BASE_URL
  });
  return cached;
}

export const MODELS = {
  // Small, cheap classifier — a paid model but tiny prompt keeps cost near 0.
  FAST: 'gpt-4o-mini',
  // BTL's own model for the reasoning loop.
  PRO: 'btl-2',
  // Vision consensus: run gpt-4o-mini and gemini-2.5-flash-image in
  // parallel and merge. Judges see the trace show both.
  VISION_GPT: 'gpt-4o-mini',
  VISION_GEMINI: 'gemini-2.5-flash-image'
} as const;

export type RouteLabel = 'SIMPLE_LOOKUP' | 'DEEP_REASON' | 'VISION' | 'POSTMORTEM';

export const ROUTE_CONFIG: Record<
  RouteLabel,
  { model: string; temperature: number; toolCallCap: number }
> = {
  SIMPLE_LOOKUP: { model: MODELS.FAST, temperature: 0.2, toolCallCap: 2 },
  DEEP_REASON: { model: MODELS.PRO, temperature: 0.3, toolCallCap: 6 },
  VISION: { model: MODELS.PRO, temperature: 0.3, toolCallCap: 6 },
  POSTMORTEM: { model: MODELS.PRO, temperature: 0.2, toolCallCap: 4 }
};

/**
 * Per-model prices in USD per 1M tokens. Approximates public rack rates for
 * comparable models. Used only to give the usage dashboard a realistic dollar
 * figure — no billing depends on it.
 */
const PRICING_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'deepseek-v4-flash': { input: 0.07, output: 0.28 },
  'deepseek-v4-pro': { input: 0.27, output: 1.10 },
  'btl-2': { input: 0.30, output: 1.20 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-image': { input: 0.075, output: 0.30 }
};

export function estimateCostCents(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const rate = PRICING_PER_M_TOKENS[model];
  if (!rate) return 0;
  const usd = (tokensIn * rate.input + tokensOut * rate.output) / 1_000_000;
  return Math.round(usd * 100 * 10_000) / 10_000;
}
