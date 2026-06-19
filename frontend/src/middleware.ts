// MAINTENANCE MODE — all traffic is redirected to /maintenance.
// This file lives on the `maintenance` branch only.
// DO NOT merge into main or master.
import { NextRequest, NextResponse } from 'next/server';

const MAINTENANCE_PATH = '/maintenance';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the maintenance page itself and its static assets through.
  if (
    pathname === MAINTENANCE_PATH ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Redirect everything else — authenticated or not — to the maintenance page.
  return NextResponse.redirect(new URL(MAINTENANCE_PATH, req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
