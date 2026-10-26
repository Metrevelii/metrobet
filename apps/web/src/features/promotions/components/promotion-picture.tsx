import type { PromotionCard } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { getImageProps } from 'next/image';

/** Artwork sizes promotions are produced at (see packages/contracts promotionImageSchema). */
const DESKTOP = { width: 1600, height: 500 };
const MOBILE = { width: 900, height: 700 };
const DESKTOP_MEDIA = '(min-width: 768px)';

type PromotionPictureProps = {
  image: PromotionCard['image'];
  /** Above the fold (first slide / detail hero): load immediately with high priority. */
  eager?: boolean;
  /** `art` swaps desktop/mobile artwork by breakpoint; `mobile` always uses the mobile art. */
  variant?: 'art' | 'mobile';
  sizes?: string;
  className?: string;
};

/**
 * Decorative promotion artwork (text is rendered as HTML on top, so alt is empty).
 * Art-directed with <picture> via getImageProps, per the Next.js docs.
 */
export function PromotionPicture({
  image,
  eager = false,
  variant = 'art',
  sizes = '100vw',
  className,
}: PromotionPictureProps) {
  const common = {
    alt: '',
    sizes,
    loading: eager ? 'eager' : 'lazy',
    fetchPriority: eager ? 'high' : 'auto',
    unoptimized: image.mobile.endsWith('.svg'),
  } as const;

  const { props: mobile } = getImageProps({ ...common, ...MOBILE, src: image.mobile });
  // Unoptimized images (SVG) get no srcSet from getImageProps, only src.
  const desktop =
    variant === 'art' ? getImageProps({ ...common, ...DESKTOP, src: image.desktop }).props : null;
  const desktopSrcSet = desktop && (desktop.srcSet ?? desktop.src);

  return (
    <picture>
      {desktopSrcSet && <source media={DESKTOP_MEDIA} srcSet={desktopSrcSet} />}
      {/* oxlint-disable-next-line nextjs/no-img-element -- art direction needs a raw <img> */}
      <img
        {...mobile}
        alt=""
        aria-hidden
        className={cn('absolute inset-0 size-full object-cover', className)}
      />
    </picture>
  );
}
