// OWNER: P3
import type { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Mono, Newsreader } from 'next/font/google';
import './globals.css';
import './redesign.css';
import { Providers } from '@/wallet/Providers';
import { ConnectWallet } from '@/wallet/ConnectWallet';
import { SiteNav } from '@/components/kept/SiteNav';

// Serif for headlines and quoted promises; mono for numbers, dates and addresses.
const display = Newsreader({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Kept — A public record of promises',
  description: 'Follow public promises, back Kept or Broken with test USDC, and inspect the evidence.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header className="site-header">
            <Link href="/" className="brand" aria-label="Kept, home">
              kept<span className="brand-dot">.</span>
            </Link>
            <SiteNav />
            <div className="header-actions">
              <ConnectWallet />
              <Link className="primary button" href="/create">
                Track a promise
              </Link>
            </div>
          </header>
          <main id="main">{children}</main>
          <footer className="site-footer">
            <span>Kept · Solana devnet · test tokens only, no real money</span>
            <span className="mono">program GYupVpsM…7gap</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
