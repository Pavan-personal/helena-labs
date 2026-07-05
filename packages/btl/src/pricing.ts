/**
 * Approximate per token pricing in USD cents.
 * Numbers are conservative rounded estimates so cost logs are directional, not accounting grade.
 */
/**
 * BTL benchmark pricing in cents per token.
 * Source: GET /v1/models benchmark_pricing.input_per_mtok_min / output_per_mtok_min
 * (numbers are dollars per million tokens, so divide by 1e6 to get $/token,
 *  then multiply by 100 to get cents/token.)
 */
/**
 * Cents per token. Convert from published dollars per 1M tokens by dividing
 * by 1e4 (since 1M tokens * ($/M ÷ 1M) * 100 cents/dollar = $/M ÷ 10000 cents/tok).
 */
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': {
    in: 0.15 / 1e4,
    out: 0.60 / 1e4
  },
  'deepseek-v4-flash': {
    in: 0.07 / 1e4,
    out: 0.28 / 1e4
  },
  'deepseek-v4-pro': {
    in: 0.27 / 1e4,
    out: 1.10 / 1e4
  },
  'gemini-2.5-flash-image': {
    in: 0.075 / 1e4,
    out: 0.30 / 1e4
  },
  'deepseek-v3.2': {
    in: 0.0000229,
    out: 0.0000343
  },
  'deepseek-chat-v3.1': {
    in: 0.000021,
    out: 0.000079
  }
};

export function estimateCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] ?? { in: 0.00001, out: 0.00003 };
  return tokensIn * p.in + tokensOut * p.out;
}
