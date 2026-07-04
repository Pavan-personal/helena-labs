import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
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

function buildCookieString(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${value}`, 'Path=/'];
  if (maxAge > 0) {
    const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
    parts.push(`Expires=${expires}`);
  } else {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
  parts.push(`Max-Age=${maxAge}`);
  parts.push('HttpOnly');
  parts.push('Secure');
  parts.push('SameSite=None');
  return parts.join('; ');
}

/**
 * Attach the session cookie to a NextResponse via raw Set-Cookie header.
 * res.cookies.set has proven unreliable when combined with redirect responses
 * in Next.js 16, so we do the header write ourselves.
 */
export function attachSessionCookie(res: NextResponse, workspaceId: string): NextResponse {
  const token = encodeSessionToken(workspaceId);
  res.headers.append('Set-Cookie', buildCookieString(COOKIE_NAME, token, MAX_AGE_SECONDS));
  return res;
}

export function clearSessionOnResponse(res: NextResponse): NextResponse {
  res.headers.append('Set-Cookie', buildCookieString(COOKIE_NAME, '', 0));
  return res;
}

function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (name) out[name] = value;
  }
  return out;
}

export async function getWorkspaceFromSession(): Promise<WorkspaceRow | null> {
  const env = loadEnv();

  // Primary: Next.js cookies() jar.
  let token: string | undefined;
  try {
    const jar = await cookies();
    token = jar.get(COOKIE_NAME)?.value;
  } catch {
    // ignore, we'll try headers fallback
  }

  // Fallback: raw Cookie header from the request. Next.js 16 has cases
  // where cookies() misses a cookie that is present in the request headers.
  if (!token) {
    try {
      const headerBag = await headers();
      const rawCookie = headerBag.get('cookie') ?? '';
      const parsed = parseCookieHeader(rawCookie);
      token = parsed[COOKIE_NAME];
    } catch {
      // ignore
    }
  }

  if (!token) return null;
  const workspaceId = decodeSession(token, env.SLACK_SIGNING_SECRET);
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
