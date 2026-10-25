'use client';
// OWNER: P3
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MarketView, Outcome, Side } from '@/shared/types';
import { useMarkets, useKeptActions, usePositions } from '@/chain/hooks';
import { ConnectWallet } from '@/wallet/ConnectWallet';
import { ShareBet } from './ShareBet';

const handleFor = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  proposed: 'AI proposed',
  challenged: 'Challenged',
  council: 'Council review',
  finalized: 'Settled',
  void: 'Void · refunded',
};
export function StatusChip({ status }: { status: string }) {
  const key = status.toLowerCase();
  return <span className={`chip ${key}`}>{STATUS_LABEL[key] ?? status}</span>;
}

/** Markets created by scripts/smoke-devnet.ts on the shared devnet config; not shown to visitors. */
export const isListed = (m: MarketView) => m.promiser !== '@SmokeTest';
export function OddsBar({ market }: { market: MarketView }) {
  const total = market.totals.kept + market.totals.broken;
  const odds = total ? Math.round((market.totals.kept / total) * 100) : 50;
  return (
    <div aria-live="polite">
      <div className="odds-label">
        <span className="positive">✓ Kept {odds}% · {market.totals.kept} tUSDC</span>
        <span className="negative">✕ Broken {100 - odds}% · {market.totals.broken} tUSDC</span>
      </div>
      <div className="odds">
        <span style={{ width: `${odds}%` }} />
      </div>
    </div>
  );
}
export function MarketCard({ market }: { market: MarketView }) {
  const handle = handleFor(market.promiser);
  return (
    <article className="market-card">
      <div className="row card-heading">
        <Link href={`/promisers/${handle}`} className="promiser">
          {market.promiser}
        </Link>
        <StatusChip status={market.status} />
      </div>
      <Link href={`/markets/${market.id}`} className="quote">
        “{market.promiseText}”
      </Link>
      <p className="deadline">Deadline · {new Date(market.deadline * 1000).toLocaleDateString()}</p>
      <OddsBar market={market} />
    </article>
  );
}
/** One promise as a ledger row: who, what, when, and where the money sits. */
export function LedgerRow({ market }: { market: MarketView }) {
  const total = market.totals.kept + market.totals.broken;
  const kept = total ? Math.round((market.totals.kept / total) * 100) : null;
  const settled = market.status === 'finalized' || market.status === 'void';
  return (
    <li className="ledger-row">
      <div className="ledger-main">
        <p className="ledger-meta">
          <Link href={`/promisers/${handleFor(market.promiser)}`}>{market.promiser}</Link>
          <StatusChip status={market.status} />
        </p>
        <Link href={`/markets/${market.id}`} className="ledger-quote">
          “{market.promiseText}”
        </Link>
        <p className="ledger-deadline">
          due <time dateTime={new Date(market.deadline * 1000).toISOString()}>
            {new Date(market.deadline * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </time>
        </p>
      </div>
      <div className="ledger-odds" aria-label={kept === null ? 'No predictions yet' : `${kept}% Kept, ${100 - kept}% Broken, ${total} tUSDC staked`}>
        {settled && market.final ? (
          <p className={`ledger-result ${market.final}`}>{market.final === 'kept' ? '✓ Kept' : market.final === 'broken' ? '✕ Broken' : '○ Void'}</p>
        ) : kept === null ? (
          <p className="ledger-empty">No predictions yet</p>
        ) : (
          <>
            <p className="ledger-pct">
              <span className="positive">{kept}%</span> kept
            </p>
            <div className="odds" aria-hidden="true">
              <span style={{ width: `${kept}%` }} />
            </div>
          </>
        )}
        <p className="ledger-pool">{total.toLocaleString('en-US')} tUSDC</p>
      </div>
    </li>
  );
}

const FILTERS = ['All', 'Open', 'Resolving', 'Settled'] as const;
/** Fetches on its own. On the home page use MarketList with shared data instead (one RPC poll, not two). */
export function MarketGrid() {
  const { data, error, loading } = useMarkets();
  return <MarketList markets={data} error={error} loading={loading} />;
}
export function MarketList({
  markets,
  error,
  loading,
}: {
  markets: MarketView[] | undefined;
  error: Error | null;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const filtered = (markets ?? []).filter(isListed).filter((m) =>
    filter === 'All' ||
    (filter === 'Resolving'
      ? ['proposed', 'challenged', 'council'].includes(m.status)
      : filter === 'Settled'
        ? ['finalized', 'void'].includes(m.status)
        : m.status === 'open'),
  );
  return (
    <>
      <div className="tabs" role="group" aria-label="Filter promises">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {loading && (
        <ol className="ledger" aria-busy="true" aria-label="Loading promises">
          {[0, 1, 2].map((i) => (
            <li key={i} className="ledger-row skeleton">
              <span />
              <span />
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="negative">Couldn’t read promises from Solana: {error.message}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty" role="status">
          <p>{filter === 'All' ? 'Nothing on the record yet.' : `No ${filter.toLowerCase()} promises right now.`}</p>
          <Link className="text-link" href="/create">
            Track the first one →
          </Link>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <ol className="ledger">
          {filtered.map((m) => (
            <LedgerRow key={m.id} market={m} />
          ))}
        </ol>
      )}
    </>
  );
}
export function StakePanel({ market }: { market: MarketView }) {
  const [side, setSide] = useState<Side>('kept');
  const [amount, setAmount] = useState(10);
  const [outcome, setOutcome] = useState<Outcome>('kept');
  const [now, setNow] = useState(0);
  const actions = useKeptActions();
  const owner = actions.wallet?.publicKey.toBase58();
  const { data: positions = [], loading: positionsLoading } = usePositions({ owner, market: market.id });
  const position = positions.find((item) => item.owner === owner);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [market.id]);
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 100;
  const pool = market.totals.kept + market.totals.broken;
  const winning = side === 'kept' ? market.totals.kept : market.totals.broken;
  const busy = working || positionsLoading;

  async function perform(action: () => Promise<unknown>) {
    setWorking(true);
    try { await action(); }
    catch { /* useKeptActions displays a wallet-aware toast */ }
    finally { setWorking(false); }
  }

  return (
    <aside className="panel">
      <p className="eyebrow">Your prediction</p>
      {!actions.wallet && <ConnectWallet />}
      {market.status === 'open' ? (
        <>
          <div className="choices">
            {['kept', 'broken'].map((s) => (
              <button
                key={s}
                aria-pressed={side === s}
                onClick={() => setSide(s as Side)}
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
          <button className="primary" disabled={!actions.wallet || !valid || busy || Boolean(position)}
            onClick={() => void perform(() => actions.stake(market.id, side, amount))}>
              {position ? `Your ${position.side} prediction · ${position.amount} tUSDC` : busy ? 'Waiting for confirmation…' : 'Confirm prediction'}
          </button>
          {position && <p className="muted">One prediction per wallet on each market.</p>}
          {(position || valid) && (
            <ShareBet
              market={market}
              side={position?.side ?? side}
              amount={position?.amount ?? amount}
              confirmed={Boolean(position)}
            />
          )}
        </>
      ) : (
        <>
          <h2>
            {market.status === 'proposed'
              ? 'AI proposal pending review'
              : market.status === 'council' || market.status === 'challenged'
                ? 'Council reviewing'
                : market.status === 'finalized'
                  ? `Final result · ${market.final}`
                  : market.status === 'void'
                    ? 'Market void · positions are refundable'
                    : 'Prediction closed'}
          </h2>
          {market.proposal && <p>{market.proposal.summary}</p>}
          {market.status === 'proposed' && market.proposal && (
            <>
              <p className="muted">Challenge window ends {new Date(market.proposal.windowEndsAt * 1000).toLocaleString()}.</p>
              <button disabled={!actions.wallet || !position || busy || now >= market.proposal.windowEndsAt}
                onClick={() => void perform(() => actions.challenge(market.id))}>
                {position ? 'Challenge proposal · 10 tUSDC' : 'A position is required to challenge'}
              </button>
              {now >= market.proposal.windowEndsAt && (
                <button className="primary" disabled={!actions.wallet || busy}
                  onClick={() => void perform(() => actions.finalize(market.id))}>Finalize result</button>
              )}
            </>
          )}
          {(market.status === 'council' || market.status === 'challenged') && (
            <>
              <label>Vote on the outcome
                <select value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)}>
                  <option value="kept">Kept</option><option value="broken">Broken</option><option value="void">Void</option>
                </select>
              </label>
              <button disabled={!actions.wallet || busy} onClick={() => void perform(() => actions.councilVote(market.id, outcome))}>Cast council vote</button>
              <p className="muted">Only configured council wallets can vote; the program checks membership.</p>
            </>
          )}
          {(market.status === 'finalized' || market.status === 'void') && (
            <button className="primary" disabled={!actions.wallet || !position || position.claimed || busy}
              onClick={() => void perform(() => actions.claim(market.id))}>
              {!position ? 'No position to claim' : position.claimed ? 'Already claimed' : market.status === 'void' ? 'Claim refund' : `Claim ${position.side} position`}
            </button>
          )}
        </>
      )}
      <Link className="text-link" href="/faucet">
        Get test tokens ↗
      </Link>
    </aside>
  );
}
