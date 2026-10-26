# Promotions (web)

Promo banner slider (top of home and section pages), the promotions list (`/promotions`) and a
page per promotion (`/promotions/[slug]`). Content comes from `@metrobet/api` and is designed to
be managed from the backoffice (add/remove/reorder/schedule slides).

## Data flow

```
backoffice (later) ──writes──▶ api /promotions ──▶ data.ts ('use cache', tag "promotions") ──▶ components
```

- `data.ts`: server-only. `getPromotions(locale, placement?)` and `getPromotion(locale, slug)`,
  cached with `cacheTag('promotions')` + `cacheLife('minutes')`. The API returns already-localized
  strings (`PromotionCard` / `PromotionDetail` from `@metrobet/contracts`).
- `getPromotions` **never throws**: if the API is down it logs, caches `[]` for seconds, and the
  slider simply does not render. `getPromotion` returns `null` on 404 (page calls `notFound()`)
  and throws on other errors (`app/[locale]/error.tsx` shows).
- `links.ts`: `promotionHref()`, which is client-safe. Keep server-only code out of anything a
  client component imports.
- Backoffice edits reach the site within seconds: the api calls `POST /api/revalidate`
  (`app/api/revalidate/route.ts`) with tag `promotions`. Keep `PROMOTIONS_CACHE_TAG` in sync with
  the api's `admin-promotions.service.ts`.

## Components

| Component          | Where                      | Notes                                                                 |
| ------------------ | -------------------------- | --------------------------------------------------------------------- |
| `PromotionsSlider` | any page: `placement` prop | Server. Suspense + skeleton; renders nothing when empty               |
| `PromoSlider`      | client                     | Carousel from `@metrobet/ui`, autoplay, arrows, progress indicators   |
| `PromoBanner`      | slider slide + detail hero | `HeroBanner` (ui) + artwork + CTA. `href` = whole banner is a link    |
| `PromotionCard`    | `/promotions` grid         | Uses the mobile artwork, cropped to 16:9                              |
| `PromotionPicture` | inside the above           | `<picture>` art direction (desktop ≥768px / mobile) via getImageProps |

Placements: `home`, `sports`, `live`, `casino`, `crash`. Add a slider to a page with
`<PromotionsSlider placement="casino" />`.

## Autoplay

The active indicator pill's CSS fill animation (`animate-progress`, 6s) **is** the timer:
`onAnimationEnd` → `scrollNext()`. Pausing the animation pauses autoplay. It pauses on hover,
focus inside the slider, drag, and hidden tab. With `prefers-reduced-motion` the animation is
off, so autoplay is off too. Don't add a separate `setInterval`.

## Artwork rules (tell designers)

- **No text baked into images.** Title, subtitle and CTA are HTML: translated, accessible and
  editable in the backoffice. One image set serves ka/en/ru.
- Desktop **1600×500**, mobile **900×700**. Keep the subject on the **right ~45%** (desktop) /
  **top ~60%** (mobile); the opposite side sits under the text gradient.
- Desktop shows at 8:3 (sides crop slightly); mobile at 9:7. Cards crop the mobile art to 16:9
  from the top.
- Placeholder art (seed data) is SVG in `apps/web/public/promotions/` (site-relative paths).
  Uploaded art is an absolute URL from the api (`MEDIA_PUBLIC_URL`), allowed via
  `images.remotePatterns` in `next.config.ts`.

## Promotion page

`/promotions/[slug]` is not prerendered per slug (promotions change at runtime), so the page
awaits `params` inside `<Suspense>`. Because of streaming, an unknown/expired slug renders the
not-found UI with `noindex` but an HTTP 200. Acceptable for now. `content` is split into
paragraphs on blank lines and `terms` into list items on newlines. The CTA is hidden when
`ctaHref` is null.
