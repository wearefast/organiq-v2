import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Clerk routes to [signInUrl]/factor-one, /factor-two, /sso-callback etc.
 * during multi-step sign-in. Must render <SignIn> to complete the flow.
 */
export default async function SignInContinuePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/workspaces');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignIn />
    </div>
  );
}
