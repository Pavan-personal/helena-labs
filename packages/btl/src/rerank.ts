import { RerankResponseSchema, type RankedCandidate } from '@helena/shared';
import { getBtl, TEXT_MODEL, recordUsage } from './client';
import { RERANK_SYSTEM } from './prompts';

export interface RerankInput {
  workspaceId: string;
  query: string;
  candidates: Array<{ id: string; title: string; body: string }>;
}

export async function rerankCandidates(input: RerankInput): Promise<RankedCandidate[]> {
  if (input.candidates.length === 0) return [];
  const btl = getBtl();

  const candidateList = input.candidates
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id}\n   title: ${c.title}\n   body: ${c.body.slice(0, 400)}`
    )
    .join('\n');

  const userText = `Query: ${input.query}\n\nCandidates:\n${candidateList}`;

  const resp = await btl.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RERANK_SYSTEM },
      { role: 'user', content: userText }
    ]
  });

  await recordUsage({
    workspaceId: input.workspaceId,
    role: 'rerank',
    model: TEXT_MODEL,
    tokensIn: resp.usage?.prompt_tokens ?? 0,
    tokensOut: resp.usage?.completion_tokens ?? 0
  });

  const raw = resp.choices[0]?.message?.content ?? '{}';
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return [];
  }
  const validated = RerankResponseSchema.safeParse(parsedJson);
  if (!validated.success) return [];
  return validated.data.candidates;
}
