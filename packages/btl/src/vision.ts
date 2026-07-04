import { VisionResponseSchema } from '@helena/shared';
import { getBtl, VISION_MODEL, recordUsage } from './client';
import { VISION_SYSTEM } from './prompts';

export interface VisionInput {
  workspaceId: string;
  imageUrl: string;
  hint?: string;
}

export interface VisionOutput {
  caption: string;
  panelTitle?: string;
  metrics?: Array<{ name: string; value: string; trend?: 'spiking' | 'dropping' | 'flat' | 'unknown' }>;
  timeRange?: string;
}

export async function extractFromImage(input: VisionInput): Promise<VisionOutput> {
  const btl = getBtl();
  const userText = input.hint
    ? `Context hint: ${input.hint}\nDescribe operational signal in this image.`
    : 'Describe operational signal in this image.';

  const resp = await btl.chat.completions.create({
    model: VISION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISION_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: input.imageUrl } }
        ]
      }
    ]
  });

  await recordUsage({
    workspaceId: input.workspaceId,
    role: 'vision',
    model: VISION_MODEL,
    tokensIn: resp.usage?.prompt_tokens ?? 0,
    tokensOut: resp.usage?.completion_tokens ?? 0
  });

  const raw = resp.choices[0]?.message?.content ?? '{}';
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { caption: 'Screenshot could not be parsed.' };
  }
  const validated = VisionResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    const anyObj = parsedJson as { caption?: string };
    return { caption: anyObj.caption ?? 'Screenshot processed.' };
  }
  return validated.data;
}
