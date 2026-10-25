// OWNER: P3
import Link from 'next/link';
import { HomeBoard, NewsRail } from '@/components/kept/home';

export default function Home() {
  return (
    <>
      <section className="masthead">
        <h1>The public record of promises.</h1>
        <p className="masthead-lede">
          Paste a promise from the news. AI turns it into a yes-or-no question with a deadline, people back
          <b className="positive"> Kept</b> or <b className="negative">Broken</b> with test USDC, and the
          result is settled on Solana for anyone to check.
        </p>
        <p className="masthead-actions">
          <Link href="/create" className="primary button">
            Track a promise
          </Link>
          <Link href="/faucet" className="text-link">
            New here? Get 100 test USDC →
          </Link>
        </p>
      </section>

      <HomeBoard
        rail={
          <aside aria-labelledby="news-heading" className="rail">
            <h2 id="news-heading" className="section-title">
              In the news this week
            </h2>
            <p className="rail-note">
              Live from news search. Pick one to track; the AI checks it’s specific and dated before it can become
              a market.
            </p>
            <NewsRail />
          </aside>
        }
      />
    </>
  );
}
