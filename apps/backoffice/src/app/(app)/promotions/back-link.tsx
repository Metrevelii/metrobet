import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export function BackToPromotions() {
  return (
    <Link
      href="/promotions"
      className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      Promotions
    </Link>
  );
}
