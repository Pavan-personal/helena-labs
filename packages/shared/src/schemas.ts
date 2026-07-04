import { z } from 'zod';

export const IncidentSourceSchema = z.enum(['slack', 'grafana', 'sentry', 'generic', 'manual']);
export const IncidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const NormalizedIncidentSchema = z.object({
  source: IncidentSourceSchema,
  severity: IncidentSeveritySchema,
  externalId: z.string().optional(),
  channel: z.string().optional(),
  title: z.string().min(1),
  body: z.string().default(''),
  extractedJson: z.record(z.string(), z.unknown()).optional(),
  dedupKey: z.string().optional(),
  screenshotCaptions: z.array(z.string()).optional()
});

export const RankedCandidateSchema = z.object({
  incidentId: z.string(),
  score: z.number(),
  reason: z.string()
});

export const RerankResponseSchema = z.object({
  candidates: z.array(RankedCandidateSchema)
});

export const SynthResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  pastResolutions: z.array(z.string()),
  suggestedCommands: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  sourceIncidentIds: z.array(z.string())
});

export const DraftResponseSchema = z.object({
  title: z.string(),
  contentMd: z.string(),
  sourceIncidentIds: z.array(z.string())
});

export const VisionResponseSchema = z.object({
  caption: z.string(),
  metrics: z.array(z.object({
    name: z.string(),
    value: z.string(),
    trend: z.enum(['spiking', 'dropping', 'flat', 'unknown']).optional()
  })).optional(),
  panelTitle: z.string().optional(),
  timeRange: z.string().optional()
});

// Sentry webhook payload (subset we care about)
export const SentryWebhookSchema = z.object({
  action: z.string().optional(),
  data: z.object({
    issue: z.object({
      id: z.string(),
      title: z.string(),
      culprit: z.string().optional(),
      permalink: z.string().optional(),
      level: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }).optional(),
    event: z.object({
      event_id: z.string().optional(),
      exception: z.record(z.string(), z.unknown()).optional()
    }).optional()
  }).optional()
});

// Grafana Alertmanager style payload
export const GrafanaWebhookSchema = z.object({
  status: z.string().optional(),
  alerts: z.array(z.object({
    status: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    generatorURL: z.string().optional(),
    imageURL: z.string().optional(),
    fingerprint: z.string().optional()
  })).optional(),
  commonLabels: z.record(z.string(), z.string()).optional()
});

// Generic webhook payload
export const GenericWebhookSchema = z.object({
  title: z.string(),
  message: z.string().default(''),
  stack: z.string().optional(),
  source: z.string().default('generic'),
  severity: IncidentSeveritySchema.optional(),
  externalId: z.string().optional(),
  ts: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
