/**
 * Approximate per token pricing in USD cents.
 * Numbers are conservative rounded estimates so cost logs are directional, not accounting grade.
 */
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': {
    in: 0.000015,  // 0.15 dollars per 1M input tokens -> 0.000015 cents per token
    out: 0.00006
  },
  'deepseek-chat': {
    in: 0.0000027, // ~0.27 dollars per 1M input tokens
    out: 0.000011
  },
  'deepseek-reasoner': {
    in: 0.0000055,
    out: 0.000022
  }
};

export function estimateCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] ?? { in: 0.00001, out: 0.00003 };
  return tokensIn * p.in + tokensOut * p.out;
}
