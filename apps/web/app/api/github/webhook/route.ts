import { NextResponse } from 'next/server';
import {
  getServerClient,
  insertIncident,
  updateWorkspaceIntegration,
  type WorkspaceRow
} from '@helena/db';
import { computeDedupKey } from '@helena/shared';
import { listInstallationRepos, verifyGithubSignature } from '@/lib/github';
import { postToChat } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BODY = 2_000_000; // 2 MB

interface GhInstallationPayload {
  action?: string;
  installation?: { id?: number; account?: { login?: string } };
  repositories?: Array<{ full_name: string }>;
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}

interface GhPrPayload {
  action?: string;
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    merged?: boolean;
    merged_at?: string | null;
    html_url?: string;
    user?: { login?: string } | null;
    changed_files?: number;
  };
  repository?: { full_name?: string; name?: string };
  installation?: { id?: number };
}

interface GhDeploymentPayload {
  action?: string;
  deployment_status?: {
    state?: string;
    environment?: string;
    description?: string | null;
    log_url?: string | null;
  };
  deployment?: { ref?: string; sha?: string };
  repository?: { full_name?: string };
  installation?: { id?: number };
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event') ?? '';
  const delivery = req.headers.get('x-github-delivery') ?? 'unknown';

  if (!verifyGithubSignature(raw, sig)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  if (event === 'ping') {
    return NextResponse.json({ ok: true, pong: true });
  }

  // Everything below runs inside a big try/catch so GitHub never retries us.
  try {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'bad json' }, { status: 400 });
    }

    // Installation lifecycle events: keep our workspace fresh.
    if (event === 'installation') {
      return await handleInstallationLifecycle(payload as GhInstallationPayload, delivery);
    }

    if (event === 'installation_repositories') {
      return await handleInstallationRepos(payload as GhInstallationPayload, delivery);
    }

    const installationId = (payload as GhPrPayload | GhDeploymentPayload).installation?.id;
    if (!installationId) return NextResponse.json({ ok: true });

    const workspace = await lookupWorkspaceByInstall(installationId);
    if (!workspace) return NextResponse.json({ ok: true });

    if (event === 'pull_request') {
      return await handlePullRequest(payload as GhPrPayload, workspace, delivery);
    }
    if (event === 'deployment_status') {
      return await handleDeploymentStatus(payload as GhDeploymentPayload, workspace, delivery);
    }

    return NextResponse.json({ ok: true, unhandled: event });
  } catch (err) {
    console.error(`[gh-webhook] delivery=${delivery} event=${event} error:`, err);
    // Return 200 so GitHub does not hammer us with 24h retries.
    return NextResponse.json({ ok: false, err: 'internal' }, { status: 200 });
  }
}

async function lookupWorkspaceByInstall(installationId: number): Promise<WorkspaceRow | null> {
  const db = getServerClient();
  const { data } = await db
    .from('workspaces')
    .select('*')
    .eq('github_installation_id', installationId)
    .maybeSingle();
  return (data as WorkspaceRow) ?? null;
}

