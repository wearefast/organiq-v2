import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ORGANIQ',
  description: 'Agent-led SEO/GEO/AEO strategy platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/auth/callback"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
        <body className="min-h-screen bg-shell text-zinc-100 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
