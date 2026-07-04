import { computeDedupKey, extractTopFrames, type NormalizedIncident } from '@helena/shared';

export function normalizeSentry(payload: {
  data?: {
    issue?: {
      id?: string;
      title?: string;
      culprit?: string;
      permalink?: string;
      level?: string;
      metadata?: Record<string, unknown>;
    };
    event?: {
      exception?: Record<string, unknown>;
    };
  };
}): NormalizedIncident {
  const issue = payload.data?.issue;
  const title = issue?.title ?? 'Sentry issue';
  const bodyParts: string[] = [];
  if (issue?.culprit) bodyParts.push(`Culprit: ${issue.culprit}`);
  if (issue?.permalink) bodyParts.push(`Link: ${issue.permalink}`);
  if (issue?.level) bodyParts.push(`Level: ${issue.level}`);
  if (issue?.metadata) bodyParts.push(`Metadata: ${JSON.stringify(issue.metadata)}`);

  const severity = mapSentryLevel(issue?.level);
  const stackString = safeStringifyStack(payload.data?.event?.exception);
  const dedupKey = computeDedupKey({
    source: 'sentry',
    title,
    topFrames: extractTopFrames(stackString)
  });

  return {
    source: 'sentry',
    severity,
    externalId: issue?.id,
    title,
    body: bodyParts.join('\n'),
    dedupKey,
    extractedJson: (issue?.metadata as Record<string, unknown>) ?? undefined
  };
}

function mapSentryLevel(level?: string): NormalizedIncident['severity'] {
  switch (level) {
    case 'fatal':
    case 'critical':
      return 'critical';
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'info':
    case 'debug':
      return 'low';
    default:
      return 'medium';
  }
}

function safeStringifyStack(exception: Record<string, unknown> | undefined): string | undefined {
  if (!exception) return undefined;
  try {
    return JSON.stringify(exception).slice(0, 4000);
  } catch {
    return undefined;
  }
}

export function normalizeGrafana(payload: {
  status?: string;
  alerts?: Array<{
    status?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    generatorURL?: string;
    imageURL?: string;
    fingerprint?: string;
  }>;
  commonLabels?: Record<string, string>;
}): Array<{ incident: NormalizedIncident; imageURL?: string }> {
  const results: Array<{ incident: NormalizedIncident; imageURL?: string }> = [];
  const alerts = payload.alerts ?? [];
  for (const a of alerts) {
    const name = a.labels?.alertname ?? payload.commonLabels?.alertname ?? 'Grafana alert';
    const summary = a.annotations?.summary ?? '';
    const description = a.annotations?.description ?? '';
    const bodyParts = [summary, description].filter(Boolean);
    if (a.generatorURL) bodyParts.push(`Generator: ${a.generatorURL}`);
    if (a.labels) bodyParts.push(`Labels: ${JSON.stringify(a.labels)}`);

    const severity = mapGrafanaSeverity(a.labels?.severity);
    const dedupKey = computeDedupKey({ source: 'grafana', title: name });

    results.push({
      incident: {
        source: 'grafana',
        severity,
        externalId: a.fingerprint ?? name,
        title: name,
        body: bodyParts.join('\n'),
        dedupKey,
        extractedJson: (a.labels as Record<string, unknown>) ?? undefined
      },
      imageURL: a.imageURL
    });
  }
  return results;
}

function mapGrafanaSeverity(sev?: string): NormalizedIncident['severity'] {
  const s = (sev ?? '').toLowerCase();
  if (s === 'critical' || s === 'page') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'warning' || s === 'medium') return 'medium';
  return 'low';
}
