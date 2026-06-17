import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/onboarding');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignUp routing="hash" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
