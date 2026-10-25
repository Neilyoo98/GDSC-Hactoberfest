'use client';
// OWNER: P3. Primary navigation with the current page marked.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Promises' },
  { href: '/council', label: 'Council' },
  { href: '/leaderboard', label: 'Forecasters' },
  { href: '/faucet', label: 'Get tUSDC' },
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
