'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'helena_session_token';
const QUERY_NAME = 'hs';

/**
 * Runs on every dashboard page. If the URL has ?hs=, mirror it into
 * localStorage so other tabs and future sessions can recover.
 * If the URL does not have ?hs= but localStorage does, redirect once
 * to add the param so the middleware lets the request through.
 */
export function SessionSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const urlToken = searchParams.get(QUERY_NAME);
    if (urlToken) {
      try {
        localStorage.setItem(STORAGE_KEY, urlToken);
      } catch {
        // storage disabled, nothing to do
      }
      return;
    }

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (stored) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(QUERY_NAME, stored);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  return null;
}

/**
 * Runs on the landing page. If the user has a stored session, bounce them
 * to /dashboard with the token appended so they never see the marketing page
 * when they already have an install.
 */
export function LandingSessionCheck() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('signed_out') === '1') return;
    if (searchParams.get('install_error')) return;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (stored) {
      router.replace(`/dashboard?${QUERY_NAME}=${encodeURIComponent(stored)}`);
    }
  }, [router, searchParams]);

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
