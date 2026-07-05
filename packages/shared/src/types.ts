export type IncidentSource = 'slack' | 'grafana' | 'sentry' | 'generic' | 'manual' | 'github';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RunbookStatus = 'draft' | 'approved' | 'rejected';
export type LlmRole = 'vision' | 'rerank' | 'synth' | 'draft';

export interface NormalizedIncident {
  source: IncidentSource;
  severity: IncidentSeverity;
  externalId?: string;
  channel?: string;
  title: string;
  body: string;
  extractedJson?: Record<string, unknown>;
  dedupKey?: string;
  screenshotCaptions?: string[];
}

export interface IncidentRow {
  id: string;
  workspace_id: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  external_id: string | null;
  channel: string | null;
  title: string;
  body: string;
  extracted_json: Record<string, unknown> | null;
  dedup_key: string | null;
  screenshot_captions: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface RankedCandidate {
  incidentId: string;
  score: number;
  reason: string;
}

export interface SynthResult {
  title: string;
  summary: string;
  pastResolutions: string[];
  suggestedCommands: string[];
  confidence: 'low' | 'medium' | 'high';
  sourceIncidentIds: string[];
}

export interface RunbookDraft {
  title: string;
  contentMd: string;
  sourceIncidentIds: string[];
}
