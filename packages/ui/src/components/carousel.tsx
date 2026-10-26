'use client';

import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';

export type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];
type CarouselPlugins = Parameters<typeof useEmblaCarousel>[1];

type CarouselContextValue = {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  selectedIndex: number;
  slideCount: number;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

/** Carousel state and controls, for building custom indicators inside <Carousel>. */
export function useCarousel() {
  const context = use(CarouselContext);
  if (!context) throw new Error('useCarousel must be used within <Carousel>');
  return context;
}

export type CarouselProps = ComponentProps<'div'> & {
  opts?: CarouselOptions;
  plugins?: CarouselPlugins;
};

/**
 * Swipeable, keyboard-accessible carousel (Embla). Compose with CarouselContent,
 * CarouselItem, CarouselPrevious/Next, or custom controls via useCarousel().
 */
export function Carousel({
  opts,
  plugins,
  className,
  children,
  onKeyDownCapture,
  ...props
}: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(opts, plugins);
  const [state, setState] = useState({
    selectedIndex: 0,
    slideCount: 0,
    canScrollPrev: false,
    canScrollNext: false,
  });

  useEffect(() => {
    if (!api) return;
    const sync = () =>
      setState({
        selectedIndex: api.selectedScrollSnap(),
        slideCount: api.scrollSnapList().length,
        canScrollPrev: api.canScrollPrev(),
        canScrollNext: api.canScrollNext(),
      });
    sync();
    api.on('select', sync).on('reInit', sync);
    return () => {
      api.off('select', sync).off('reInit', sync);
    };
  }, [api]);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);
  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDownCapture?.(event);
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    }
  };

  const value = useMemo(
    () => ({ carouselRef, api, ...state, scrollPrev, scrollNext, scrollTo }),
    [carouselRef, api, state, scrollPrev, scrollNext, scrollTo],
  );

  return (
    <CarouselContext value={value}>
      <section
        aria-roledescription="carousel"
        onKeyDownCapture={handleKeyDown}
        className={cn('relative', className)}
        {...props}
      >
        {children}
      </section>
    </CarouselContext>
  );
}

export function CarouselContent({ className, ...props }: ComponentProps<'div'>) {
  const { carouselRef } = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div className={cn('flex touch-pan-y', className)} {...props} />
    </div>
  );
}

export function CarouselItem({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      // WAI-ARIA carousel pattern: each slide is a group with roledescription "slide".
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-roledescription="slide"
      className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
      {...props}
    />
  );
}

type CarouselArrowProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  /** Accessible label; pass a translated string. */
  label?: string;
};

export function CarouselPrevious({
  className,
  label = 'Previous slide',
  ...props
}: CarouselArrowProps) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={label}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className={cn('rounded-full shadow-md', className)}
      {...props}
    >
      <ChevronLeft />
    </Button>
  );
}

export function CarouselNext({ className, label = 'Next slide', ...props }: CarouselArrowProps) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={label}
      disabled={!canScrollNext}
      onClick={scrollNext}
      className={cn('rounded-full shadow-md', className)}
      {...props}
    >
      <ChevronRight />
    </Button>
  );
}
