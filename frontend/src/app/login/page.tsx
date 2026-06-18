import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ redirect_url?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { userId } = await auth();

  if (userId) {
    const { redirect_url } = await searchParams;
    redirect(redirect_url ?? '/workspaces');
  }

  const { redirect_url } = await searchParams;
  const afterSignIn = redirect_url ?? '/auth/callback';
  const signUpUrl = redirect_url
    ? `/sign-up?redirect_url=${encodeURIComponent(redirect_url)}`
    : '/sign-up';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignIn fallbackRedirectUrl={afterSignIn} forceRedirectUrl={afterSignIn} signUpUrl={signUpUrl} />
    </div>
  );
}
