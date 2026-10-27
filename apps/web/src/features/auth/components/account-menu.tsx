'use client';

import type { PlayerProfile } from '@metrobet/contracts';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@metrobet/ui';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { logout } from '../actions';

export function AccountMenu({ player }: { player: PlayerProfile }) {
  const t = useTranslations('Auth.account');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const contact = player.email ?? player.phone ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('menu')}
          className="relative gap-2 pr-3 pl-2"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserRound className="size-3.5" />
          </span>
          <span className="hidden max-w-36 truncate md:inline">{contact}</span>
          {!player.verified && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-warning" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-semibold text-foreground">{contact}</span>
          {!player.verified && (
            <Badge variant="warning" className="self-start">
              {t('unverified')}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!player.verified && (
          <DropdownMenuItem onSelect={() => router.push('/verify')}>
            <ShieldCheck />
            {t('verify')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={pending}
          onSelect={() =>
            startTransition(async () => {
              await logout();
              router.push('/');
              router.refresh();
            })
          }
        >
          <LogOut />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
