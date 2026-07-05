import { NextResponse } from 'next/server';
import { updateWorkspaceIntegration } from '@helena/db';
import { getWorkspaceFromSession, attachSessionCookie, encodeSessionToken } from '@/lib/session';
import {
  fetchSentryOrg,
  fetchSentryProjects,
  fetchSentryAppInstallations,
  createHelenaIssueAlertRule
} from '@/lib/sentry-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const orgSlug = form.get('orgSlug')?.toString().trim();
  const token = form.get('token')?.toString().trim();
  const hs = form.get('hs')?.toString();

  const workspace = await getWorkspaceFromSession(hs);
  if (!workspace) {
    return NextResponse.redirect(new URL('/?install_error=no_session', new URL(req.url).origin));
  }

  if (!orgSlug || !token) {
    return redirectBack(req, workspace.id, 'invalid_token');
  }

  const orgCheck = await fetchSentryOrg(orgSlug, token);
  if (!orgCheck.ok) {
    console.error('sentry org check failed:', orgCheck.error);
    return redirectBack(req, workspace.id, 'invalid_org');
  }

  const projectsCheck = await fetchSentryProjects(orgSlug, token);
  const projectSlugs = projectsCheck.ok
    ? (projectsCheck.projects ?? []).map((p) => p.slug)
    : [];

  // Look up helena's Internal Integration installation UUID so we can
  // create alert rules that fire our webhook. If we can't find it, we
  // still save the token — user can add the rules manually.
  const installsCheck = await fetchSentryAppInstallations(orgSlug, token);
  let installationUuid: string | null = null;
  if (installsCheck.ok && installsCheck.installations) {
    const helena = installsCheck.installations.find(
      (i) => i.app.slug === 'helena' || i.app.slug.startsWith('helena')
    );
    installationUuid = helena?.uuid ?? null;
  }

  // Best-effort auto-create issue-alert rules on each project so alerts
  // actually reach us. Sentry Alerts webhook subscription alone does NOT
  // deliver events — each rule needs helena added as an Action.
  const ruleResults: Array<{ project: string; ok: boolean; error?: string }> = [];
  if (installationUuid) {
    for (const projectSlug of projectSlugs.slice(0, 10)) {
      const r = await createHelenaIssueAlertRule(
        orgSlug,
        projectSlug,
        token,
        installationUuid
      );
      ruleResults.push({ project: projectSlug, ok: r.ok, error: r.error });
      if (!r.ok) console.error(`sentry rule create failed for ${projectSlug}:`, r.error);
    }
  }

  try {
    await updateWorkspaceIntegration(workspace.id, {
      sentry_org_slug: orgSlug,
      sentry_token: token,
      sentry_projects: projectSlugs,
      sentry_connected_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('sentry save failed:', e);
    return redirectBack(req, workspace.id, 'save_failed');
  }

  const dest = new URL('/dashboard/integrations', new URL(req.url).origin);
  dest.searchParams.set('hs', encodeSessionToken(workspace.id));
  dest.searchParams.set('connected', 'sentry');
  const res = NextResponse.redirect(dest);
  return attachSessionCookie(res, workspace.id);
}

function redirectBack(req: Request, workspaceId: string, err: string): NextResponse {
  const dest = new URL('/dashboard/integrations/connect/sentry', new URL(req.url).origin);
  dest.searchParams.set('hs', encodeSessionToken(workspaceId));
  dest.searchParams.set('err', err);
  return NextResponse.redirect(dest);
}