async function handleInstallationLifecycle(
  payload: GhInstallationPayload,
  delivery: string
): Promise<NextResponse> {
  const installationId = payload.installation?.id;
  if (!installationId) return NextResponse.json({ ok: true });
  const action = payload.action ?? '';

  const workspace = await lookupWorkspaceByInstall(installationId);
  if (!workspace) return NextResponse.json({ ok: true, note: 'no workspace, may be pre-callback' });

  if (action === 'deleted' || action === 'suspend') {
    try {
      await updateWorkspaceIntegration(workspace.id, {
        github_installation_id: null,
        github_repos: null,
        github_connected_at: null
      });
    } catch (e) {
      console.error(`[gh-webhook] clear on ${action} failed delivery=${delivery}`, e);
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (action === 'unsuspend') {
    try {
      const list = await listInstallationRepos(installationId);
      await updateWorkspaceIntegration(workspace.id, {
        github_repos: list.map((r) => r.full_name),
        github_connected_at: new Date().toISOString()
      });
    } catch (e) {
      console.error(`[gh-webhook] unsuspend refresh failed delivery=${delivery}`, e);
    }
    return NextResponse.json({ ok: true, refreshed: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleInstallationRepos(
  payload: GhInstallationPayload,
  delivery: string
): Promise<NextResponse> {
  const installationId = payload.installation?.id;
  if (!installationId) return NextResponse.json({ ok: true });

  const workspace = await lookupWorkspaceByInstall(installationId);
  if (!workspace) return NextResponse.json({ ok: true });

  try {
    const list = await listInstallationRepos(installationId);
    await updateWorkspaceIntegration(workspace.id, {
      github_repos: list.map((r) => r.full_name)
    });
  } catch (e) {
    console.error(`[gh-webhook] installation_repositories refresh failed delivery=${delivery}`, e);
  }
  return NextResponse.json({ ok: true });
}

async function handlePullRequest(
  payload: GhPrPayload,
  workspace: WorkspaceRow,
  _delivery: string
): Promise<NextResponse> {
  const pr = payload.pull_request;
  const repo = payload.repository;
  if (!pr || !repo || !repo.full_name || typeof pr.number !== 'number') {
    return NextResponse.json({ ok: true });
  }

  if (payload.action !== 'closed' || !pr.merged) {
    return NextResponse.json({ ok: true, skipped: 'not merged' });
  }

  const author = pr.user?.login ?? 'ghost';
  const title = `PR #${pr.number} merged: ${pr.title ?? '(no title)'}`;
  const body = [
    `Repo: ${repo.full_name}`,
    `Author: ${author}`,
    `Files changed: ${pr.changed_files ?? '?'}`,
    `Merged at: ${pr.merged_at ?? 'unknown'}`,
    `Link: ${pr.html_url ?? ''}`,
    '',
    (pr.body ?? '').slice(0, 2000)
  ].join('\n');

  const dedupKey = computeDedupKey({
    source: 'github',
    title: `pr_${repo.full_name}_${pr.number}`
  });

  await insertIncident(workspace.id, {
    source: 'github',
    severity: 'low',
    externalId: `${repo.full_name}#${pr.number}`,
    channel: repo.full_name,
    title,
    body,
    dedupKey,
    extractedJson: {
      repo: repo.full_name,
      pr_number: pr.number,
      author,
      merged_at: pr.merged_at ?? null,
      html_url: pr.html_url ?? null
    }
  });

  return NextResponse.json({ ok: true, ingested: 'pull_request' });
}

async function handleDeploymentStatus(
  payload: GhDeploymentPayload,
  workspace: WorkspaceRow,
  _delivery: string
): Promise<NextResponse> {
  const ds = payload.deployment_status;
  const dep = payload.deployment;
  const repo = payload.repository;
  if (!ds || !dep || !repo || !repo.full_name || !dep.sha) {
    return NextResponse.json({ ok: true });
  }

  const state = ds.state ?? 'unknown';
  const shortSha = dep.sha.slice(0, 7);
  const environment = ds.environment ?? 'unknown';

  const severity =
    state === 'failure' || state === 'error'
      ? 'high'
      : state === 'success'
        ? 'low'
        : 'low';

  const title = `Deployment ${state} on ${environment} (${repo.full_name})`;
  const body = [
    `Environment: ${environment}`,
    `Ref: ${dep.ref ?? '?'} @ ${shortSha}`,
    ds.description ? `Description: ${ds.description}` : '',
    ds.log_url ? `Logs: ${ds.log_url}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const dedupKey = computeDedupKey({
    source: 'github',
    title: `deploy_${repo.full_name}_${dep.sha}_${state}`
  });

  await insertIncident(workspace.id, {
    source: 'github',
    severity,
    externalId: `deployment_${repo.full_name}_${dep.sha}_${state}`,
    channel: repo.full_name,
    title,
    body,
    dedupKey
  });

  if ((state === 'failure' || state === 'error') && workspace.incident_channel_id) {
    try {
      await postToChat(
        workspace,
        workspace.incident_channel_id,
        `:no_entry: *Deployment ${state}* on \`${environment}\`\n*${repo.full_name}* @ ${shortSha}\n${ds.description ?? ''}`
      );
    } catch (e) {
      console.error('deployment chat post failed:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
