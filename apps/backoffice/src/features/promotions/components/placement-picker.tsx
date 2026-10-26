'use client';

import { PROMOTION_PLACEMENTS, type PromotionPlacement } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { Check } from 'lucide-react';

import { PLACEMENT_LABELS } from '../form-state';

type PlacementPickerProps = {
  value: PromotionPlacement[];
  onChange: (value: PromotionPlacement[]) => void;
  error?: string;
};

/** Pages whose slider shows this promotion. */
export function PlacementPicker({ value, onChange, error }: PlacementPickerProps) {
  const toggle = (placement: PromotionPlacement) =>
    onChange(
      value.includes(placement)
        ? value.filter((item) => item !== placement)
        : PROMOTION_PLACEMENTS.filter((item) => item === placement || value.includes(item)),
    );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">Show on</legend>
      <div className="flex flex-wrap gap-2">
        {PROMOTION_PLACEMENTS.map((placement) => {
          const selected = value.includes(placement);
          return (
            <button
              key={placement}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(placement)}
              className={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {selected && <Check className="size-3.5" />}
              {PLACEMENT_LABELS[placement]}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
