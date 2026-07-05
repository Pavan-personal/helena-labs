/**
 * Extract citation markers from assistant text.
 * Formats: [INC-abc12345] [RB-abc12345]
 */
export interface Citation {
  kind: 'incident' | 'runbook';
  id: string;
  raw: string;
}

const CITATION_RE = /\[(INC|RB)-([a-f0-9]{6,})\]/gi;

export function extractCitations(text: string): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const match of text.matchAll(CITATION_RE)) {
    const raw = match[0];
    if (seen.has(raw.toLowerCase())) continue;
    seen.add(raw.toLowerCase());
    out.push({
      kind: match[1]?.toUpperCase() === 'INC' ? 'incident' : 'runbook',
      id: match[2] ?? '',
      raw
    });
  }
  return out;
}

/**
 * Validate that every citation in `text` corresponds to an id present in
 * `validIds` (extracted from tool results seen this turn). Returns whether
 * the answer is trustworthy plus notes for the retry prompt.
 */
export function validateCitations(
  text: string,
  validIncidentIds: Set<string>,
  validRunbookIds: Set<string>
): { valid: boolean; citations: Citation[]; notes: string } {
  const citations = extractCitations(text);
  if (citations.length === 0) {
    return {
      valid: true,
      citations: [],
      notes: 'No citations in this answer; caller should decide if that is ok.'
    };
  }
  const bad: string[] = [];
  for (const c of citations) {
    const bag = c.kind === 'incident' ? validIncidentIds : validRunbookIds;
    // match either full id or the 8-char prefix used in tool results
    let found = false;
    for (const validId of bag) {
      if (validId === c.id || validId.startsWith(c.id) || c.id.startsWith(validId)) {
        found = true;
        break;
      }
    }
    if (!found) bad.push(c.raw);
  }
  if (bad.length === 0) {
    return { valid: true, citations, notes: '' };
  }
  return {
    valid: false,
    citations,
    notes: `These citations do not match any id returned by tools this turn: ${bad.join(', ')}. Revise your answer to only cite ids explicitly returned by tool results, or remove the unsupported claim.`
  };
}
