// OWNER: P3
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from '@/wallet/Providers';
export const metadata: Metadata = {
  title: 'Kept — A public record of promises',
  description:
    'Follow public promises, compare predictions, and inspect the evidence.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header>
            <Link href="/" className="brand">
              kept<span className="brand-dot">.</span>
            </Link>
            <span className="demo-label">Demo / Test tokens only</span>
            <Link className="primary button" href="/create">
              + Add a promise
            </Link>
          </header>
          <main id="main">{children}</main>
          <footer>
            <span>A promise deserves a follow-up.</span>
            <nav aria-label="More pages">
              <Link href="/faucet">Test tokens</Link>
              <Link href="/council">Council</Link>
              <Link href="/leaderboard">Forecasters</Link>
            </nav>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
