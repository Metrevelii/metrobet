import { Card } from '@metrobet/ui';
import { Lock } from 'lucide-react';

/** Shown instead of a screen the staff member's role can't use (the API refuses it anyway). */
export function NoAccess({ roles }: { roles: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <p className="font-semibold">No access</p>
      <p className="text-sm text-muted-foreground">This screen is for {roles}.</p>
    </Card>
  );
}
