import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/audit(.*)',
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/auth/(.*)',
  '/invite/(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === '/audit') {
    return NextResponse.redirect(new URL('/workspaces', req.url));
  }

  const { userId } = await auth();

  if (!userId && !isPublicRoute(req)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // CVE-005: Protect /admin server-side using the non-public SUPER_ADMIN_CLERK_IDS env var.
  // The admin page previously relied on NEXT_PUBLIC_* which exposed admin user IDs in the bundle.
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!userId) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    const adminIds = (process.env.SUPER_ADMIN_CLERK_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!adminIds.includes(userId)) {
      return NextResponse.redirect(new URL('/workspaces', req.url));
    }
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)', '/__clerk/(.*)'],
};
