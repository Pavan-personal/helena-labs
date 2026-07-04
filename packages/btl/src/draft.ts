import { DraftResponseSchema, type RunbookDraft } from '@helena/shared';
import { getBtl, TEXT_MODEL, recordUsage } from './client';
import { DRAFT_SYSTEM } from './prompts';

export interface DraftInput {
  workspaceId: string;
  threadTitle: string;
  incidents: Array<{ id: string; title: string; body: string; created_at: string }>;
}

export async function draftRunbook(input: DraftInput): Promise<RunbookDraft> {
  const btl = getBtl();

  const timeline = input.incidents
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(
      (i, idx) =>
        `[${idx + 1}] ${i.created_at} id=${i.id}\n    title: ${i.title}\n    body: ${i.body.slice(0, 600)}`
    )
    .join('\n\n');

  const userText = `Thread title: ${input.threadTitle}\n\nChronological messages:\n${timeline}`;

  const resp = await btl.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DRAFT_SYSTEM },
      { role: 'user', content: userText }
    ]
  });

  await recordUsage({
    workspaceId: input.workspaceId,
    role: 'draft',
    model: TEXT_MODEL,
    tokensIn: resp.usage?.prompt_tokens ?? 0,
    tokensOut: resp.usage?.completion_tokens ?? 0
  });

  const raw = resp.choices[0]?.message?.content ?? '{}';
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      title: input.threadTitle,
      contentMd: 'Draft generation failed. Please review the source incidents.',
      sourceIncidentIds: input.incidents.map((i) => i.id)
    };
  }
  const validated = DraftResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      title: input.threadTitle,
      contentMd: 'Draft generation returned an unexpected shape.',
      sourceIncidentIds: input.incidents.map((i) => i.id)
    };
  }
  return validated.data;
}
