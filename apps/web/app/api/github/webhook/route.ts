import { NextResponse } from 'next/server';
import { getServerClient, insertIncident, type WorkspaceRow } from '@helena/db';
import { computeDedupKey } from '@helena/shared';
import { verifyGithubSignature } from '@/lib/github';
import { postToChat } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface GithubPrPayload {
  action: string;
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
    html_url: string;
    user: { login: string };
    changed_files?: number;
  };
  repository?: {
    full_name: string;
    name: string;
  };
  installation?: { id: number };
}

interface GithubDeploymentPayload {
  action?: string;
  deployment_status?: {
    state: string;
    environment: string;
    description: string | null;
    log_url: string | null;
  };
  deployment?: {
    ref: string;
    sha: string;
  };
  repository?: { full_name: string };
  installation?: { id: number };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event') ?? '';

  if (!verifyGithubSignature(raw, sig)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  if (event === 'ping') {
    return NextResponse.json({ ok: true, pong: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const installationId =
    (payload as GithubPrPayload | GithubDeploymentPayload).installation?.id ?? null;
  if (!installationId) {
    return NextResponse.json({ ok: true });
  }

  const db = getServerClient();
  const { data } = await db
    .from('workspaces')
    .select('*')
    .eq('github_installation_id', installationId)
    .maybeSingle();
  const workspace = data as WorkspaceRow | null;
  if (!workspace) {
    return NextResponse.json({ ok: true });
  }

  if (event === 'pull_request') {
    return handlePullRequest(payload as GithubPrPayload, workspace);
  }
  if (event === 'deployment_status') {
    return handleDeploymentStatus(payload as GithubDeploymentPayload, workspace);
  }

  return NextResponse.json({ ok: true, unhandled: event });
}

async function handlePullRequest(
  payload: GithubPrPayload,
  workspace: WorkspaceRow
): Promise<NextResponse> {
  const pr = payload.pull_request;
  const repo = payload.repository;
  if (!pr || !repo) return NextResponse.json({ ok: true });

  if (payload.action !== 'closed' || !pr.merged) {
    return NextResponse.json({ ok: true, skipped: 'not merged' });
  }

  const title = `PR #${pr.number} merged: ${pr.title}`;
  const bodyParts = [
    `Repo: ${repo.full_name}`,
    `Author: ${pr.user.login}`,
    `Files changed: ${pr.changed_files ?? '?'}`,
    `Merged at: ${pr.merged_at ?? 'unknown'}`,
    `Link: ${pr.html_url}`,
    '',
    pr.body ? pr.body.slice(0, 2000) : ''
  ];

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
    body: bodyParts.join('\n'),
    dedupKey,
    extractedJson: {
      repo: repo.full_name,
      pr_number: pr.number,
      author: pr.user.login,
      merged_at: pr.merged_at,
      html_url: pr.html_url
    }
  });

  return NextResponse.json({ ok: true, ingested: 'pull_request' });
}

async function handleDeploymentStatus(
  payload: GithubDeploymentPayload,
  workspace: WorkspaceRow
): Promise<NextResponse> {
  const ds = payload.deployment_status;
  const dep = payload.deployment;
  const repo = payload.repository;
  if (!ds || !dep || !repo) return NextResponse.json({ ok: true });

  if (ds.state === 'failure' || ds.state === 'error') {
    const title = `Deployment failed on ${ds.environment} (${repo.full_name})`;
    const body = [
      `Environment: ${ds.environment}`,
      `Ref: ${dep.ref} @ ${dep.sha.slice(0, 7)}`,
      ds.description ? `Description: ${ds.description}` : '',
      ds.log_url ? `Logs: ${ds.log_url}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    await insertIncident(workspace.id, {
      source: 'github',
      severity: 'high',
      externalId: `deployment_${repo.full_name}_${dep.sha}`,
      channel: repo.full_name,
      title,
      body
    });

    if (workspace.incident_channel_id) {
      try {
        await postToChat(
          workspace,
          workspace.incident_channel_id,
          `:no_entry: *Deployment failed* on \`${ds.environment}\`\n*${repo.full_name}* @ ${dep.sha.slice(
            0,
            7
          )}\n${ds.description ?? ''}`
        );
      } catch (e) {
        console.error('deployment slack post failed:', e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
