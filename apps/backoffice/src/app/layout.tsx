import { fontVariables } from '@metrobet/ui/fonts';
import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Metrobet Backoffice', template: '%s · Metrobet Backoffice' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-mode="dark" className={fontVariables}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
