import type { PromotionCard } from '@metrobet/contracts';
import { buttonVariants, cn } from '@metrobet/ui';

import { Link } from '@/i18n/navigation';

import { PromotionBadge } from './promotion-badge';
import { PromotionPicture } from './promotion-picture';

/** Shared banner proportions; artwork is produced for these (see PromotionPicture). */
export const BANNER_ASPECT = 'aspect-9/7 md:aspect-8/3';

type PromoBannerProps = {
  promotion: PromotionCard;
  /** Makes the whole banner a link (slider). Omit for a static hero (promotion page). */
  href?: string;
  /** Static banners only: where the CTA button goes. Hidden when not set. */
  ctaHref?: string | null;
  titleAs?: 'h1' | 'h2';
  eager?: boolean;
  className?: string;
};

/** Artwork with localized title, subtitle and CTA overlaid. Used by the slider and promo page. */
export function PromoBanner({
  promotion,
  href,
  ctaHref,
  titleAs: Title = 'h2',
  eager,
  className,
}: PromoBannerProps) {
  const cta = cn(buttonVariants({ size: 'lg' }), 'mt-1 self-start max-md:h-10 max-md:px-4');

  const body = (
    <>
      <PromotionPicture
        image={promotion.image}
        eager={eager}
        sizes="(min-width: 1280px) 1100px, 100vw"
        className="transition-transform duration-700 ease-out group-hover/banner:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent md:bg-linear-to-r md:from-background/95 md:via-background/50" />
      <div className="relative flex h-full flex-col justify-end gap-2 p-5 md:max-w-[60%] md:justify-center md:gap-3 md:p-8 lg:p-10">
        <PromotionBadge category={promotion.category} className="self-start" />
        <Title className="text-2xl leading-tight font-black tracking-tight text-balance md:text-3xl xl:text-4xl">
          {promotion.title}
        </Title>
        <p className="line-clamp-1 text-sm text-muted-foreground md:line-clamp-2 md:text-base">
          {promotion.subtitle}
        </p>
        {href ? (
          <span className={cta}>{promotion.ctaLabel}</span>
        ) : (
          ctaHref && (
            <Link href={ctaHref} className={cta}>
              {promotion.ctaLabel}
            </Link>
          )
        )}
      </div>
    </>
  );

  const frame = cn(
    'group/banner relative block overflow-hidden rounded-xl border bg-card',
    BANNER_ASPECT,
    className,
  );

  return href ? (
    <Link href={href} className={frame}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
