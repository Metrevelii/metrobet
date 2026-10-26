import type { PromotionCard } from '@metrobet/contracts';
import { buttonVariants, cn, HeroBanner } from '@metrobet/ui';

import { Link } from '@/i18n/navigation';

import { PromotionBadge } from './promotion-badge';
import { PromotionPicture } from './promotion-picture';

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

const CTA = cn(buttonVariants({ size: 'lg' }), 'max-md:h-10 max-md:px-4');

/** A promotion rendered with the shared HeroBanner. Used by the slider and the promo page. */
export function PromoBanner({
  promotion,
  href,
  ctaHref,
  titleAs,
  eager,
  className,
}: PromoBannerProps) {
  const action = href ? (
    <span className={CTA}>{promotion.ctaLabel}</span>
  ) : ctaHref ? (
    <Link href={ctaHref} className={CTA}>
      {promotion.ctaLabel}
    </Link>
  ) : undefined;

  const banner = (
    <HeroBanner
      className={href ? undefined : className}
      media={
        <PromotionPicture
          image={promotion.image}
          eager={eager}
          sizes="(min-width: 1280px) 1100px, 100vw"
          className="transition-transform duration-700 ease-out group-hover/banner:scale-[1.03]"
        />
      }
      badge={<PromotionBadge category={promotion.category} />}
      title={promotion.title}
      titleAs={titleAs}
      subtitle={promotion.subtitle}
      action={action}
    />
  );

  return href ? (
    <Link href={href} className={cn('block rounded-xl', className)}>
      {banner}
    </Link>
  ) : (
    banner
  );
}
