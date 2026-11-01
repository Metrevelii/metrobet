import { Toaster } from '@metrobet/ui';
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
      <body className="min-h-dvh">
        {children}
        {/* No top header in the backoffice: toasts sit at the top right corner. */}
        <Toaster className="top-4" />
      </body>
    </html>
  );
}
