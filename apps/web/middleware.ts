import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'helena_session';

/**
 * Runs at the edge before any page renders. Checks the session cookie
 * directly from the request. This bypasses Next.js's cookies() API quirks
 * and ensures /dashboard is properly gated even under Vercel's edge cache.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const hasSession = req.cookies.has(COOKIE_NAME);

  if (path.startsWith('/dashboard')) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '?install_error=no_session';
      const res = NextResponse.redirect(url);
      res.headers.set('cache-control', 'no-store, no-cache, must-revalidate');
      return res;
    }
    // Have session, let it through, but tell caches not to store the response.
    const res = NextResponse.next();
    res.headers.set('cache-control', 'no-store, no-cache, must-revalidate, private');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
