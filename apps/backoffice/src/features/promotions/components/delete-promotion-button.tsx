'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@metrobet/ui';
import { Trash2 } from 'lucide-react';

type DeletePromotionButtonProps = { title: string; disabled?: boolean; onConfirm: () => void };

export function DeletePromotionButton({ title, disabled, onConfirm }: DeletePromotionButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${title}`} disabled={disabled}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
        <AlertDialogDescription>
          “{title}” will be removed from the site immediately. This cannot be undone. To hide it
          temporarily, switch it off instead.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
