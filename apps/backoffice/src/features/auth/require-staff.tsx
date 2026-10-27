import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getCurrentStaff } from './data';

/** Renders children only for a signed-in staff member; otherwise sends them to /login. */
export async function RequireStaff({ children }: { children: ReactNode }) {
  if (!(await getCurrentStaff())) redirect('/login');
  return children;
}
