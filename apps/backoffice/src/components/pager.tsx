import { Button } from '@metrobet/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type PagerProps = {
  page: number;
  total: number;
  pageSize: number;
  /** URL of a page (keeps the current filters). */
  href: (page: number) => string;
};

/** Previous / next links with "page x of y · n results". Renders nothing for a single page. */
export function Pager({ page, total, pageSize, href }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = (target: number, label: string, icon: 'prev' | 'next') => {
    const disabled = target < 1 || target > pages;
    const content = (
      <>
        {icon === 'prev' && <ChevronLeft />}
        {label}
        {icon === 'next' && <ChevronRight />}
      </>
    );
    return (
      <Button variant="outline" size="sm" disabled={disabled} asChild={!disabled}>
        {disabled ? <span>{content}</span> : <Link href={href(target)}>{content}</Link>}
      </Button>
    );
  };
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pages">
      {link(page - 1, 'Previous', 'prev')}
      <span className="text-xs text-muted-foreground">
        Page {page} of {pages} · {total} results
      </span>
      {link(page + 1, 'Next', 'next')}
    </nav>
  );
}
