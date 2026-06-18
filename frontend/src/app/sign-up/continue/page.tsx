import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Clerk routes to [signUpUrl]/continue when a multi-step sign-up needs
 * additional fields (e.g. first/last name after org invitation).
 * Must render <SignUp> so Clerk can complete the flow and honour the
 * redirectUrl embedded in the __clerk_ticket.
 */
export default async function SignUpContinuePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/workspaces');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignUp />
    </div>
  );
}
