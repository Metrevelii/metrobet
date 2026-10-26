import { Cherry, House, Plane, Radio, Trophy, type LucideIcon } from 'lucide-react';
import type { Messages } from 'next-intl';

export type NavItem = {
  href: string;
  labelKey: keyof Messages['Nav'];
  icon: LucideIcon;
};

/** Primary sections. Single source for the header tabs, side nav and mobile bottom nav. */
export const MAIN_NAV = [
  { href: '/', labelKey: 'home', icon: House },
  { href: '/sports', labelKey: 'sports', icon: Trophy },
  { href: '/live', labelKey: 'live', icon: Radio },
  { href: '/casino', labelKey: 'casino', icon: Cherry },
  { href: '/crash', labelKey: 'crash', icon: Plane },
] as const satisfies readonly NavItem[];
