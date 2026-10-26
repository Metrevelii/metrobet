import { fontVariables } from '@metrobet/ui/fonts';
import type { Metadata } from 'next';

import { Sidebar } from '@/components/sidebar';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Metrobet Backoffice', template: '%s · Metrobet Backoffice' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-mode="dark" className={fontVariables}>
      <body className="flex min-h-dvh">
        <Sidebar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
