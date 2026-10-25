// app/src/chain/tx.ts    OWNER: P4
// Transaction builders. Account names follow the IDL (shared/idl/kept.json); tsc against the Kept type
// flags any mismatch. All amounts arrive in UI units and are converted here (the only base-unit
// boundary besides read.ts). Config is passed explicitly everywhere: its seed is config.admin, which
// Anchor can't resolve on its own.
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { MarketDraft, Outcome, Side, Verdict } from "../shared/types";
import { LIMITS } from "../shared/constants";
import { program } from "./program";
import { configPda, marketPda, mint, positionPda, userAta, vaultPda } from "./pdas";
import { OUTCOME_CODE, SIDE_CODE, VERDICT_CODE, toBase } from "./read";
import { feePayerFor } from "./relay";

const bn = (n: bigint | number) => new BN(n.toString());
const hexBytes = (h: string) => Array.from(Buffer.from(h, "hex"));
const clip = (s: string, n: number) => s.trim().slice(0, n);

export async function nextMarketId(): Promise<number> {
  const cfg = await program().account.config.fetch(configPda());
  return Number(cfg.marketCount.toString());
}

export async function buildCreateMarketTx(
  creator: PublicKey, id: number, d: MarketDraft & { sourceUrl: string; sourceHash: string },
): Promise<Transaction> {
  const market = marketPda(id);
  const criteria = clip(`Kept if ${d.criteriaKept} Broken if ${d.criteriaBroken} Source: ${d.checkSource}`, LIMITS.criteria);
  return program().methods
    .createMarket(
      clip(d.promiser, LIMITS.promiser), clip(d.promiseText, LIMITS.promiseText), criteria,
      clip(d.sourceUrl, LIMITS.sourceUrl), hexBytes(d.sourceHash),
      bn(Math.floor(new Date(d.deadline).getTime() / 1000)),
    )
    .accountsPartial({
      creator, payer: feePayerFor(creator), config: configPda(), market, vault: vaultPda(market), mint: mint(),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildStakeTx(user: PublicKey, id: number, s: Side, amount: number): Promise<Transaction> {
  const market = marketPda(id);
  return program().methods
    .placeStake(SIDE_CODE[s], bn(toBase(amount)))
    .accountsPartial({
      user, payer: feePayerFor(user), config: configPda(), market, position: positionPda(market, user),
      userToken: userAta(user), vault: vaultPda(market),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildChallengeTx(user: PublicKey, id: number): Promise<Transaction> {
  const market = marketPda(id);
  return program().methods
    .challenge()
    .accountsPartial({
      user, config: configPda(), market, position: positionPda(market, user),
      userToken: userAta(user), vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
}

export async function buildCouncilVoteTx(member: PublicKey, id: number, o: Outcome): Promise<Transaction> {
  return program().methods
    .councilVote(OUTCOME_CODE[o])
    .accountsPartial({ member, config: configPda(), market: marketPda(id) })
    .transaction();
}

export async function buildFinalizeTx(id: number): Promise<Transaction> {
  return program().methods
    .finalize()
    .accountsPartial({ config: configPda(), market: marketPda(id) })
    .transaction();
}

export async function buildClaimTx(user: PublicKey, id: number): Promise<Transaction> {
  const market = marketPda(id);
  return program().methods
    .claim()
    .accountsPartial({
      user, config: configPda(), market, position: positionPda(market, user), userToken: userAta(user),
      vault: vaultPda(market), tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
}

/** Server-only (P2's orchestrator signs with the resolver key). docs/PLAN.md Contracts signature. */
export async function buildProposeTx(
  resolver: PublicKey, id: number, v: Verdict, confidenceBps: number,
  summary: string, sources: string[], evidenceHash: Uint8Array,
): Promise<Transaction> {
  return program().methods
    .proposeOutcome(
      VERDICT_CODE[v], Math.max(0, Math.min(10_000, Math.round(confidenceBps))),
      clip(summary, LIMITS.summary),
      sources.slice(0, LIMITS.sources).map((s) => clip(s, LIMITS.sourceLen)),
      Array.from(evidenceHash),
    )
    .accountsPartial({ resolver, config: configPda(), market: marketPda(id) })
    .transaction();
}
