import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/workspaces');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignIn routing="hash" fallbackRedirectUrl="/workspaces" />
    </div>
  );
}
