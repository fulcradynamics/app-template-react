import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Rubik } from 'next/font/google';
import { UserProvider } from '@/lib/user-context';

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-rubik',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Fulcra App Template',
  description: 'A Next.js template for building on the Fulcra platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={rubik.variable}>
      <body>
        <UserProvider>
          <div className="flex h-full min-h-screen w-full flex-col p-3">{children}</div>
        </UserProvider>
      </body>
    </html>
  );
}
