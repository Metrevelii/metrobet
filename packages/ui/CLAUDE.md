# @metrobet/ui: design system

Shared, design-level React components and the theme layer, used by `apps/web` and
`apps/backoffice`. Exported as TypeScript source; Next.js (Turbopack) compiles it directly,
so there is no build step.

## Exports

| Import                    | What                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `@metrobet/ui`            | components (see below), `cn()`                                        |
| `@metrobet/ui/styles.css` | the only stylesheet an app imports (Tailwind + tokens + theme)        |
| `@metrobet/ui/fonts`      | `fontVariables`: put on `<html className>`; loads fonts via next/font |

Components: `Alert`, `AlertDialog*`, `Badge`, `Button`, `Card*`, `Carousel*`, `Chip`, `HeroBanner`,
`Input`, `Label`, `NativeSelect`, `Sheet*` (bottom sheet), `Skeleton`, `Switch`, `Tabs*`, `Textarea`.

- `HeroBanner`: artwork + scrim + badge/title/subtitle/action. `layout`: `responsive` (site),
  `desktop` / `mobile` (fixed, e.g. backoffice previews). Aspect classes in `heroBannerAspect`.
  The site's promo slider and the backoffice preview both render it, so they never drift.
- `Chip`: pill filter/toggle (`selected`); as a button it sets `aria-pressed`, with `asChild` it
  styles links (set `aria-current`). Used by casino categories and backoffice pickers.
- Form controls show the error style via `aria-invalid` (the backoffice `Field` sets it).

## How theming works

There are three layers. Only the last one knows what anything looks like.

1. **Components** use semantic Tailwind utilities only: `bg-card`, `text-muted-foreground`,
   `border-border`, `bg-primary text-primary-foreground`, `text-odds-up`, `rounded-lg`, `shadow-glow`.
2. **`src/styles/tokens.css`** is the contract. It maps Tailwind theme keys to `--mb-*` CSS
   variables (`--color-card: var(--mb-card)`). It also **disables Tailwind's default palette**
   (`--color-*: initial`), so raw colors like `bg-zinc-900` cannot sneak in. It is design-agnostic
   and rarely changes. Token names follow shadcn/ui, so shadcn components can be copied in as-is.
3. **`src/themes/<name>.css`** holds the actual values: `--mb-*` for `[data-mode='dark']`
   (also `:root`) and `[data-mode='light']`, plus radii and font stacks.

Current theme: **`midnight-pro.css`** (near-black navy, electric lime `#c6ff3d`, green/red odds).

### Changing the design (keep this cheap)

1. Copy `src/themes/midnight-pro.css` to `src/themes/<new-name>.css` and change the values.
   Every `--mb-*` variable must be defined for both modes.
2. Switch the theme import in `src/styles/index.css`.
3. If the new design uses different fonts, change `src/fonts.ts` (keep the CSS variable names).
4. Nothing in `apps/*` should need to change. If it does, a component is breaking the token rule:
   fix that component.

### Adding a token

Add `--mb-<name>` to **every** theme file (both modes), map it in `tokens.css`
(`--color-<name>: var(--mb-<name>)`), then use it as `bg-<name>` / `text-<name>`. Add domain
tokens (like `odds-up`, `live`) only when a color carries meaning, not for one-off decoration.

## Component rules

- One component per file in `src/components/`, re-exported from `src/index.ts`.
- React 19 style: `ref` is a normal prop, no `forwardRef`. Props extend `ComponentProps<'el'>`
  and spread the rest onto the element.
- Variants go through `cva`; always merge `className` last with `cn()` so callers can override.
- Interactive primitives (dialog, dropdown, tabs, tooltip…) wrap Radix from `radix-ui`.
  `asChild` uses `Slot.Root`.
- Accessible by default: real `<button>`s, visible `focus-visible` ring (global, from the
  theme's `--mb-ring`), labelled icon-only buttons.
- **Nothing product-specific here.** No odds, bets or games. Those belong in
  `apps/web/src/features/*`. Belongs here: anything the backoffice could also use.
- `Carousel` (Embla): compose `Carousel` > `CarouselContent` > `CarouselItem`, plus
  `CarouselPrevious/Next` (pass a translated `label`). Build custom indicators with
  `useCarousel()` (`selectedIndex`, `slideCount`, `scrollTo`, `api`…). Arrow keys work out of the box.
- Animation tokens: `animate-flash` (one-shot fade; re-key the element to replay, e.g. odds
  changes) and `animate-progress` fills an element left→right once over
  `--progress-duration` (set inline). Respect `motion-reduce:` variants.
- Utilities: `tabular` (tabular numerals, for odds, balances and timers) and `bg-glow` (primary-tinted hero
  glow) are defined in `src/styles/index.css`.
