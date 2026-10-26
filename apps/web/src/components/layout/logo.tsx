import { Link } from '@/i18n/navigation';

export function Logo() {
  return (
    <Link href="/" className="text-xl font-black tracking-tight" aria-label="Metrobet">
      metro<span className="text-primary">bet</span>
    </Link>
  );
}
