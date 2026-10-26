# Promotions (backoffice)

Manage the site's promo banners: list, reorder, switch on/off, delete, create and edit.

## Screens

- `/promotions`: `PromotionsTable`. Drag the grip (or focus it, then Space + arrows) to reorder;
  order here = slider order on the site. The switch toggles `isActive`; status badge shows
  live/scheduled/expired/off. All three are optimistic with rollback + error alert.
- `/promotions/new`, `/promotions/[id]`: `PromotionForm`. Sections: General (slug, category,
  CTA link, placements), Content (ka/en/ru tabs; red dot = errors in that language), Artwork
  (upload desktop 1600×500 + mobile 900×700), Schedule & visibility. Sticky **live preview**
  renders the real `HeroBanner` (desktop + mobile) at site size, scaled to fit.

## Flow

```
PromotionForm (client draft) → promotionInputSchema check → savePromotion (Server Action,
re-validates) → adminFetch → api → audit + site revalidation → router.push('/promotions')
```

- `form-state.ts`: `PromotionDraft` (input-friendly strings) ⇄ `PromotionInput`
  (`draftToInput` / `draftFromPromotion`), labels, `slugify` (auto-fills from the English title
  until the slug is edited by hand).
- Schedule inputs are `datetime-local` in the editor's browser time zone, converted to ISO UTC.
- Field errors use dotted paths from Zod (`title.ka`, `image.desktop`) for both client and
  server validation.
- Uploads: `ImageField` → `uploadPromotionImage` (Server Action) → `POST /api/admin/media/promotions`.
  Only raster images; the API checks magic bytes.

## Adding a field

1. `promotionSchema` / `promotionInputSchema` in contracts.
2. API: `promotions.schema.ts` column + `db:generate`, repository mapping (`toPromotion` / `toRow`).
3. Here: `PromotionDraft` + `emptyDraft` + form input (+ preview if visible on the banner).
4. Site: `PromotionCard` / `PromotionDetail` mapping in the api mapper, then the web component.
