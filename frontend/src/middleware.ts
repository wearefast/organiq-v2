import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard');
  if (!isProtected) return NextResponse.next();

  // In demo mode, client-side AuthProvider handles redirect.
  // This middleware is a placeholder for when Clerk is re-added.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
