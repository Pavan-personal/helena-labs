'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'helena_session_token';
const QUERY_NAME = 'hs';

/**
 * Runs on every dashboard page. Only responsibility now: if a URL still
 * carries ?hs= (external link, OAuth callback, third-party embed), mirror
 * it into localStorage for cross-tab continuity. We NEVER rewrite the URL
 * back — the httpOnly cookie already handles auth on every request, so
 * putting ?hs= into the address bar just leaked the session token for no
 * reason.
 */
export function SessionSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlToken = searchParams.get(QUERY_NAME);
    if (urlToken) {
      try {
        localStorage.setItem(STORAGE_KEY, urlToken);
      } catch {
        // storage disabled, nothing to do
      }
    }
  }, [searchParams]);

  return null;
}

/**
 * Kept only so existing imports don't break. No-op now — the landing page
 * checks the cookie server-side and never depends on client-side redirects.
 */
export function LandingSessionCheck() {
  return null;
}

/**
 * Client-side sign out: clear localStorage then navigate to server signout.
 */
export function SignOutButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        window.location.href = '/api/auth/signout';
      }}
    >
      {children}
    </button>
  );
}
