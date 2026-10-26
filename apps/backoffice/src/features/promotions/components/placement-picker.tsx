'use client';

import { PROMOTION_PLACEMENTS, type PromotionPlacement } from '@metrobet/contracts';
import { Chip } from '@metrobet/ui';
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
            <Chip key={placement} selected={selected} onClick={() => toggle(placement)}>
              {selected && <Check />}
              {PLACEMENT_LABELS[placement]}
            </Chip>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
