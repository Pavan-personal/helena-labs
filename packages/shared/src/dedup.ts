import { createHash } from 'node:crypto';

/**
 * Deterministic hash for grouping repeated errors.
 * Normalizes the message and top stack frames so noise (line numbers, timestamps) does not fragment groups.
 */
export function computeDedupKey(input: {
  source: string;
  title: string;
  topFrames?: string[];
}): string {
  const normalizedTitle = input.title
    .replace(/\d+/g, 'N')
    .replace(/0x[0-9a-fA-F]+/g, 'HEX')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const framesKey = (input.topFrames ?? [])
    .slice(0, 3)
    .map((f) => f.replace(/:\d+/g, '').replace(/\d+/g, 'N').trim())
    .join('|');

  const raw = `${input.source}::${normalizedTitle}::${framesKey}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function extractTopFrames(stack: string | undefined, limit = 3): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '))
    .slice(0, limit);
}
