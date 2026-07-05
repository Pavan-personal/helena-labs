import { NextResponse } from 'next/server';
import { updateWorkspaceIntegration } from '@helena/db';
import { getWorkspaceFromSession, attachSessionCookie, encodeSessionToken } from '@/lib/session';
import { pingGrafana, createWebhookContactPoint } from '@/lib/grafana';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const url = form.get('url')?.toString().trim();
  const token = form.get('token')?.toString().trim();
  const hs = form.get('hs')?.toString();

  const workspace = await getWorkspaceFromSession(hs);
  if (!workspace) {
    return NextResponse.redirect(new URL('/?install_error=no_session', new URL(req.url).origin));
  }

  if (!url || !token) {
    return redirectBack(req, workspace.id, 'invalid_token');
  }

  let normalized: URL;
  try {
    normalized = new URL(url);
    if (!/grafana\.net|grafana\.com|localhost/i.test(normalized.hostname)) {
      return redirectBack(req, workspace.id, 'invalid_url');
    }
  } catch {
    return redirectBack(req, workspace.id, 'invalid_url');
  }

  const ping = await pingGrafana(normalized.origin, token);
  if (!ping.ok) {
    console.error('grafana ping failed:', ping.error);
    return redirectBack(req, workspace.id, 'invalid_token');
  }

  const webhookUrl = `https://helenalabs.vercel.app/api/grafana/webhook/${workspace.webhook_secret}`;
  const cp = await createWebhookContactPoint(
    normalized.origin,
    token,
    'helena-oncall',
    webhookUrl
  );
  if (!cp.ok) {
    console.error('grafana contact point create failed:', cp.error);
    return redirectBack(req, workspace.id, 'contact_point_failed');
  }

  await updateWorkspaceIntegration(workspace.id, {
    grafana_url: normalized.origin,
    grafana_token: token,
    grafana_contact_point_uid: cp.uid ?? null,
    grafana_connected_at: new Date().toISOString()
  });

  const dest = new URL('/dashboard/integrations', new URL(req.url).origin);
  dest.searchParams.set('hs', encodeSessionToken(workspace.id));
  dest.searchParams.set('connected', 'grafana');
  const res = NextResponse.redirect(dest);
  return attachSessionCookie(res, workspace.id);
}

function redirectBack(req: Request, workspaceId: string, err: string): NextResponse {
  const dest = new URL('/dashboard/integrations/connect/grafana', new URL(req.url).origin);
  dest.searchParams.set('hs', encodeSessionToken(workspaceId));
  dest.searchParams.set('err', err);
  return NextResponse.redirect(dest);
}
