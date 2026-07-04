import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getWorkspaceById, type WorkspaceRow } from '@helena/db';
import { loadEnv } from '@helena/shared';

const COOKIE_NAME = 'helena_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function encodeSession(workspaceId: string, secret: string): string {
  const sig = sign(workspaceId, secret);
  return `${workspaceId}.${sig}`;
}

function decodeSession(token: string, secret: string): string | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const wid = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(wid, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return wid;
}

export async function setSessionCookie(workspaceId: string): Promise<void> {
  const env = loadEnv();
  const token = encodeSession(workspaceId, env.SLACK_SIGNING_SECRET);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getWorkspaceFromSession(): Promise<WorkspaceRow | null> {
  const env = loadEnv();
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const workspaceId = decodeSession(raw, env.SLACK_SIGNING_SECRET);
  if (!workspaceId) return null;
  return getWorkspaceById(workspaceId);
}

/**
 * Redirects to landing if there is no session. For use inside dashboard pages.
 */
export async function requireWorkspace(): Promise<WorkspaceRow> {
  const ws = await getWorkspaceFromSession();
  if (!ws) redirect('/');
  return ws;
}
