// app/src/chain/anchor.ts    OWNER: P4
import type { GetProgramAccountsFilter } from "@solana/web3.js";
import type { KeptChain } from "./index";
import type { PositionView } from "../shared/types";
import { program } from "./program";
import { configPda, marketPda } from "./pdas";
import { decodeMarket, decodePosition, type RawMarket, type RawPosition } from "./read";
import { send } from "./relay";
import {
  buildChallengeTx, buildClaimTx, buildCouncilVoteTx, buildCreateMarketTx,
  buildFinalizeTx, buildStakeTx, nextMarketId,
} from "./tx";

// Account layouts (8-byte discriminator first):
//   Market   = disc · config(32) · id …     → config at offset 8
//   Position = disc · market(32) · owner(32) → market at 8, owner at 40
const MARKET_CONFIG_OFFSET = 8;
const POSITION_MARKET_OFFSET = 8;
const POSITION_OWNER_OFFSET = 40;

let windowCache: number | null = null;
async function challengeWindow() {
  if (windowCache === null) {
    const cfg = await program().account.config.fetch(configPda());
    windowCache = Number(cfg.challengeWindow.toString());
  }
  return windowCache;
}

/** Only markets under our Config (other configs can share the program). */
const ourMarkets = () =>
  program().account.market.all([{ memcmp: { offset: MARKET_CONFIG_OFFSET, bytes: configPda().toBase58() } }]);

export const anchorChain: KeptChain = {
  async listMarkets() {
    const [all, win] = await Promise.all([ourMarkets(), challengeWindow()]);
    return all
      .map((a) => decodeMarket(a.publicKey, a.account as unknown as RawMarket, win))
      .sort((a, b) => b.id - a.id);
  },

  async getMarket(id) {
    const raw = await program().account.market.fetchNullable(marketPda(id));
    return raw ? decodeMarket(marketPda(id), raw as unknown as RawMarket, await challengeWindow()) : null;
  },

  async listPositions(f) {
    const filters: GetProgramAccountsFilter[] = [];
    if (f?.owner) filters.push({ memcmp: { offset: POSITION_OWNER_OFFSET, bytes: f.owner } });
    if (f?.market !== undefined) filters.push({ memcmp: { offset: POSITION_MARKET_OFFSET, bytes: marketPda(f.market).toBase58() } });
    const positions = await program().account.position.all(filters);
    if (!positions.length) return [];

    // Position stores the market pubkey; map it back to the market id.
    const ids = new Map<string, number>();
    if (f?.market !== undefined) ids.set(marketPda(f.market).toBase58(), f.market);
    else for (const m of await ourMarkets()) ids.set(m.publicKey.toBase58(), Number(m.account.id.toString()));

    const out: PositionView[] = [];
    for (const p of positions) {
      const id = ids.get(p.account.market.toBase58());
      if (id !== undefined) out.push(decodePosition(id, p.account as unknown as RawPosition));
    }
    return out;
  },

  async createMarket(w, d) {
    const id = await nextMarketId();
    const sig = await send(w, await buildCreateMarketTx(w.publicKey, id, d));
    return { sig, id };
  },
  async stake(w, id, side, amount) { return send(w, await buildStakeTx(w.publicKey, id, side, amount)); },
  async challenge(w, id) { return send(w, await buildChallengeTx(w.publicKey, id)); },
  async councilVote(w, id, o) { return send(w, await buildCouncilVoteTx(w.publicKey, id, o)); },
  async finalize(w, id) { return send(w, await buildFinalizeTx(id)); },
  async claim(w, id) { return send(w, await buildClaimTx(w.publicKey, id)); },
};
