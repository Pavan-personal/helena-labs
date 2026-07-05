import { getBtlClient, MODELS, type RouteLabel } from './btl';
import { CLASSIFIER_PROMPT } from './prompts';

/**
 * Classify a user message to a route label. Deterministic: uses the free-tier
 * fast model at temp 0. Falls back to DEEP_REASON if classifier misbehaves.
 */
export async function classifyRoute(userText: string): Promise<{
  label: RouteLabel;
  raw: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}> {
  const btl = getBtlClient();
  const t0 = Date.now();
  try {
    const resp = await btl.chat.completions.create({
      model: MODELS.FAST,
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: 'system', content: CLASSIFIER_PROMPT },
        { role: 'user', content: userText.slice(0, 2000) }
      ]
    });
    const raw = resp.choices[0]?.message?.content?.trim().toUpperCase() ?? '';
    const parsed = parseLabel(raw);
    return {
      label: parsed,
      raw,
      tokensIn: resp.usage?.prompt_tokens ?? 0,
      tokensOut: resp.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - t0
    };
  } catch (e) {
    console.error('classifier failed:', e);
    return {
      label: 'DEEP_REASON',
      raw: 'CLASSIFIER_ERROR',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - t0
    };
  }
}

function parseLabel(raw: string): RouteLabel {
  if (raw.includes('SIMPLE_LOOKUP')) return 'SIMPLE_LOOKUP';
  if (raw.includes('POSTMORTEM')) return 'POSTMORTEM';
  if (raw.includes('VISION')) return 'VISION';
  return 'DEEP_REASON';
}
