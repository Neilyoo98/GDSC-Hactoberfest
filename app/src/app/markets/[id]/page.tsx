'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { resolvePromise } from '@/shared/apiClient';
import type { ResolveResponse } from '@/shared/types';
import { useMarket } from '@/chain/hooks';
import { OddsBar, StakePanel, StatusChip } from '@/components/kept/ledger';

export default function MarketPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: market, error, loading } = useMarket(id);
  const [now, setNow] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<ResolveResponse | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [id]);

  async function runResolution() {
    setResolving(true);
    setResolveError(null);
    try { setResolution(await resolvePromise(id)); }
    catch (cause) { setResolveError(cause instanceof Error ? cause.message : 'Resolution failed.'); }
    finally { setResolving(false); }
  }

  if (loading) return <p role="status">Loading market from Solana…</p>;
  if (error) return <p role="alert" className="negative">Could not load this market: {error.message}</p>;
  if (!market) return <section><h1>Market not found</h1><Link href="/">← All promises</Link></section>;

  return (
    <>
      <Link href="/" className="text-link">← All promises</Link>
      <div className="detail">
        <article>
          <div className="row">
            <Link href={`/promisers/${market.promiser.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`}>
              {market.promiser} ↗
            </Link>
            <StatusChip status={market.status} />
          </div>
          <h1 className="detail-quote">“{market.promiseText}”</h1>
          <p>Deadline · {new Date(market.deadline * 1000).toLocaleDateString()}</p>
          <p><b>Market question</b><br />{market.promiseText}</p>
          <details className="criteria"><summary>Verification criteria</summary><p>{market.criteria}</p></details>
          <OddsBar market={market} />
          <p><a className="text-link" href={market.sourceUrl} target="_blank" rel="noreferrer">Open original source ↗</a></p>
          <p className="muted"><b>Source SHA-256</b> · <code>{market.sourceHash}</code></p>
          {market.status === 'open' && now >= market.deadline && (
            <section className="panel">
              <h2>Resolve this promise</h2>
              <p>OpenAI will research public evidence, cite sources, and submit a proposal. Low confidence goes to the council.</p>
              {resolveError && <p role="alert" className="negative">{resolveError}</p>}
              <button className="primary" disabled={resolving} onClick={() => void runResolution()}>
                {resolving ? 'Researching evidence…' : 'Run AI resolution'}
              </button>
              {resolution && (
                <div role="status">
                  <h3>{resolution.action === 'sent_to_council' ? 'Sent to council' : resolution.action === 'skipped' ? 'Dry run complete' : 'Proposal submitted'}</h3>
                  <p>{resolution.verdict.toUpperCase()} · {Math.round(resolution.confidence * 100)}% confidence</p>
                  <p>{resolution.summary}</p>
                  {resolution.citations.map((citation) => (
                    <p key={citation.url}><a className="text-link" href={citation.url} target="_blank" rel="noreferrer">{citation.title} ↗</a><br /><q>{citation.quote}</q></p>
                  ))}
                  <ol>{resolution.trace.map((item, index) => <li key={`${item.at}-${index}`}><b>{item.step}</b> · {item.detail}</li>)}</ol>
                </div>
              )}
            </section>
          )}
          {market.proposal && (
            <section className="panel">
              <h2>Resolution proposal</h2>
              <p>{market.proposal.verdict.toUpperCase()} · {Math.round(market.proposal.confidence * 100)}% confidence</p>
              <p>{market.proposal.summary}</p>
              {market.proposal.sources.map((url) => <p key={url}><a className="text-link" href={url} target="_blank" rel="noreferrer">{url} ↗</a></p>)}
            </section>
          )}
        </article>
        <StakePanel market={market} />
      </div>
      <section className="explainer">
        <h2>Public record timeline</h2>
        <p>Recorded → Deadline → Evidence review → Challenge window → Final result</p>
        {market.proposal && <p>Proposal recorded {new Date(market.proposal.proposedAt * 1000).toLocaleString()} · challenge window ends {new Date(market.proposal.windowEndsAt * 1000).toLocaleString()}.</p>}
      </section>
    </>
  );
}
