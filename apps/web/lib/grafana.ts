import { loadEnv } from '@helena/shared';

/**
 * Simple probe: verify a Grafana service account token works.
 * Returns the org info on success, null on failure.
 */
export async function pingGrafana(baseUrl: string, token: string): Promise<{
  ok: boolean;
  user?: { login: string; email: string; orgId: number };
  error?: string;
}> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    }
    const user = (await res.json()) as { login: string; email: string; orgId: number };
    return { ok: true, user };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Create a webhook Contact Point in Grafana via the Alerting Provisioning API.
 * Exact contract will be validated by the research workflow before we ship this.
 * See: https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/
 */
export async function createWebhookContactPoint(
  baseUrl: string,
  token: string,
  name: string,
  webhookUrl: string
): Promise<{ ok: boolean; uid?: string; error?: string }> {
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/v1/provisioning/contact-points`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Disable-Provenance': 'true'
        },
        body: JSON.stringify({
          name,
          type: 'webhook',
          settings: {
            url: webhookUrl,
            httpMethod: 'POST'
          },
          disableResolveMessage: false
        })
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    }
    const cp = (await res.json()) as { uid: string };
    return { ok: true, uid: cp.uid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
