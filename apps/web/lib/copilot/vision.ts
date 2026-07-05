import { getServerClient } from '@helena/db';
import { getBtlClient, MODELS } from './btl';
import { VISION_SYSTEM_PROMPT } from './prompts';

export interface VisionSingleResult {
  source?: string;
  panel_title?: string;
  summary?: string;
  extracted_text?: string;
  time_range?: string;
  suggested_query?: string;
  severity_hint?: string;
  raw?: string;
}

export interface VisionConsensus {
  model_agreement: 'high' | 'partial' | 'low';
  source: string;
  panel_title: string | null;
  summary: string;
  extracted_text: string;
  suggested_query: string;
  severity_hint: string | null;
  models_used: string[];
  by_model: Array<{ model: string; result: VisionSingleResult }>;
}

async function callVisionModel(
  model: string,
  imageDataUrls: string[]
): Promise<VisionSingleResult> {
  const btl = getBtlClient();
  const resp = await btl.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract structured signal from these screenshots.' },
          ...imageDataUrls.map((url) => ({
            type: 'image_url' as const,
            image_url: { url }
          }))
        ]
      }
    ]
  });
  const raw = resp.choices[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw) as VisionSingleResult;
  } catch {
    return { raw };
  }
}

/**
 * Run gpt-4o-mini AND gemini-2.5-flash-image in parallel; return a merged
 * consensus. Falls back to whichever model succeeded if the other errored.
 */
export async function runVisionConsensus(
  imageDataUrls: string[]
): Promise<VisionConsensus> {
  const results = await Promise.allSettled([
    callVisionModel(MODELS.VISION_GPT, imageDataUrls),
    callVisionModel(MODELS.VISION_GEMINI, imageDataUrls)
  ]);

  const gpt = results[0].status === 'fulfilled' ? results[0].value : null;
  const gem = results[1].status === 'fulfilled' ? results[1].value : null;

  const byModel: VisionConsensus['by_model'] = [];
  if (gpt) byModel.push({ model: MODELS.VISION_GPT, result: gpt });
  if (gem) byModel.push({ model: MODELS.VISION_GEMINI, result: gem });

  const modelsUsed = byModel.map((b) => b.model);

  // Merge
  const sourceGpt = (gpt?.source ?? '').toLowerCase();
  const sourceGem = (gem?.source ?? '').toLowerCase();
  let agreement: VisionConsensus['model_agreement'] = 'low';
  if (sourceGpt && sourceGem) {
    agreement = sourceGpt === sourceGem ? 'high' : 'partial';
  } else if (sourceGpt || sourceGem) {
    agreement = 'partial';
  }

  const pick = <T>(a: T | undefined, b: T | undefined, fallback: T): T =>
    a ?? b ?? fallback;

  return {
    model_agreement: agreement,
    source: pick(gpt?.source, gem?.source, 'unknown'),
    panel_title: gpt?.panel_title ?? gem?.panel_title ?? null,
    summary: pick(gem?.summary, gpt?.summary, 'screenshot processed'),
    extracted_text: [gpt?.extracted_text, gem?.extracted_text]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 1500),
    suggested_query: (() => {
      const parts = new Set<string>();
      for (const s of [gpt?.suggested_query, gem?.suggested_query]) {
        if (!s) continue;
        for (const word of s.split(/[\s,]+/)) {
          if (word.length > 2) parts.add(word.toLowerCase());
        }
      }
      return Array.from(parts).slice(0, 10).join(' ');
    })(),
    severity_hint: gpt?.severity_hint ?? gem?.severity_hint ?? null,
    models_used: modelsUsed,
    by_model: byModel
  };
}

/**
 * Fetch attachments from Supabase Storage as base64 data URLs for vision.
 * Signed URLs would be preferable but data-URL guarantees the vision API
 * gets bytes without needing to fetch cross-origin.
 */
export async function fetchAttachmentsAsDataUrls(
  workspaceId: string,
  attachmentIds: string[]
): Promise<string[]> {
  if (attachmentIds.length === 0) return [];
  const db = getServerClient();
  const { data } = await db
    .from('copilot_attachments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('id', attachmentIds);
  const rows = (data as Array<{
    id: string;
    storage_path: string;
    mime_type: string;
  }>) ?? [];

  const results: string[] = [];
  for (const row of rows) {
    const { data: blob } = await db.storage
      .from('copilot-uploads')
      .download(row.storage_path);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    results.push(`data:${row.mime_type};base64,${buf.toString('base64')}`);
  }
  return results;
}
