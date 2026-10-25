'use client';
// OWNER: P3. "Share your call on X" after a prediction is confirmed.
import { useState, useSyncExternalStore } from 'react';
import type { MarketView, Side } from '@/shared/types';

const X_URL_LENGTH = 23; // X counts every link as 23 characters
const X_LIMIT = 280;
const subscribe = () => () => {};

/** Public base for shared links: NEXT_PUBLIC_SITE_URL (deployed/tunnel URL) or the current origin. */
const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/u, '');

export function shareText(
  market: Pick<MarketView, 'promiser' | 'promiseText' | 'deadline'>,
  side: Side,
  amount: number,
  confirmed = false,
) {
  const due = new Date(market.deadline * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const call = side === 'kept' ? 'Kept' : 'Broken';
  const head = confirmed
    ? `I backed ${call} with ${amount} tUSDC: will ${market.promiser} keep this promise?`
    : `My current pick is ${call} for ${amount} tUSDC: will ${market.promiser} keep this promise?`;
  const tail = `Due ${due}. Make your call on Kept:`;
  // Leave room for the link (+1 space) and trim the quote to fit.
  const room = X_LIMIT - X_URL_LENGTH - 1 - head.length - tail.length - 6;
  const quote = market.promiseText.length > room ? `${market.promiseText.slice(0, Math.max(0, room - 1)).trimEnd()}…` : market.promiseText;
  return `${head} “${quote}” ${tail}`;
}

export function ShareBet({
  market,
  side,
  amount,
  confirmed = false,
}: {
  market: MarketView;
  side: Side;
  amount: number;
  confirmed?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const base = useSyncExternalStore(subscribe, siteBase, () => '');
  if (!base) return null;
  const url = `${base}/markets/${market.id}`;
  const intent = `https://x.com/intent/post?${new URLSearchParams({ text: shareText(market, side, amount, confirmed), url })}`;
  return (
    <div className="share-bet">
      <p className="share-bet-title">
        {confirmed ? 'Your call is on the record.' : 'Share your selected pick.'}
      </p>
      {!confirmed && <p className="share-bet-note">Sharing a pick doesn’t place a bet.</p>}
      <div className="share-bet-actions">
        <a className="button share-x" href={intent} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      {base.includes('localhost') && (
        <p className="rail-note">This link points to your local server; set NEXT_PUBLIC_SITE_URL to a public URL before sharing.</p>
      )}
    </div>
  );
}
