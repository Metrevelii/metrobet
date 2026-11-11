'use client';

import { Chip, Input } from '@metrobet/ui';
import { useFormatter } from 'next-intl';

type AmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  presets: number[];
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/** ₾ amount field with quick-pick chips (major units). Props come from `Field`. */
export function AmountInput({ value, onChange, presets, ...field }: AmountInputProps) {
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          {...field}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          className="h-12 pr-8 text-lg font-semibold tabular"
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">₾</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Chip
            key={preset}
            selected={Number(value) === preset}
            onClick={() => onChange(String(preset))}
          >
            {format.number(preset, {
              style: 'currency',
              currency: 'GEL',
              maximumFractionDigits: 0,
            })}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Major-unit text → minor units, or null when it isn't a positive amount. */
export function parseAmount(value: string): number | null {
  const major = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(major) && major > 0
    ? Math.round(major * 100)
    : null;
}
