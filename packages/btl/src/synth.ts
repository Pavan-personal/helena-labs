import { SynthResponseSchema, type SynthResult } from '@helena/shared';
import { getBtl, TEXT_MODEL, recordUsage } from './client';
import { SYNTH_SYSTEM } from './prompts';

export interface SynthInput {
  workspaceId: string;
  query: string;
  incidents: Array<{ id: string; title: string; body: string }>;
}

export async function synthesizeAnswer(input: SynthInput): Promise<SynthResult> {
  const btl = getBtl();

  const contextText = input.incidents
    .map(
      (i, idx) =>
        `[${idx + 1}] id=${i.id}\n    title: ${i.title}\n    body: ${i.body.slice(0, 800)}`
    )
    .join('\n\n');

  const userText = `Query: ${input.query}\n\nRelevant past incidents:\n${contextText}`;

  const resp = await btl.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      { role: 'user', content: userText }
    ]
  });

  await recordUsage({
    workspaceId: input.workspaceId,
    role: 'synth',
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
      title: 'Unable to synthesize',
      summary: 'The reasoning step returned malformed JSON.',
      pastResolutions: [],
      suggestedCommands: [],
      confidence: 'low',
      sourceIncidentIds: []
    };
  }
  const validated = SynthResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      title: 'Unable to synthesize',
      summary: 'The reasoning step returned an unexpected shape.',
      pastResolutions: [],
      suggestedCommands: [],
      confidence: 'low',
      sourceIncidentIds: []
    };
  }
  return validated.data;
}
