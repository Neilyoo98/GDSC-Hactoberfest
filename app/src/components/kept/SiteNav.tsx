'use client';
// OWNER: P3. Primary navigation with the current page marked.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Promises' },
  { href: '/bets', label: 'My Bets' },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="site-nav">
      {LINKS.map((l) => {
        const current = l.href === '/' ? path === '/' || path.startsWith('/markets') : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? 'page' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
