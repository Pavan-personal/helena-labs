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
