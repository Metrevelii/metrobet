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
not-found UI with `noindex` but an HTTP 200. Acceptable for now. The banner CTA is hidden when
`ctaHref` is null. Below the banner, `PromoBlocks` renders the page's blocks in order.

## Blocks (`components/blocks/`)

| Block       | Renderer         | Notes                                                |
| ----------- | ---------------- | ---------------------------------------------------- |
| `richText`  | `RichTextBlock`  | optional heading; paragraphs split on blank lines    |
| `steps`     | `StepsBlock`     | numbered cards, up to 6                              |
| `countdown` | `CountdownBlock` | client `Countdown` to `endsAt`; dashes on the server |
| `prizes`    | `PrizesBlock`    | first 3 rows highlighted                             |
| `faq`       | `FaqBlock`       | native `<details>`, no JS                            |
| `terms`     | `TermsBlock`     | one rule per line + "valid until"                    |
| `optIn`     | `OptInBlock`     | join card; player state streams in (see below)       |

`promo-blocks.tsx` is the single `switch` over block types; TypeScript makes it exhaustive.

**Opt-in:** `OptInBlock` puts `OptInStatus` in its own `<Suspense>` (request-time: reads the
session cookie via `getEnrollment()`). `OptInButton` (client) shows "Log in to join" (→
`/login?next=…`), "Join" (Server Action `enrollInPromotion` in `actions.ts`), or "You're in". The
cached promotion itself never contains player data.

**Wheel:** `WheelBlock` (server) loads the game name (`getGame` from casino) and
`getWheelState()`, then renders `PromoWheel` (client). Spinning calls the `spinWheel` action;
the **server picks the segment**, the client only animates (`rotationFor`: 5 extra turns, lands
within the segment's middle 60%, 5 s, instant with reduced motion) and applies the new state when
the animation ends. `WheelGraphic` is plain SVG with theme `fill-*` classes. In development the
block shows **"Dev: simulate a bet"** (`simulateBet` action → `POST /api/dev/activity/casino-bet`
with one step's amount on the free-spins game). Joining via `OptInButton` calls
`router.refresh()` so mechanic blocks re-read the player's state.

## Adding a block type

1. Contracts (`promotions/blocks.ts`): add to `PROMO_BLOCK_TYPES`, a schema, a view schema and a
   `localizePromoBlock` case (+ any cross-field rule in `promotionInputSchema`).
2. Site: a renderer in `components/blocks/` + a case in `promo-blocks.tsx` (+ messages in all
   three locales for any fixed UI text).
3. Backoffice: `BLOCK_LABELS` + `newBlock` in `form-state.ts`, `BLOCK_ICONS` / `BLOCK_FIELDS`
   (and `ITEM_FIELDS` for lists) in `page-builder.tsx`.

No migration is needed: blocks live in one `jsonb` column. Interactive blocks also need a
mechanic in the API (see "Engine" in `apps/api/src/modules/promotions/CLAUDE.md`).
