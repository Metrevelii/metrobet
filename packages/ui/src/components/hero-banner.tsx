import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * `responsive` switches from the mobile to the desktop composition at md;
 * `desktop` / `mobile` pin one composition (e.g. side-by-side previews in the backoffice).
 */
type Layout = 'responsive' | 'desktop' | 'mobile';

export const heroBannerAspect: Record<Layout, string> = {
  responsive: 'aspect-9/7 md:aspect-8/3',
  desktop: 'aspect-8/3',
  mobile: 'aspect-9/7',
};

const frame = cva('group/banner relative overflow-hidden rounded-xl border bg-card', {
  variants: { layout: heroBannerAspect },
  defaultVariants: { layout: 'responsive' },
});

const scrim = cva('absolute inset-0', {
  variants: {
    layout: {
      responsive:
        'bg-linear-to-t from-background via-background/40 to-transparent md:bg-linear-to-r md:from-background/95 md:via-background/50',
      desktop: 'bg-linear-to-r from-background/95 via-background/50 to-transparent',
      mobile: 'bg-linear-to-t from-background via-background/40 to-transparent',
    },
  },
  defaultVariants: { layout: 'responsive' },
});

const body = cva('relative flex h-full flex-col', {
  variants: {
    layout: {
      responsive: 'justify-end gap-2 p-5 md:max-w-[60%] md:justify-center md:gap-3 md:p-8 lg:p-10',
      desktop: 'max-w-[60%] justify-center gap-3 p-8',
      mobile: 'justify-end gap-2 p-5',
    },
  },
  defaultVariants: { layout: 'responsive' },
});

const titleSize: Record<Layout, string> = {
  responsive: 'text-2xl md:text-3xl xl:text-4xl',
  desktop: 'text-3xl',
  mobile: 'text-2xl',
};

const subtitleSize: Record<Layout, string> = {
  responsive: 'line-clamp-1 text-sm md:line-clamp-2 md:text-base',
  desktop: 'line-clamp-2 text-base',
  mobile: 'line-clamp-1 text-sm',
};

export type HeroBannerProps = Omit<ComponentProps<'div'>, 'title'> &
  VariantProps<typeof frame> & {
    /** Full-bleed artwork, absolutely positioned (e.g. an <img> or <picture> with `absolute inset-0`). */
    media: ReactNode;
    badge?: ReactNode;
    title: ReactNode;
    titleAs?: 'h1' | 'h2' | 'p';
    subtitle?: ReactNode;
    /** CTA area, usually a button or link styled with buttonVariants. */
    action?: ReactNode;
  };

/** Artwork with a legibility scrim and text block on top. Wrap in a link to make it clickable. */
export function HeroBanner({
  media,
  badge,
  title,
  titleAs: Title = 'h2',
  subtitle,
  action,
  layout,
  className,
  ...props
}: HeroBannerProps) {
  const key = layout ?? 'responsive';
  return (
    <div className={cn(frame({ layout }), className)} {...props}>
      {media}
      <div className={scrim({ layout })} />
      <div className={body({ layout })}>
        {badge && <div className="self-start">{badge}</div>}
        <Title
          className={cn('leading-tight font-black tracking-tight text-balance', titleSize[key])}
        >
          {title}
        </Title>
        {subtitle && <p className={cn('text-muted-foreground', subtitleSize[key])}>{subtitle}</p>}
        {action && <div className="mt-1 self-start">{action}</div>}
      </div>
    </div>
  );
}
