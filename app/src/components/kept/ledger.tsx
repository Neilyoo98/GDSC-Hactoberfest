'use client';
// OWNER: P3
import Link from 'next/link';
import { useState } from 'react';
import { markets, type DemoMarket } from './demo';
export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${status.toLowerCase()}`}>● {status}</span>;
}
export function OddsBar({ market }: { market: DemoMarket }) {
  const total = market.kept + market.broken;
  const odds = total ? Math.round((market.kept / total) * 100) : 50;
  return (
    <div aria-live="polite">
      <div className="odds-label">
        <span className="positive">✓ Kept {odds}%</span>
        <span className="negative">✕ Broken {100 - odds}%</span>
      </div>
      <div className="odds">
        <span style={{ width: `${odds}%` }} />
      </div>
    </div>
  );
}
export function MarketCard({ market }: { market: DemoMarket }) {
  return (
    <article className="market-card">
      <div className="row card-heading">
        <Link href={`/promisers/${market.handle}`} className="promiser">
          {market.promiser}
        </Link>
        <StatusChip status={market.status} />
      </div>
      <Link href={`/markets/${market.id}`} className="quote">
        “{market.quote}”
      </Link>
      <p className="deadline">Deadline · {market.deadline}</p>
      <OddsBar market={market} />
    </article>
  );
}
export function MarketGrid() {
  const [filter, setFilter] = useState('All promises');
  const filtered = markets.filter(
    (m) =>
      filter === 'All promises' ||
      (filter === 'Resolving'
        ? ['Proposed', 'Council'].includes(m.status)
        : filter === 'Settled'
          ? m.status === 'Finalized'
          : m.status === 'Open'),
  );
  return (
    <>
      <div className="filter-row">
        <label className="sr-only" htmlFor="promise-filter">
          Filter promises
        </label>
        <select
          id="promise-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {['All promises', 'Open', 'Resolving', 'Settled'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid">
        {filtered.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </>
  );
}
export function StakePanel({ market }: { market: DemoMarket }) {
  const [side, setSide] = useState('kept');
  const [amount, setAmount] = useState(10);
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 100;
  const pool = market.kept + market.broken;
  const winning = side === 'kept' ? market.kept : market.broken;
  return (
    <aside className="panel">
      <p className="eyebrow">Your prediction</p>
      {market.status === 'Open' ? (
        <>
          <div className="choices">
            {['kept', 'broken'].map((s) => (
              <button
                key={s}
                aria-pressed={side === s}
                onClick={() => setSide(s)}
              >
                {s === 'kept' ? '✓ Kept' : '✕ Broken'}
              </button>
            ))}
          </div>
          <label>
            Amount · tUSDC
            <input
              type="number"
              min="1"
              max="100"
              value={amount}
              onChange={(e) => setAmount(e.target.valueAsNumber)}
            />
          </label>
          <small>1–100 tUSDC · One prediction per wallet</small>
          {valid ? (
            <p>
              Estimated return if correct{' '}
              <strong className="amount">
                {((amount * (pool + amount)) / (winning + amount)).toFixed(2)}{' '}
                <small>tUSDC</small>
              </strong>
            </p>
          ) : (
            <p role="alert">Enter an amount from 1 to 100.</p>
          )}
          <button className="primary" disabled>
            Connect wallet to predict
          </button>
          <p className="muted">
            Demo preview · Estimates change with the pool.
          </p>
        </>
      ) : (
        <>
          <h2>
            {market.status === 'Proposed'
              ? 'AI proposal pending review'
              : market.status === 'Council'
                ? 'Council reviewing'
                : 'Prediction closed'}
          </h2>
          <p>
            Resolution evidence and transactions will appear here when the chain
            client is connected.
          </p>
          <button disabled>
            {market.status === 'Finalized'
              ? 'Connect wallet to claim'
              : 'Awaiting integration'}
          </button>
        </>
      )}
      <Link className="text-link" href="/faucet">
        Get test tokens ↗
      </Link>
    </aside>
  );
}
