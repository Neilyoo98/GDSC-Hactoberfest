'use client';
// OWNER: P3 (written by P1 for the challenge flow; P3 owns it from here).
// Live resolution UI on P4's hooks: AI proposal → challenge window → council → claim.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useKeptActions, useMarket, useMarkets, usePositions } from '@/chain/hooks';
import { BOND } from '@/shared/constants';
import type { MarketView, Outcome } from '@/shared/types';

const LABEL: Record<Outcome | 'unclear', string> = { kept: '✓ Kept', broken: '✕ Broken', void: '○ Void', unclear: '? Unclear' };
const TONE: Record<Outcome | 'unclear', string> = { kept: 'positive', broken: 'negative', void: 'muted', unclear: 'muted' };

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const mmss = (secs: number) => {
  const s = Math.max(0, secs);
  if (s >= 86_400) return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Proposal({ m }: { m: MarketView }) {
  const p = m.proposal;
  if (!p) return null;
  return (
    <div>
      <p>
        AI proposes <b className={TONE[p.verdict]}>{LABEL[p.verdict]}</b> · confidence{' '}
        <b>{Math.round(p.confidence * 100)}%</b>
      </p>
      {p.summary && <p>“{p.summary}”</p>}
      {p.sources.length > 0 && (
        <ol>
          {p.sources.map((s) => (
            <li key={s}>
              <a className="text-link" href={s} target="_blank" rel="noreferrer">
                {s.replace(/^https?:\/\//, '')} ↗
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Votes({ m }: { m: MarketView }) {
  return (
    <p aria-live="polite">
      Council votes:{' '}
      {m.votes.map((v, i) => (
        <span key={i} className={v ? TONE[v] : 'muted'}>
          {v ? LABEL[v] : '○ seat ' + (i + 1)}
          {i < m.votes.length - 1 ? ' · ' : ''}
        </span>
      ))}
      <br />
      <small className="muted">Two matching votes decide the result.</small>
    </p>
  );
}

function VoteButtons({ id, busy, onVote }: { id: number; busy: boolean; onVote: (id: number, o: Outcome) => void }) {
  return (
    <div className="choices">
      {(['kept', 'broken', 'void'] as Outcome[]).map((o) => (
        <button key={o} disabled={busy} onClick={() => onVote(id, o)}>
          Vote {LABEL[o]}
        </button>
      ))}
    </div>
  );
}

/** Drop into the market page: <ResolutionPanel marketId={id} /> */
export function ResolutionPanel({ marketId }: { marketId: number }) {
  const { data: m, loading, error } = useMarket(marketId);
  const actions = useKeptActions();
  const owner = actions.wallet?.publicKey.toBase58();
  const { data: positions } = usePositions({ market: marketId });
  const mine = owner ? positions?.find((p) => p.owner === owner) : undefined;
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const act = (fn: () => Promise<unknown>) => {
    setBusy(true);
    fn().catch(() => {}).finally(() => setBusy(false)); // hooks already toast the error
  };

  if (loading) return <aside className="panel"><p className="muted">Loading the on-chain record…</p></aside>;
  if (error) return <aside className="panel"><p role="alert">Couldn’t read the chain: {error.message}</p></aside>;
  if (!m) return <aside className="panel"><p className="muted">This market isn’t on-chain yet.</p></aside>;

  const left = m.proposal ? m.proposal.windowEndsAt - now : 0;
  return (
    <aside className="panel" aria-live="polite">
      <div className="row">
        <h2>Resolution</h2>
        <span className={`chip ${m.status}`}>● {m.status}</span>
      </div>

      {m.status === 'open' && (
        <p>
          {now < m.deadline
            ? `Predictions open · deadline in ${mmss(m.deadline - now)}`
            : 'Deadline passed · the AI resolver is researching…'}
        </p>
      )}

      {m.status === 'proposed' && (
        <>
          <Proposal m={m} />
          {left > 0 ? (
            <>
              <p>
                Challenge window · <b>{mmss(left)}</b> left
              </p>
              <button className="primary" disabled={busy || !mine} onClick={() => act(() => actions.challenge(m.id))}>
                Challenge · {BOND} tUSDC bond
              </button>
              <small className="muted">
                {mine ? 'Bond returned if the council overturns the AI.' : 'Only wallets that predicted on this market can challenge.'}
              </small>
            </>
          ) : (
            <button className="primary" disabled={busy} onClick={() => act(() => actions.finalize(m.id))}>
              Finalize result
            </button>
          )}
        </>
      )}

      {(m.status === 'challenged' || m.status === 'council') && (
        <>
          <p>
            <b>{m.status === 'challenged' ? 'Challenged · council reviewing' : 'AI was unsure · council deciding'}</b>
          </p>
          <Proposal m={m} />
          <Votes m={m} />
          <VoteButtons id={m.id} busy={busy} onVote={(id, o) => act(() => actions.councilVote(id, o))} />
          <small className="muted">Only the 3 council wallets can vote.</small>
        </>
      )}

      {(m.status === 'finalized' || m.status === 'void') && (
        <>
          <p>
            Result:{' '}
            <b className={m.final ? TONE[m.final] : 'muted'}>{m.final ? LABEL[m.final] : '○ Void'}</b>
            {m.status === 'void' && ' · everyone is refunded'}
          </p>
          {m.challenger && <Votes m={m} />}
          {mine ? (
            <button className="primary" disabled={busy || mine.claimed} onClick={() => act(() => actions.claim(m.id))}>
              {mine.claimed ? 'Claimed ✓' : 'Claim'}
            </button>
          ) : (
            <small className="muted">This wallet has no prediction here.</small>
          )}
        </>
      )}

      {!actions.wallet && <p className="rail-note">Connect a wallet (top right) to act on this market.</p>}
    </aside>
  );
}

/** The /council page: live markets waiting for council votes. */
export function CouncilInbox() {
  const { data, loading, error } = useMarkets();
  const actions = useKeptActions();
  const [busy, setBusy] = useState<number | null>(null);
  const inbox = (data ?? []).filter((m) => m.status === 'challenged' || m.status === 'council');

  if (loading) return <p className="muted">Loading markets…</p>;
  if (error) return <p role="alert">Couldn’t read the chain: {error.message}</p>;

  return (
    <>
      {!actions.wallet && <p className="rail-note">Connect a council wallet (top right) to vote.</p>}
      {inbox.length === 0 ? (
        <p className="muted">Nothing waiting for the council right now.</p>
      ) : (
        <div className="grid">
          {inbox.map((m) => (
            <article className="market-card" key={m.id}>
              <div className="row card-heading">
                <span className="promiser">{m.promiser}</span>
                <span className={`chip ${m.status}`}>● {m.status}</span>
              </div>
              <Link href={`/markets/${m.id}`} className="quote">
                “{m.promiseText}”
              </Link>
              <Proposal m={m} />
              <Votes m={m} />
              <VoteButtons
                id={m.id}
                busy={busy === m.id}
                onVote={(id, o) => {
                  setBusy(id);
                  actions.councilVote(id, o).catch(() => {}).finally(() => setBusy(null));
                }}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
