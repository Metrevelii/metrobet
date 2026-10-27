'use client';

import {
  type FieldErrors,
  type Locale,
  type LocalizedText,
  PROMO_BLOCKS_MAX,
  type PromoBlockType,
} from '@metrobet/contracts';
import {
  Alert,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  Textarea,
} from '@metrobet/ui';
import {
  AlignLeft,
  Disc3,
  ArrowDown,
  ArrowUp,
  CircleHelp,
  ListOrdered,
  type LucideIcon,
  Plus,
  ScrollText,
  Timer,
  Trash2,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';

import { WheelSettings } from './wheel-settings';
import {
  BLOCK_ITEMS,
  BLOCK_LABELS,
  type BlockWithItems,
  newBlock,
  type PromoBlockDraft,
} from '../form-state';

type TextFieldConfig = { key: string; label: string; multiline?: boolean; hint?: string };

const BLOCK_ICONS: Record<PromoBlockType, LucideIcon> = {
  optIn: UserPlus,
  countdown: Timer,
  steps: ListOrdered,
  richText: AlignLeft,
  prizes: Trophy,
  faq: CircleHelp,
  terms: ScrollText,
  wheel: Disc3,
};

const HEADING: TextFieldConfig = { key: 'title', label: 'Heading' };

/** The block's own text fields. */
const BLOCK_FIELDS: Record<PromoBlockType, TextFieldConfig[]> = {
  richText: [
    { key: 'title', label: 'Heading (optional)', hint: 'Leave empty in every language for none.' },
    { key: 'body', label: 'Text', multiline: true, hint: 'Separate paragraphs with a blank line.' },
  ],
  steps: [HEADING],
  countdown: [{ ...HEADING, hint: 'Counts down to the end date set in Schedule.' }],
  prizes: [HEADING],
  faq: [HEADING],
  terms: [{ key: 'body', label: 'Rules', multiline: true, hint: 'One rule per line.' }],
  optIn: [HEADING, { key: 'body', label: 'Text', multiline: true }],
  wheel: [HEADING],
};

/** Fields of each list item, for blocks that have items. */
const ITEM_FIELDS: Record<
  BlockWithItems,
  { noun: string; max: number; fields: TextFieldConfig[] }
> = {
  steps: {
    noun: 'step',
    max: 6,
    fields: [
      { key: 'title', label: 'Step title' },
      { key: 'text', label: 'Description', multiline: true },
    ],
  },
  prizes: {
    noun: 'prize',
    max: 50,
    fields: [
      { key: 'label', label: 'Place or tier', hint: 'e.g. 1st place, 4th–10th' },
      { key: 'prize', label: 'Prize', hint: 'e.g. 1,000 ₾, 50 free spins' },
    ],
  },
  faq: {
    noun: 'question',
    max: 50,
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', multiline: true },
    ],
  },
};

const hasItems = (block: PromoBlockDraft): block is Extract<PromoBlockDraft, { items: unknown }> =>
  block.type in ITEM_FIELDS;

type TextRecord = Record<string, LocalizedText>;

type LocalizedInputProps = {
  config: TextFieldConfig;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  locale: Locale;
  error?: string;
};

function LocalizedInput({ config, value, onChange, locale, error }: LocalizedInputProps) {
  const props = {
    value: value[locale],
    lang: locale,
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...value, [locale]: event.target.value }),
  };
  return (
    <Field label={config.label} error={error} hint={config.hint}>
      {config.multiline ? <Textarea rows={4} {...props} /> : <Input {...props} />}
    </Field>
  );
}

type BlockEditorProps = {
  block: PromoBlockDraft;
  path: string;
  locale: Locale;
  errors: FieldErrors;
  onChange: (block: PromoBlockDraft) => void;
};

