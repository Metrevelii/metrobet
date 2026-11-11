'use client';

import { type FieldErrors, type PromoBlockOf, toMajor, toMinor } from '@metrobet/contracts';
import { Field, Input } from '@metrobet/ui';

type DepositBonus = PromoBlockOf<'depositBonus'>;

type DepositBonusSettingsProps = {
  block: DepositBonus;
  path: string;
  errors: FieldErrors;
  onChange: (block: DepositBonus) => void;
};

/** A number field's value (0 when empty). */
const number = (value: string) => Number(value) || 0;

/** The offer's numbers: who qualifies, how much bonus money, and its wagering terms. */
export function DepositBonusSettings({ block, path, errors, onChange }: DepositBonusSettingsProps) {
  const error = (field: string) => errors[`${path}.${field}`];
  const example = Math.min((toMinor(100) * block.percent) / 100, block.maxBonus);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-dashed p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Minimum first deposit (₾)" error={error('minDeposit')}>
          <Input
            type="number"
            min={1}
            value={toMajor(block.minDeposit)}
            onChange={(event) =>
              onChange({ ...block, minDeposit: toMinor(number(event.target.value)) })
            }
          />
        </Field>
        <Field label="Bonus (% of the deposit)" error={error('percent')}>
          <Input
            type="number"
            min={1}
            max={300}
            value={block.percent}
            onChange={(event) => onChange({ ...block, percent: number(event.target.value) })}
          />
        </Field>
        <Field label="Maximum bonus (₾)" error={error('maxBonus')}>
          <Input
            type="number"
            min={1}
            value={toMajor(block.maxBonus)}
            onChange={(event) =>
              onChange({ ...block, maxBonus: toMinor(number(event.target.value)) })
            }
          />
        </Field>
        <Field
          label="Wagering (× the bonus)"
          hint="Casino bets count fully, sports tickets at odds 1.50+."
          error={error('wageringMultiplier')}
        >
          <Input
            type="number"
            min={1}
            max={50}
            value={block.wageringMultiplier}
            onChange={(event) =>
              onChange({ ...block, wageringMultiplier: number(event.target.value) })
            }
          />
        </Field>
        <Field label="Valid for (days)" error={error('validDays')}>
          <Input
            type="number"
            min={1}
            max={90}
            value={block.validDays}
            onChange={(event) => onChange({ ...block, validDays: number(event.target.value) })}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Example: a first deposit of 100 ₾ gets {toMajor(example)} ₾ bonus money, to wager{' '}
        {toMajor(example * block.wageringMultiplier)} ₾ within {block.validDays} days. Once per
        player, only on their first ever deposit, and never on top of another active bonus.
      </p>
    </div>
  );
}
