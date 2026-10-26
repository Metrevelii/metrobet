'use client';

import type { Locale } from '@metrobet/contracts';
import { Badge, buttonVariants, cn, HeroBanner, heroBannerAspect } from '@metrobet/ui';
import { useEffect, useRef, useState } from 'react';

import { resolveMediaUrl } from '@/lib/media';

import { CATEGORY_LABELS, type PromotionDraft } from '../form-state';

/** Typical rendered widths on the player site; the preview is drawn at this size, then scaled. */
const BASE_WIDTH = { desktop: 1100, mobile: 390 } as const;

type BannerPreviewProps = {
  draft: PromotionDraft;
  locale: Locale;
  layout: 'desktop' | 'mobile';
  className?: string;
};

/** The exact banner component the player site renders, fed with the unsaved draft. */
export function BannerPreview({ draft, locale, layout, className }: BannerPreviewProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const base = BASE_WIDTH[layout];

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale((entry?.contentRect.width ?? 0) / base),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [base]);

  const src = draft.image[layout];
  return (
    <div ref={frame} className={cn('relative', heroBannerAspect[layout], className)}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: base,
          transform: `scale(${scale})`,
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        <HeroBanner
          layout={layout}
          media={
            src ? (
              // oxlint-disable-next-line nextjs/no-img-element -- preview of an arbitrary media URL
              <img
                src={resolveMediaUrl(src)}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-muted" />
            )
          }
          badge={<Badge variant="primary">{CATEGORY_LABELS[draft.category]}</Badge>}
          title={draft.title[locale] || 'Promotion title'}
          titleAs="p"
          subtitle={draft.subtitle[locale] || 'Subtitle'}
          action={
            <span className={buttonVariants({ size: layout === 'mobile' ? 'md' : 'lg' })}>
              {draft.ctaLabel[locale] || 'Call to action'}
            </span>
          }
        />
      </div>
    </div>
  );
}
