import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ redirect_url?: string }>;
}

export default async function SignUpPage({ searchParams }: Props) {
  const { userId } = await auth();

  if (userId) {
    redirect('/onboarding');
  }

  const { redirect_url } = await searchParams;
  const afterSignUp = redirect_url ?? '/onboarding';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignUp fallbackRedirectUrl={afterSignUp} forceRedirectUrl={afterSignUp} />
    </div>
  );
}
