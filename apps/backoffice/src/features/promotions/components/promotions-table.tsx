'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Promotion } from '@metrobet/contracts';
import { Alert, Badge, Button, Card, cn, Switch } from '@metrobet/ui';
import { GripVertical, Megaphone, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';

import { resolveMediaUrl } from '@/lib/media';

import { deletePromotion, reorderPromotions, setPromotionActive } from '../actions';
import { CATEGORY_LABELS, PLACEMENT_LABELS } from '../form-state';
import { DeletePromotionButton } from './delete-promotion-button';
import { StatusBadge } from './status-badge';

const COLUMNS =
  'grid grid-cols-[2rem_7rem_1fr_auto] items-center gap-4 lg:grid-cols-[2rem_8rem_1fr_9rem_6rem_7rem]';

// Fixed zone so server and browser render identical text (and staff all see Tbilisi time).
const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tbilisi',
});
const format = (iso: string) => dateTime.format(new Date(iso));

function schedule({ startsAt, endsAt }: Promotion) {
  if (!startsAt && !endsAt) return 'Always on';
  if (startsAt && endsAt) return `${format(startsAt)} → ${format(endsAt)}`;
  return startsAt ? `From ${format(startsAt)}` : `Until ${format(endsAt!)}`;
}

type RowProps = {
  promotion: Promotion;
  busy: boolean;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
};

function PromotionRow({ promotion, busy, onToggle, onDelete }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: promotion.id });
  const title = promotion.title.en;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(COLUMNS, 'border-t bg-card px-4 py-3', isDragging && 'relative z-10 shadow-lg')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${title}`}
        className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* oxlint-disable-next-line nextjs/no-img-element -- admin thumbnail of arbitrary media URLs */}
      <img
        src={resolveMediaUrl(promotion.image.desktop)}
        alt=""
        className="aspect-16/5 w-full rounded-sm bg-muted object-cover"
      />

      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/promotions/${promotion.id}`}
          className="truncate font-semibold hover:underline"
        >
          {title}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">/{promotion.slug}</span>
          <span aria-hidden>·</span>
          <span>{CATEGORY_LABELS[promotion.category]}</span>
          <span aria-hidden>·</span>
          <span>{schedule(promotion)}</span>
        </div>
      </div>

      <div className="hidden flex-wrap gap-1 lg:flex">
        {promotion.placements.map((placement) => (
          <Badge key={placement}>{PLACEMENT_LABELS[placement]}</Badge>
        ))}
      </div>

      <div className="hidden lg:block">
        <StatusBadge promotion={promotion} />
      </div>

      <div className="flex items-center justify-end gap-1">
        <Switch
          checked={promotion.isActive}
          disabled={busy}
          onCheckedChange={onToggle}
          aria-label={`${promotion.isActive ? 'Switch off' : 'Switch on'} ${title}`}
          className="mr-2"
        />
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/promotions/${promotion.id}`} aria-label={`Edit ${title}`}>
            <Pencil />
          </Link>
        </Button>
        <DeletePromotionButton title={title} disabled={busy} onConfirm={onDelete} />
      </div>
    </li>
  );
}

/** Sortable promotions list. Order, on/off and deletes are applied optimistically. */
export function PromotionsTable({ promotions }: { promotions: Promotion[] }) {
  const [items, setItems] = useState(promotions);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Stable id keeps dnd-kit's generated aria ids identical on server and client (hydration).
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Applies `next` immediately, runs the action, and restores the previous list on failure. */
  const mutate = (
    next: Promotion[],
    action: () => Promise<{ ok: boolean; error?: string }>,
    id?: string,
  ) => {
    const previous = items;
    setItems(next);
    setError(null);
    setBusyId(id ?? null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setItems(previous);
        setError(result.error ?? 'Something went wrong.');
      }
      setBusyId(null);
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    const next = arrayMove(items, from, to);
    mutate(next, () => reorderPromotions(next.map((item) => item.id)));
  };

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Megaphone className="size-8 text-muted-foreground" />
        <p className="font-semibold">No promotions yet</p>
        <p className="text-sm text-muted-foreground">
          Create the first banner for the site slider.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="destructive">{error}</Alert>}
      <Card className="overflow-hidden">
        <div className={cn(COLUMNS, 'px-4 py-2 text-xs font-semibold text-muted-foreground')}>
          <span />
          <span>Banner</span>
          <span>Promotion</span>
          <span className="hidden lg:block">Placements</span>
          <span className="hidden lg:block">Status</span>
          <span className="text-right">Actions</span>
        </div>
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol>
              {items.map((promotion) => (
                <PromotionRow
                  key={promotion.id}
                  promotion={promotion}
                  busy={busyId === promotion.id}
                  onToggle={(isActive) =>
                    mutate(
                      items.map((item) =>
                        item.id === promotion.id ? { ...item, isActive } : item,
                      ),
                      () => setPromotionActive(promotion.id, isActive),
                      promotion.id,
                    )
                  }
                  onDelete={() =>
                    mutate(
                      items.filter((item) => item.id !== promotion.id),
                      () => deletePromotion(promotion.id),
                      promotion.id,
                    )
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </Card>
      <p className="text-xs text-muted-foreground">
        Drag rows (or focus the handle and use Space + arrow keys) to change the slider order.
        Changes go live on the site within seconds.
      </p>
    </div>
  );
}
