'use client';

import {
  type Competition,
  SPORTS,
  toMajor,
  toMinor,
  type TradingRule,
  type TradingRuleScope,
} from '@metrobet/contracts';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@metrobet/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { dateTime, money } from '@/lib/format';

import { deleteRule, saveRule } from '../actions';

type Draft = {
  scope: TradingRuleScope;
  key: string;
  margin: string;
  maxStake: string;
  maxPayout: string;
};

const EMPTY: Draft = { scope: 'sport', key: 'football', margin: '', maxStake: '', maxPayout: '' };
const toDraft = (rule: TradingRule): Draft => ({
  scope: rule.scope,
  key: rule.key,
  margin: rule.margin?.toString() ?? '',
  maxStake: rule.maxStake === null ? '' : String(toMajor(rule.maxStake)),
  maxPayout: rule.maxPayout === null ? '' : String(toMajor(rule.maxPayout)),
});
/** Empty field → null (inherit); otherwise a number (NaN fails validation). */
const numberOrNull = (value: string, convert: (n: number) => number = (n) => n) =>
  value.trim() === '' ? null : convert(Number(value));

/** Margin and limit rules per sport or competition: list, edit, delete, add. */
export function TradingRules({
  rules,
  competitions,
  defaults,
}: {
  rules: TradingRule[];
  competitions: Competition[];
  defaults: { maxStake: number; maxPayout: number };
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (field: keyof Draft) => (value: string) => setDraft({ ...draft, [field]: value });

  const save = () =>
    startTransition(async () => {
      const result = await saveRule({
        scope: draft.scope,
        key: draft.key,
        margin: numberOrNull(draft.margin),
        maxStake: numberOrNull(draft.maxStake, toMinor),
        maxPayout: numberOrNull(draft.maxPayout, toMinor),
      });
      if (result.ok) {
        toast.success(`Rule for ${result.data.label} saved. Prices update at once.`);
        setDraft(EMPTY);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  const remove = (rule: TradingRule) =>
    startTransition(async () => {
      const result = await deleteRule(rule.scope, rule.key);
      if (result.ok) toast.success(`Rule for ${rule.label} removed.`);
      else toast.error(result.error);
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applies to</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Max stake</TableHead>
              <TableHead className="text-right">Max payout</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">Default (no rule)</TableCell>
              <TableCell className="text-right text-muted-foreground">Feed price</TableCell>
              <TableCell className="text-right text-muted-foreground tabular">
                {money(defaults.maxStake)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular">
                {money(defaults.maxPayout)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
            {rules.map((rule) => (
              <TableRow key={`${rule.scope}:${rule.key}`}>
                <TableCell>
                  <span className="font-semibold">{rule.label}</span>
                  <p className="text-xs text-muted-foreground">{rule.scope}</p>
                </TableCell>
                <TableCell className="text-right tabular">
                  {rule.margin === null ? 'inherit' : `${rule.margin}%`}
                </TableCell>
                <TableCell className="text-right tabular">
                  {rule.maxStake === null ? 'inherit' : money(rule.maxStake)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {rule.maxPayout === null ? 'inherit' : money(rule.maxPayout)}
                </TableCell>
                <TableCell className="text-muted-foreground">{dateTime(rule.updatedAt)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${rule.label}`}
                    onClick={() => setDraft(toDraft(rule))}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${rule.label}`}
                    disabled={pending}
                    onClick={() => remove(rule)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set a rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Field label="Scope">
              <NativeSelect
                value={draft.scope}
                onChange={(event) => {
                  const scope = event.target.value as TradingRuleScope;
                  setDraft({
                    ...draft,
                    scope,
                    key: scope === 'sport' ? 'football' : (competitions[0]?.id ?? ''),
                  });
                }}
              >
                <option value="sport">Sport</option>
                <option value="competition">Competition</option>
              </NativeSelect>
            </Field>
            <Field label={draft.scope === 'sport' ? 'Sport' : 'Competition'} error={errors.key}>
              <NativeSelect value={draft.key} onChange={(event) => set('key')(event.target.value)}>
                {draft.scope === 'sport'
                  ? SPORTS.map((sport) => (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    ))
                  : competitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.sport} · {competition.country} · {competition.name}
                      </option>
                    ))}
              </NativeSelect>
            </Field>
            <Field
              label="Margin %"
              hint="0–25. Empty keeps the feed's price."
              error={errors.margin}
            >
              <Input
                inputMode="decimal"
                value={draft.margin}
                onChange={(event) => set('margin')(event.target.value)}
              />
            </Field>
            <Field label="Max stake ₾" hint="Per ticket. Empty inherits." error={errors.maxStake}>
              <Input
                inputMode="decimal"
                value={draft.maxStake}
                onChange={(event) => set('maxStake')(event.target.value)}
              />
            </Field>
            <Field
              label="Max payout ₾"
              hint="Potential win per ticket. Empty inherits."
              error={errors.maxPayout}
            >
              <Input
                inputMode="decimal"
                value={draft.maxPayout}
                onChange={(event) => set('maxPayout')(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              A competition rule wins over its sport&apos;s, field by field. Accumulators get the
              strictest limits of their selections.
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save rule'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
