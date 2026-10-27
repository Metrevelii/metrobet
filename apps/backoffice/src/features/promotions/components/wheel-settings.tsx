'use client';

import {
  type FieldErrors,
  GAME_TYPES,
  type GameCard,
  type GameType,
  type PromoBlockOf,
  toMajor,
  toMinor,
  WHEEL_SEGMENTS_MAX,
  WHEEL_SEGMENTS_MIN,
} from '@metrobet/contracts';
import { Button, Chip, Field, Input } from '@metrobet/ui';
import { Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { searchSlotGames } from '../actions';

type Wheel = PromoBlockOf<'wheel'>;

const GAME_TYPE_LABELS: Record<GameType, string> = {
  slot: 'Slots',
  crash: 'Crash',
  table: 'Table',
};

const SEARCH_DELAY_MS = 250;

/** Suggests slot games by name while typing; the value is the game's slug. */
function FreeSpinsGameField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (slug: string) => void;
  error?: string;
}) {
  const listId = useId();
  const [games, setGames] = useState<GameCard[]>([]);

  useEffect(() => {
    if (value.trim().length < 2) return;
    let current = true;
    const timer = setTimeout(async () => {
      const found = await searchSlotGames(value);
      if (current) setGames(found);
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div>
      <Field
        label="Free spins game"
        error={error}
        hint="Type a slot name and pick it. Stored as the game's slug."
      >
        <Input
          value={value}
          list={listId}
          autoComplete="off"
          placeholder="sweet-bonanza"
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <datalist id={listId}>
        {games.map((game) => (
          <option key={game.slug} value={game.slug}>
            {`${game.name} · ${game.provider.name}`}
          </option>
        ))}
      </datalist>
    </div>
  );
}

type WheelSettingsProps = {
  block: Wheel;
  path: string;
  errors: FieldErrors;
  onChange: (block: Wheel) => void;
};

/** Wheel mechanic settings: how spins are earned, the prize game and the segments. */
export function WheelSettings({ block, path, errors, onChange }: WheelSettingsProps) {
  const { earn, segments } = block;
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  const error = (field: string) => errors[`${path}.${field}`];

  const setEarn = (next: Partial<Wheel['earn']>) =>
    onChange({ ...block, earn: { ...earn, ...next } });
  const setSegment = (index: number, next: Partial<Wheel['segments'][number]>) =>
    onChange({
      ...block,
      segments: segments.map((segment, i) => (i === index ? { ...segment, ...next } : segment)),
    });
  const toggleType = (type: GameType) =>
    setEarn({
      gameTypes: earn.gameTypes.includes(type)
        ? earn.gameTypes.filter((item) => item !== type)
        : GAME_TYPES.filter((item) => item === type || earn.gameTypes.includes(item)),
    });

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Wager per spin (₾)"
          error={error('earn.stepAmount')}
          hint="e.g. 50 = one spin per 50 ₾ wagered, 100 ₾ = two."
        >
          <Input
            type="number"
            min={0.01}
            step={0.01}
            inputMode="decimal"
            value={earn.stepAmount ? toMajor(earn.stepAmount) : ''}
            onChange={(event) => setEarn({ stepAmount: toMinor(Number(event.target.value) || 0) })}
          />
        </Field>
        <FreeSpinsGameField
          value={block.freeSpinsGame}
          onChange={(freeSpinsGame) => onChange({ ...block, freeSpinsGame })}
          error={error('freeSpinsGame')}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">
          Wagers that count
        </legend>
        <div className="flex flex-wrap gap-2">
          {GAME_TYPES.map((type) => {
            const selected = earn.gameTypes.includes(type);
            return (
              <Chip key={type} selected={selected} onClick={() => toggleType(type)}>
                {selected && <Check />}
                {GAME_TYPE_LABELS[type]}
              </Chip>
            );
          })}
        </div>
        {error('earn.gameTypes') && (
          <p className="text-xs text-destructive">{error('earn.gameTypes')}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_4rem_2rem] items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>#</span>
          <span>Free spins</span>
          <span>Weight</span>
          <span className="text-right">Chance</span>
          <span />
        </div>
        <ol className="flex flex-col gap-2">
          {segments.map((segment, index) => {
            const rowError =
              error(`segments.${index}.freeSpins`) ?? error(`segments.${index}.weight`);
            return (
              <li key={index} className="flex flex-col gap-1">
                <div className="grid grid-cols-[2rem_1fr_1fr_4rem_2rem] items-center gap-2">
                  <span className="text-xs text-muted-foreground">{index + 1}</span>
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Segment ${index + 1} free spins`}
                    aria-invalid={Boolean(error(`segments.${index}.freeSpins`)) || undefined}
                    value={segment.freeSpins || ''}
                    onChange={(event) =>
                      setSegment(index, { freeSpins: Math.trunc(Number(event.target.value)) })
                    }
                  />
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Segment ${index + 1} weight`}
                    aria-invalid={Boolean(error(`segments.${index}.weight`)) || undefined}
                    value={segment.weight || ''}
                    onChange={(event) =>
                      setSegment(index, { weight: Math.trunc(Number(event.target.value)) })
                    }
                  />
                  <span className="text-right text-sm tabular-nums">
                    {totalWeight > 0
                      ? `${((segment.weight / totalWeight) * 100).toFixed(1)}%`
                      : '–'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={segments.length <= WHEEL_SEGMENTS_MIN}
                    onClick={() =>
                      onChange({ ...block, segments: segments.filter((_, i) => i !== index) })
                    }
                    aria-label={`Remove segment ${index + 1}`}
                  >
                    <X />
                  </Button>
                </div>
                {rowError && <p className="pl-10 text-xs text-destructive">{rowError}</p>}
              </li>
            );
          })}
        </ol>
        {error('segments') && <p className="text-xs text-destructive">{error('segments')}</p>}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={segments.length >= WHEEL_SEGMENTS_MAX}
            onClick={() =>
              onChange({ ...block, segments: [...segments, { freeSpins: 10, weight: 100 }] })
            }
          >
            <Plus /> Add segment
          </Button>
          <span className="text-xs text-muted-foreground">
            Chance = weight ÷ total weight. Players never see the weights.
          </span>
        </div>
      </div>
    </div>
  );
}
