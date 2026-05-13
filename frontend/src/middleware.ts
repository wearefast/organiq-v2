import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/audit(.*)',
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
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
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
