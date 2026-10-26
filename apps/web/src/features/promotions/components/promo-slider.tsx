'use client';

import type { PromotionCard } from '@metrobet/contracts';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  cn,
  useCarousel,
} from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { type CSSProperties, useEffect, useState } from 'react';

import { promotionHref } from '../links';
import { PromoBanner } from './promo-banner';

const AUTOPLAY_MS = 6000;
const ARROW = cn(
  'absolute top-1/2 hidden -translate-y-1/2 opacity-0 transition-opacity md:inline-flex',
  'group-hover/slider:opacity-100 focus-visible:opacity-100',
);

/** Paused while hovered, focused, dragged or when the tab is hidden. */
function useAutoplayPaused() {
  const { api } = useCarousel();
  const [reasons, setReasons] = useState({
    hover: false,
    focus: false,
    drag: false,
    hidden: false,
  });

  useEffect(() => {
    if (!api) return;
    const root = api.rootNode();
    const set = (key: keyof typeof reasons, value: boolean) => () =>
      setReasons((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));

    const handlers = {
      pointerenter: set('hover', true),
      pointerleave: set('hover', false),
      focusin: set('focus', true),
      focusout: set('focus', false),
    };
    for (const [event, handler] of Object.entries(handlers)) root.addEventListener(event, handler);
    const onDragStart = set('drag', true);
    const onSettle = set('drag', false);
    api.on('pointerDown', onDragStart).on('settle', onSettle);
    const onVisibility = () => setReasons((prev) => ({ ...prev, hidden: document.hidden }));
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      for (const [event, handler] of Object.entries(handlers))
        root.removeEventListener(event, handler);
      api.off('pointerDown', onDragStart).off('settle', onSettle);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [api]);

  return Object.values(reasons).some(Boolean);
}

/**
 * Pill indicators. The active pill fills over AUTOPLAY_MS and advances the slider when full,
 * so the progress bar *is* the autoplay timer (pausing the animation pauses autoplay).
 * With reduced motion the animation is disabled, which also disables autoplay.
 */
function SliderIndicators() {
  const t = useTranslations('Promotions');
  const { selectedIndex, slideCount, scrollTo, scrollNext } = useCarousel();
  const paused = useAutoplayPaused();

  return (
    <div className="flex justify-center gap-1 pt-2 md:absolute md:right-6 md:bottom-4 md:pt-0">
      {Array.from({ length: slideCount }, (_, index) => {
        const active = index === selectedIndex;
        return (
          <button
            key={index}
            type="button"
            aria-label={t('goTo', { index: index + 1 })}
            aria-current={active}
            onClick={() => scrollTo(index)}
            className="group/dot cursor-pointer px-0.5 py-2"
          >
            <span
              className={cn(
                'relative block h-1.5 overflow-hidden rounded-full bg-foreground/25 transition-[width,background-color] duration-300',
                active ? 'w-8' : 'w-1.5 group-hover/dot:bg-foreground/50',
              )}
            >
              {active && (
                <span
                  key={selectedIndex}
                  onAnimationEnd={scrollNext}
                  style={{ '--progress-duration': `${AUTOPLAY_MS}ms` } as CSSProperties}
                  className={cn(
                    'absolute inset-0 origin-left animate-progress bg-primary motion-reduce:animate-none',
                    paused && '[animation-play-state:paused]',
                  )}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PromoSlider({ promotions }: { promotions: PromotionCard[] }) {
  const t = useTranslations('Promotions');
  const hasMany = promotions.length > 1;

  return (
    <Carousel
      opts={{ loop: hasMany, active: hasMany }}
      aria-label={t('sliderLabel')}
      className="group/slider"
    >
      <CarouselContent className="-ml-3">
        {promotions.map((promotion, index) => (
          <CarouselItem
            key={promotion.slug}
            aria-label={t('slide', { index: index + 1, total: promotions.length })}
            className="pl-3"
          >
            <PromoBanner
              promotion={promotion}
              href={promotionHref(promotion)}
              eager={index === 0}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      {hasMany && (
        <>
          <CarouselPrevious label={t('previous')} className={cn(ARROW, 'left-4')} />
          <CarouselNext label={t('next')} className={cn(ARROW, 'right-4')} />
          <SliderIndicators />
        </>
      )}
    </Carousel>
  );
}
