import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'helena_session';
const QUERY_NAME = 'hs';

/**
 * Runs at the edge before any page renders.
 * Accepts session from cookie OR ?hs= URL param. The URL fallback exists
 * because some browsers, extensions, or privacy settings drop the cookie
 * on redirects. If token is only in URL, we re-issue the cookie on the way
 * through so subsequent navigations do not need the query param.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  const queryToken = req.nextUrl.searchParams.get(QUERY_NAME);
  const hasSession = Boolean(cookieToken || queryToken);

  if (path.startsWith('/dashboard')) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '?install_error=no_session';
      const res = NextResponse.redirect(url);
      res.headers.set('cache-control', 'no-store, no-cache, must-revalidate');
      return res;
    }

    // Inject the resolved token as a request header so server components can
    // read it via headers() even when cookies are dropped by the browser.
    const requestHeaders = new Headers(req.headers);
    const resolvedToken = cookieToken ?? queryToken ?? '';
    if (resolvedToken) requestHeaders.set('x-helena-session', resolvedToken);

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('cache-control', 'no-store, no-cache, must-revalidate, private');

    // If the token only exists in the URL, re-issue the cookie so future
    // requests do not need the param.
    if (queryToken && !cookieToken) {
      res.cookies.set(COOKIE_NAME, queryToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 60 * 60 * 24 * 30
      });
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
