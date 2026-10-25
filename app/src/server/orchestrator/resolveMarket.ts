import 'server-only';

import type { ResolveResponse, Verdict } from '@/shared/types';
import { CONFIDENCE_GATE_BPS, LIMITS } from '@/shared/constants';
import { anchorChain } from '@/chain/anchor';
import { connection } from '@/chain/relay';
import { buildProposeTx } from '@/chain/tx';
import { configPda } from '@/chain/pdas';
import { program } from '@/chain/program';
import { gatherEvidence } from '../context/evidence';
import { ServiceError } from '../errors';
import { judgeMarket } from '../intelligence/resolver';
import { keypairFromEnv } from './keys';
import { addTrace, getTrace, startTrace } from './trace';

const inFlight = new Set<number>();

export async function resolveMarket(
  marketId: number,
  options: { dryRun?: boolean } = {},
): Promise<ResolveResponse> {
  if (!Number.isSafeInteger(marketId) || marketId < 0)
    throw new ServiceError('Market id must be a non-negative integer.', 'invalid_market_id', 400);
  if (inFlight.has(marketId))
    throw new ServiceError('A resolution is already running for this market.', 'resolution_in_progress', 409);

  inFlight.add(marketId);
  startTrace(marketId);
  try {
    addTrace(marketId, 'read', 'Loading the market and checking its deadline.');
    const market = await anchorChain.getMarket(marketId);
    if (!market) throw new ServiceError('Market not found.', 'market_not_found', 404);
    if (market.status !== 'open')
      throw new ServiceError('Only open markets can be resolved.', 'market_not_open', 409);
    if (Date.now() / 1000 < market.deadline)
      throw new ServiceError('This market deadline has not passed yet.', 'before_deadline', 409);

    const resolver = keypairFromEnv('RESOLVER_SECRET');
    const config = await program().account.config.fetch(configPda());
    if (!config.resolver.equals(resolver.publicKey))
      throw new ServiceError('The configured resolver key does not match the on-chain config.', 'resolver_mismatch', 503);

    addTrace(marketId, 'search', 'Searching public sources for evidence against the market criteria.');
    const evidence = await gatherEvidence(market);
    addTrace(marketId, 'search', `Collected ${evidence.items.length} distinct evidence sources.`);

    addTrace(marketId, 'judge', 'Assessing the evidence against the promise and deadline.');
    const judgment = await judgeMarket(market, evidence);

    let verdict: Verdict = judgment.verdict;
    let confidence = Math.round(judgment.confidence * 10_000);
    const onChainSources = judgment.citations
      .map((citation) => citation.url)
      .filter((url) => url.length <= LIMITS.sourceLen)
      .slice(0, LIMITS.sources);
    if (!onChainSources.length) {
      verdict = 'unclear';
      confidence = Math.min(confidence, CONFIDENCE_GATE_BPS - 1);
    }
    if (verdict === 'unclear') confidence = Math.min(confidence, CONFIDENCE_GATE_BPS - 1);
    addTrace(marketId, 'validate', `Validated ${judgment.citations.length} citations; confidence ${confidence / 100}%.`);

    if (options.dryRun) {
      addTrace(marketId, 'write', 'Dry run complete; no transaction was sent.');
      return {
        marketId,
        verdict,
        confidence: confidence / 10_000,
        summary: judgment.summary,
        citations: judgment.citations,
        action: 'skipped',
        txSig: null,
        trace: getTrace(marketId),
      };
    }

    const tx = await buildProposeTx(
      resolver.publicKey,
      marketId,
      verdict,
      confidence,
      judgment.summary,
      onChainSources,
      Buffer.from(evidence.sha256, 'hex'),
    );
    const conn = connection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    tx.feePayer = resolver.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(resolver);
    addTrace(marketId, 'write', 'Submitting the resolver-signed proposal to Solana devnet.');
    const txSig = await conn.sendRawTransaction(tx.serialize());
    const confirmation = await conn.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err)
      throw new ServiceError('The proposal transaction failed on chain.', 'resolve_transaction_failed', 502);
    addTrace(marketId, 'write', `Proposal confirmed: ${txSig}`);
    return {
      marketId,
      verdict,
      confidence: confidence / 10_000,
      summary: judgment.summary,
      citations: judgment.citations,
      action: verdict === 'unclear' || confidence < CONFIDENCE_GATE_BPS ? 'sent_to_council' : 'proposed',
      txSig,
      trace: getTrace(marketId),
    };
  } catch (error) {
    addTrace(marketId, 'validate', error instanceof Error ? error.message : 'Resolution failed.');
    throw error;
  } finally {
    inFlight.delete(marketId);
  }
}
