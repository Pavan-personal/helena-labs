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
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': {
    in: 0.000015,
    out: 0.00006
  },
  'deepseek-v4-flash': {
    in: 0,
    out: 0
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
