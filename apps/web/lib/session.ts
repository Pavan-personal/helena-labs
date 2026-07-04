import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getWorkspaceById, type WorkspaceRow } from '@helena/db';
import { loadEnv } from '@helena/shared';

export const COOKIE_NAME = 'helena_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function encodeSessionToken(workspaceId: string): string {
  const env = loadEnv();
  const sig = sign(workspaceId, env.SLACK_SIGNING_SECRET);
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

/**
 * Attach the session cookie to a NextResponse.
 * Use this inside Route Handlers that return a redirect, because
 * cookies() writes are dropped when a redirect NextResponse is returned.
 */
export function attachSessionCookie(res: NextResponse, workspaceId: string): NextResponse {
  const token = encodeSessionToken(workspaceId);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  });
  return res;
}

export function clearSessionOnResponse(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return res;
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
