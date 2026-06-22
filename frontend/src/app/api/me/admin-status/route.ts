import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/me/admin-status
 *
 * Returns whether the current Clerk session belongs to a super-admin user.
 * Reads SUPER_ADMIN_CLERK_IDS (server-only — NOT NEXT_PUBLIC_*) so the admin
 * user IDs are never bundled into the client JS.
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ isAdmin: false });
  }

  const adminIds = (process.env.SUPER_ADMIN_CLERK_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return NextResponse.json({ isAdmin: adminIds.includes(userId) });
}
