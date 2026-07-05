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
  FAST: 'deepseek-v4-flash',
  PRO: 'deepseek-v4-pro',
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
