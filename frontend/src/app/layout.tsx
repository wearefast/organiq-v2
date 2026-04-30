import type { Metadata } from 'next';
import { DM_Mono } from 'next/font/google';
import { AuthProvider } from '@/shared/hooks/use-auth';
import './globals.css';

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Calibrate Commerce — Organic Visibility Engine',
  description:
    'Get a free personalised SEO, GEO & AEO audit report. Discover content gaps, traffic loss, and competitor insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmMono.variable}>
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
