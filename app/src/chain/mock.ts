// app/src/chain/mock.ts    OWNER: P4
import type { KeptChain } from "./index";
import type { PositionView } from "@/shared/types";
import { FIXTURES } from "./fixtures";
import { MIN_STAKE, MAX_STAKE, LIMITS } from "../shared/constants";

const markets = structuredClone(FIXTURES);
const positions: PositionView[] = [];
const sig = () => "mock" + Math.random().toString(36).slice(2, 10);
const delay = () => new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 0 : 400));

const find = (id: number) => {
  const m = markets.find((x) => x.id === id);
  if (!m) throw new Error("Market not found");
  return m;
};

export const mockChain: KeptChain = {
  async listMarkets() {
    return structuredClone(markets);
  },
  async getMarket(id) {
    return structuredClone(markets.find((m) => m.id === id) ?? null);
  },
  async listPositions(f) {
    return structuredClone(positions.filter(
      (p) => (!f?.owner || p.owner === f.owner) && (f?.market === undefined || p.market === f.market),
    ));
  },
  async createMarket(w, d) {
    await delay();
    const deadline = Math.floor(new Date(d.deadline).getTime() / 1000);
    if (!(deadline > Date.now() / 1000)) throw new Error("DeadlinePassed");
    const id = markets.length;
    markets.push({
      ...structuredClone(FIXTURES[0]),
      id, pubkey: `MockMarket${id}`, creator: w.publicKey.toBase58(),
      promiser: d.promiser, promiseText: d.promiseText,
      criteria: `Kept if ${d.criteriaKept} Broken if ${d.criteriaBroken} Source: ${d.checkSource}`.slice(0, LIMITS.criteria),
      sourceUrl: d.sourceUrl, sourceHash: d.sourceHash,
      deadline, totals: { kept: 0, broken: 0 },
    });
    return { sig: sig(), id };
  },
  async stake(w, id, side, amount) {
    await delay();
    const m = find(id), owner = w.publicKey.toBase58();
    if (m.status !== "open" || Date.now() / 1000 >= m.deadline) throw new Error("NotOpen");
    if (amount < MIN_STAKE || amount > MAX_STAKE) throw new Error("StakeOutOfRange");
    if (positions.some((p) => p.market === id && p.owner === owner)) throw new Error("AlreadyStaked");
    positions.push({ market: id, owner, side, amount, claimed: false });
    m.totals[side] += amount;
    return sig();
  },
  async challenge(w, id) {
    await delay();
    const m = find(id);
    if (m.status !== "proposed") throw new Error("WindowClosed");
    m.status = "challenged";
    m.challenger = w.publicKey.toBase58();
    return sig();
  },
  async councilVote(_w, id, outcome) {
    await delay();
    const m = find(id);
    if (m.status !== "challenged" && m.status !== "council") throw new Error("NotInCouncil");
    const seat = m.votes.findIndex((v) => v === null);
    if (seat < 0) throw new Error("AlreadyVoted");
    m.votes[seat] = outcome;
    if (m.votes.filter((v) => v === outcome).length >= 2) {
      m.final = outcome;
      m.status = outcome === "void" ? "void" : "finalized";
    }
    return sig();
  },
  async finalize(_w, id) {
    await delay();
    const m = find(id);
    if (m.status !== "proposed" || !m.proposal) throw new Error("NotProposed");
    if (Date.now() / 1000 < m.proposal.windowEndsAt) throw new Error("WindowOpen");
    const verdict = m.proposal.verdict;
    const winners = verdict === "kept" ? m.totals.kept : verdict === "broken" ? m.totals.broken : 0;
    m.final = verdict === "unclear" || winners === 0 ? "void" : verdict;
    m.status = m.final === "void" ? "void" : "finalized";
    return sig();
  },
  async claim(w, id) {
    await delay();
    const m = find(id);
    if (m.status !== "finalized" && m.status !== "void") throw new Error("NotFinalized");
    const p = positions.find((x) => x.market === id && x.owner === w.publicKey.toBase58());
    if (!p) throw new Error("NoPosition");
    if (p.claimed) throw new Error("AlreadyClaimed");
    // Like the program: a losing position "claims" 0 (marked claimed, nothing moves).
    p.claimed = true;
    return sig();
  },
};
