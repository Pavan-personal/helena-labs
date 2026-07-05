import { loadEnv } from '@helena/shared';

/**
 * Sentry Internal Integration token check + project list fetch.
 */
export async function fetchSentryProjects(
  orgSlug: string,
  token: string
): Promise<{
  ok: boolean;
  projects?: Array<{ id: string; slug: string; name: string; platform: string | null }>;
  error?: string;
}> {
  try {
    const res = await fetch(
      `https://sentry.io/api/0/organizations/${orgSlug}/projects/`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    }
    const projects = (await res.json()) as Array<{
      id: string;
      slug: string;
      name: string;
      platform: string | null;
    }>;
    return { ok: true, projects };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function fetchSentryOrg(
  orgSlug: string,
  token: string
): Promise<{ ok: boolean; org?: { slug: string; name: string }; error?: string }> {
  try {
    const res = await fetch(`https://sentry.io/api/0/organizations/${orgSlug}/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    }
    const org = (await res.json()) as { slug: string; name: string };
    return { ok: true, org };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * List the Internal Integration installations in this org so we can find
 * helena's own installation UUID. Alert-rule actions target the installation
 * UUID, NOT the app slug or the app UUID.
 */
export async function fetchSentryAppInstallations(
  orgSlug: string,
  token: string
): Promise<{
  ok: boolean;
  installations?: Array<{ uuid: string; app: { slug: string; uuid: string } }>;
  error?: string;
}> {
  try {
    const res = await fetch(
      `https://sentry.io/api/0/organizations/${orgSlug}/sentry-app-installations/`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    }
    const installations = (await res.json()) as Array<{
      uuid: string;
      app: { slug: string; uuid: string };
    }>;
    return { ok: true, installations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Attempt to create an issue-alert rule on a project that fires our helena
 * integration when any issue is seen. Best-effort — if it fails, we still
 * store the token and let the user create rules manually.
 * See: https://docs.sentry.io/api/alerts/create-an-issue-alert-rule-for-a-project/
 */
export async function createHelenaIssueAlertRule(
  orgSlug: string,
  projectSlug: string,
  token: string,
  installationUuid: string
): Promise<{ ok: boolean; ruleId?: number; error?: string }> {
  try {
    const body = {
      name: 'helena · notify on new issue',
      actionMatch: 'all',
      filterMatch: 'all',
      frequency: 30,
      conditions: [
        { id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' }
      ],
      actions: [
        {
          id: 'sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction',
          sentryAppInstallationUuid: installationUuid,
          settings: []
        }
      ]
    };
    const res = await fetch(
      `https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/rules/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    }
    const rule = (await res.json()) as { id: number };
    return { ok: true, ruleId: rule.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
