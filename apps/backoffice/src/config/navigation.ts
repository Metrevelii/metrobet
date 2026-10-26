import {
  Gamepad2,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Ticket,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const BACKOFFICE_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/promotions', label: 'Promotions', icon: Megaphone },
  { href: '/players', label: 'Players', icon: Users },
  { href: '/bets', label: 'Bets', icon: Ticket },
  { href: '/sportsbook', label: 'Sportsbook', icon: Trophy },
  { href: '/games', label: 'Games & Providers', icon: Gamepad2 },
  { href: '/audit-log', label: 'Audit log', icon: ScrollText },
] as const satisfies readonly NavItem[];
