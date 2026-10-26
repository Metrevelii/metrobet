'use client';

import {
  LOCALES,
  type Locale,
  type LocalizedText,
  PROMOTION_CATEGORIES,
  type Promotion,
  type PromotionCategory,
  promotionInputSchema,
} from '@metrobet/contracts';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@metrobet/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';

import { Field } from '@/components/field';
import { type FieldErrors, toFieldErrors } from '@/lib/form-errors';

import { savePromotion } from '../actions';
import {
  CATEGORY_LABELS,
  draftFromPromotion,
  draftToInput,
  emptyDraft,
  LOCALE_LABELS,
  type LocalizedField,
  type PromotionDraft,
  slugify,
} from '../form-state';
import { BannerPreview } from './banner-preview';
import { ImageField } from './image-field';
import { PlacementPicker } from './placement-picker';
import { StatusBadge } from './status-badge';

const LOCALIZED_INPUTS: { field: LocalizedField; label: string; multiline?: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'subtitle', label: 'Subtitle' },
  { field: 'ctaLabel', label: 'Button label' },
  { field: 'content', label: 'Page content', multiline: 'Separate paragraphs with a blank line.' },
  { field: 'terms', label: 'Terms & conditions', multiline: 'One rule per line.' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/** Create/edit form with a live preview of the site banner in every language. */
export function PromotionForm({ promotion }: { promotion?: Promotion }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PromotionDraft>(() =>
    promotion ? draftFromPromotion(promotion) : emptyDraft(),
  );
  const [slugEdited, setSlugEdited] = useState(Boolean(promotion));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>('ka');
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setLocalized = (field: LocalizedField, lang: Locale, value: string) =>
    setDraft((current) => {
      const next = { ...current, [field]: { ...current[field], [lang]: value } as LocalizedText };
      if (field === 'title' && lang === 'en' && !slugEdited) next.slug = slugify(value);
      return next;
    });

  const localeHasErrors = (lang: Locale) =>
    Object.keys(errors).some((key) => key.endsWith(`.${lang}`));

  const submit = () => {
    const input = draftToInput(draft);
    const parsed = promotionInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await savePromotion(promotion?.id ?? null, parsed.data);
      if (result.ok) {
        router.push('/promotions');
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_480px]"
    >
      <div className="flex flex-col gap-6">
        {formError && <Alert variant="destructive">{formError}</Alert>}

        <Section title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Slug (URL)"
              error={errors.slug}
              hint="Lowercase letters, numbers and dashes."
            >
              <Input
                value={draft.slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  set('slug', event.target.value);
                }}
                placeholder="welcome-bonus"
              />
            </Field>
            <Field label="Category" error={errors.category}>
              <NativeSelect
                value={draft.category}
                onChange={(event) => set('category', event.target.value as PromotionCategory)}
              >
                {PROMOTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field
            label="Button link (optional)"
            error={errors.ctaHref}
            hint="Leave empty to open the promotion page. Use a site path like /sports, or https://…"
          >
            <Input
              value={draft.ctaHref}
              onChange={(event) => set('ctaHref', event.target.value)}
              placeholder="/sports"
            />
          </Field>
          <PlacementPicker
            value={draft.placements}
            onChange={(value) => set('placements', value)}
            error={errors.placements}
          />
        </Section>

        <Section title="Content">
          <Tabs value={locale} onValueChange={(value) => setLocale(value as Locale)}>
            <TabsList>
              {LOCALES.map((lang) => (
                <TabsTrigger key={lang} value={lang}>
                  {LOCALE_LABELS[lang]}
                  {localeHasErrors(lang) && (
                    <span
                      className="size-1.5 rounded-full bg-destructive"
                      aria-label="has errors"
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCALES.map((lang) => (
              <TabsContent key={lang} value={lang} className="mt-4 flex flex-col gap-4" lang={lang}>
                {LOCALIZED_INPUTS.map(({ field, label, multiline }) => {
                  const props = {
                    value: draft[field][lang],
                    onChange: (event: { target: { value: string } }) =>
                      setLocalized(field, lang, event.target.value),
                  };
                  return (
                    <Field
                      key={field}
                      label={label}
                      error={errors[`${field}.${lang}`]}
                      hint={multiline}
                    >
                      {multiline ? (
                        <Textarea rows={field === 'content' ? 6 : 4} {...props} />
                      ) : (
                        <Input {...props} />
                      )}
                    </Field>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        </Section>

        <Section title="Artwork">
          <p className="text-sm text-muted-foreground">
            No text in images: title, subtitle and button are added by the site in each language.
            Keep the subject on the right (desktop) or at the top (mobile).
          </p>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <ImageField
              label="Desktop"
              size="1600×500"
              aspectClassName="aspect-16/5"
              value={draft.image.desktop}
              onChange={(desktop) => set('image', { ...draft.image, desktop })}
              error={errors['image.desktop']}
            />
            <ImageField
              label="Mobile"
              size="900×700"
              aspectClassName="aspect-9/7"
              value={draft.image.mobile}
              onChange={(mobile) => set('image', { ...draft.image, mobile })}
              error={errors['image.mobile']}
            />
          </div>
        </Section>

        <Section title="Schedule & visibility">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Starts"
              error={errors.startsAt}
              hint="Empty = immediately. Your local time."
            >
              <Input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </Field>
            <Field label="Ends" error={errors.endsAt} hint="Empty = no end date.">
              <Input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(event) => set('endsAt', event.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="promotion-active" className="text-sm text-foreground">
                Active
              </Label>
              <span className="text-xs text-muted-foreground">
                Off hides it everywhere, regardless of the schedule.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge promotion={draftToInput(draft)} />
              <Switch
                id="promotion-active"
                checked={draft.isActive}
                onCheckedChange={(value) => set('isActive', value)}
              />
            </div>
          </div>
        </Section>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/promotions">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : promotion ? 'Save changes' : 'Create promotion'}
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-3 xl:sticky xl:top-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Preview</h2>
          <span className="text-xs text-muted-foreground">{LOCALE_LABELS[locale]}</span>
        </div>
        <BannerPreview draft={draft} locale={locale} layout="desktop" />
        <div className="flex items-end gap-3">
          <BannerPreview draft={draft} locale={locale} layout="mobile" className="w-1/2" />
          <p className="flex-1 text-xs text-muted-foreground">
            Desktop and mobile as they appear in the site slider. Switch the language in Content.
          </p>
        </div>
      </aside>
    </form>
  );
}
