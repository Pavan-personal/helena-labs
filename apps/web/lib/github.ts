import { createSign, createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '@helena/shared';

/**
 * Sign a JWT with the GitHub App private key. Valid for 10 minutes.
 * Used to authenticate as the app itself (before we know the installation).
 */
function signAppJwt(): string {
  const env = loadEnv();
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GitHub App not configured');
  }
  // Handle env-var stored PEMs which may have literal \n escapes.
  const key = env.GITHUB_APP_PRIVATE_KEY.includes('-----BEGIN')
    ? env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n')
    : env.GITHUB_APP_PRIVATE_KEY;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 540, iss: String(env.GITHUB_APP_ID) };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  const sig = signer.sign(key, 'base64url');
  return `${h}.${p}.${sig}`;
}

/**
 * Exchange the app JWT for an installation access token (~1 hour lifetime).
 * We do not cache these across requests; each call gets a fresh token.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = signAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'helena'
      }
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Installation token exchange failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function listInstallationRepos(installationId: number): Promise<Array<{
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
}>> {
  const token = await getInstallationToken(installationId);
  const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'helena'
    }
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    repositories: Array<{
      full_name: string;
      name: string;
      owner: { login: string };
      default_branch: string;
    }>;
  };
  return data.repositories ?? [];
}

export type CommitInfo = {
  message: string;
  author: string;
  files: number;
  additions: number;
  deletions: number;
};

/**
 * Fetch commit details for a specific SHA. Used to enrich deployment
 * incidents with what actually shipped — commit title, author, diff stats.
 * Returns null on any failure so the caller can degrade gracefully.
 */
export async function fetchCommit(
  installationId: number,
  fullName: string,
  sha: string
): Promise<CommitInfo | null> {
  try {
    const token = await getInstallationToken(installationId);
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/commits/${sha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'helena'
        }
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      commit: { message: string; author: { name: string } };
      author?: { login: string };
      files?: Array<unknown>;
      stats?: { additions: number; deletions: number };
    };
    return {
      message: (data.commit.message.split('\n')[0] ?? '').slice(0, 200),
      author: data.author?.login ?? data.commit.author?.name ?? 'unknown',
      files: data.files?.length ?? 0,
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0
    };
  } catch {
    return null;
  }
}

/**
 * Verify a GitHub webhook signature using X-Hub-Signature-256.
 */
export function verifyGithubSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const env = loadEnv();
  if (!env.GITHUB_WEBHOOK_SECRET) return false;

  const expected =
    'sha256=' + createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Fetch recent merged PRs from a repo (used for "what changed" correlation
 * when an alert fires).
 */
export async function fetchRecentMergedPrs(
  installationId: number,
  fullName: string,
  sinceHoursAgo: number = 24
): Promise<Array<{
  number: number;
  title: string;
  body: string;
  merged_at: string;
  author: string;
  html_url: string;
  files_changed: number;
}>> {
  const token = await getInstallationToken(installationId);
  const url = `https://api.github.com/repos/${fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'helena'
    }
  });
  if (!res.ok) return [];
  const prs = (await res.json()) as Array<{
    number: number;
    title: string;
    body: string | null;
    merged_at: string | null;
    user: { login: string };
    html_url: string;
    changed_files?: number;
  }>;

  const cutoff = Date.now() - sinceHoursAgo * 3600_000;
  return prs
    .filter((p) => p.merged_at && new Date(p.merged_at).getTime() > cutoff)
    .map((p) => ({
      number: p.number,
      title: p.title,
      body: (p.body ?? '').slice(0, 1200),
      merged_at: p.merged_at as string,
      author: p.user.login,
      html_url: p.html_url,
      files_changed: p.changed_files ?? 0
    }));
}
