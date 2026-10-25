// app/src/app/api/actions/stake/route.ts    OWNER: P4
// Solana Actions (Blinks). GET = card metadata, POST = a stake tx for the wallet to sign and send.
// The server fee payer partial-signs here, so Blink users also pay 0 SOL.
import { Keypair, PublicKey } from "@solana/web3.js";
import { anchorChain } from "@/chain/anchor";
import { buildStakeTx } from "@/chain/tx";
import { GASLESS, connection, feePayerFor } from "@/chain/relay";
import { MIN_STAKE, MAX_STAKE } from "@/shared/constants";
import type { Side } from "@/shared/types";
import { ACTIONS_HEADERS, baseUrl } from "../headers";

const err = (message: string, status = 400) => Response.json({ message }, { status, headers: ACTIONS_HEADERS });

export const OPTIONS = () => new Response(null, { headers: ACTIONS_HEADERS });

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("market"));
  const m = Number.isInteger(id) ? await anchorChain.getMarket(id).catch(() => null) : null;
  if (!m) return err("Market not found", 404);

  const pool = m.totals.kept + m.totals.broken;
  const keptPct = pool ? Math.round((100 * m.totals.kept) / pool) : 50;
  const base = `/api/actions/stake?market=${id}`;
  return Response.json({
    type: "action",
    icon: `${baseUrl(req)}/api/actions/icon`,
    title: `Did ${m.promiser} keep this promise?`,
    description: `"${m.promiseText}" · Odds: Kept ${keptPct}% · Broken ${100 - keptPct}% · Pool ${pool} tUSDC`,
    label: "Stake",
    disabled: m.status !== "open" || Date.now() / 1000 >= m.deadline,
    links: {
      actions: [
        { type: "transaction", label: "Kept · 10", href: `${base}&side=kept&amount=10` },
        { type: "transaction", label: "Broken · 10", href: `${base}&side=broken&amount=10` },
        {
          type: "transaction", label: "Stake", href: `${base}&side={side}&amount={amount}`,
          parameters: [
            { type: "select", name: "side", label: "Side", required: true,
              options: [{ label: "Kept", value: "kept" }, { label: "Broken", value: "broken" }] },
            { type: "number", name: "amount", label: `Amount (${MIN_STAKE}–${MAX_STAKE} tUSDC)`, required: true,
              min: MIN_STAKE, max: MAX_STAKE },
          ],
        },
      ],
    },
  }, { headers: ACTIONS_HEADERS });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("market"));
  const side = url.searchParams.get("side") as Side;
  const amount = Number(url.searchParams.get("amount"));
  if (!Number.isInteger(id)) return err("Bad market");
  if (side !== "kept" && side !== "broken") return err("Side must be kept or broken");
  if (!(amount >= MIN_STAKE && amount <= MAX_STAKE)) return err(`Amount must be ${MIN_STAKE}–${MAX_STAKE}`);

  let user: PublicKey;
  try { user = new PublicKey((await req.json()).account); } catch { return err("Bad account"); }

  try {
    const tx = await buildStakeTx(user, id, side, amount);
    tx.feePayer = feePayerFor(user);
    tx.recentBlockhash = (await connection().getLatestBlockhash("confirmed")).blockhash;
    if (GASLESS) {
      const secret = process.env.FEE_PAYER_SECRET;
      if (!secret) return err("Server missing fee payer", 500);
      tx.partialSign(Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret))));
    }
    return Response.json({
      type: "transaction",
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      message: `Staked ${amount} tUSDC on ${side === "kept" ? "Kept" : "Broken"}.`,
    }, { headers: ACTIONS_HEADERS });
  } catch (e: any) {
    return err(String(e?.message ?? e).slice(0, 200), 500);
  }
}
