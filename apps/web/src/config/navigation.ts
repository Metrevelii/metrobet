import { Cherry, Gift, House, Plane, Radio, Trophy, type LucideIcon } from 'lucide-react';
import type { Messages } from 'next-intl';

export type NavItem = {
  href: string;
  labelKey: keyof Messages['Nav'];
  icon: LucideIcon;
  /** Shown in the mobile bottom nav (max 5 items). */
  bottomNav: boolean;
};

/** Primary sections. Single source for the header tabs, side nav and mobile bottom nav. */
export const MAIN_NAV = [
  { href: '/', labelKey: 'home', icon: House, bottomNav: true },
  { href: '/sports', labelKey: 'sports', icon: Trophy, bottomNav: true },
  { href: '/live', labelKey: 'live', icon: Radio, bottomNav: true },
  { href: '/slots', labelKey: 'slots', icon: Cherry, bottomNav: true },
  { href: '/crash', labelKey: 'crash', icon: Plane, bottomNav: true },
  { href: '/promotions', labelKey: 'promotions', icon: Gift, bottomNav: false },
] as const satisfies readonly NavItem[];