function BlockEditor({ block, path, locale, errors, onChange }: BlockEditorProps) {
  const texts = block as unknown as TextRecord;
  const setText = (key: string, value: LocalizedText) =>
    onChange({ ...block, [key]: value } as PromoBlockDraft);

  return (
    <div className="flex flex-col gap-4">
      {BLOCK_FIELDS[block.type].map((config) => (
        <LocalizedInput
          key={config.key}
          config={config}
          value={texts[config.key]!}
          onChange={(value) => setText(config.key, value)}
          locale={locale}
          error={errors[`${path}.${config.key}.${locale}`]}
        />
      ))}
      {block.type === 'wheel' && (
        <WheelSettings block={block} path={path} errors={errors} onChange={onChange} />
      )}
      {hasItems(block) && (
        <ItemsEditor
          block={block}
          path={path}
          locale={locale}
          errors={errors}
          onChange={(items) => onChange({ ...block, items } as PromoBlockDraft)}
        />
      )}
    </div>
  );
}

function ItemsEditor({
  block,
  path,
  locale,
  errors,
  onChange,
}: Omit<BlockEditorProps, 'block' | 'onChange'> & {
  block: Extract<PromoBlockDraft, { items: unknown }>;
  onChange: (items: TextRecord[]) => void;
}) {
  const type = block.type as BlockWithItems;
  const { noun, max, fields } = ITEM_FIELDS[type];
  const items = block.items as TextRecord[];
  const listError = errors[`${path}.items`];

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {noun} {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={items.length === 1}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Remove ${noun} ${index + 1}`}
              >
                <X />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map((config) => (
                <LocalizedInput
                  key={config.key}
                  config={config}
                  value={item[config.key]!}
                  onChange={(value) =>
                    onChange(
                      items.map((it, i) => (i === index ? { ...it, [config.key]: value } : it)),
                    )
                  }
                  locale={locale}
                  error={errors[`${path}.items.${index}.${config.key}.${locale}`]}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {listError && <p className="text-xs text-destructive">{listError}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={items.length >= max}
        onClick={() => onChange([...items, BLOCK_ITEMS[type]() as unknown as TextRecord])}
      >
        <Plus /> Add {noun}
      </Button>
    </div>
  );
}

type PageBuilderProps = {
  blocks: PromoBlockDraft[];
  onChange: (blocks: PromoBlockDraft[]) => void;
  /** Language being edited (shared with the Content section). */
  locale: Locale;
  errors: FieldErrors;
};

/** The promotion page as an ordered list of blocks: add, edit, move and remove. */
export function PageBuilder({ blocks, onChange, locale, errors }: PageBuilderProps) {
  const hasOptIn = blocks.some((block) => block.type === 'optIn');

  const update = (index: number, block: PromoBlockDraft) =>
    onChange(blocks.map((current, i) => (i === index ? block : current)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...blocks];
    [next[index], next[index + by]] = [next[index + by]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {errors.blocks && <Alert variant="destructive">{errors.blocks}</Alert>}
      {blocks.length === 0 && (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          The page shows only the banner. Add blocks to build it.
        </p>
      )}
      {blocks.map((block, index) => {
        const Icon = BLOCK_ICONS[block.type];
        const path = `blocks.${index}`;
        return (
          <Card key={block.id} className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-semibold">{BLOCK_LABELS[block.type].label}</span>
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              <div className="ml-auto flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                  aria-label={`Remove ${BLOCK_LABELS[block.type].label} block`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            {errors[path] && <p className="text-xs text-destructive">{errors[path]}</p>}
            <BlockEditor
              block={block}
              path={path}
              locale={locale}
              errors={errors}
              onChange={(next) => update(index, next)}
            />
          </Card>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={blocks.length >= PROMO_BLOCKS_MAX}
          >
            <Plus /> Add block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {(Object.keys(BLOCK_LABELS) as PromoBlockType[]).map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <DropdownMenuItem
                key={type}
                disabled={type === 'optIn' && hasOptIn}
                onSelect={() => onChange([...blocks, newBlock(type)])}
                className="items-start gap-3"
              >
                <Icon className="mt-0.5 size-4 text-primary" />
                <span className="flex flex-col">
                  <span className="font-semibold">{BLOCK_LABELS[type].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {BLOCK_LABELS[type].description}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
