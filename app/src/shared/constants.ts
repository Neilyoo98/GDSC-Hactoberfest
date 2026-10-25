// OWNER: P1 (Blockchain). Ask before editing.
// Values that must match program/src/lib.rs. Changes after 12:30 are additive only.

// Set in app/.env.local. Empty strings are allowed in mock mode; call
// assertChainEnv() before talking to devnet.
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "";
export const TUSDC_MINT = process.env.NEXT_PUBLIC_TUSDC_MINT ?? "";
export const CONFIG_ADMIN = process.env.NEXT_PUBLIC_CONFIG_ADMIN ?? ""; // Config = ["config", admin]
export const FEE_PAYER_PUBKEY = process.env.NEXT_PUBLIC_FEE_PAYER_PUBKEY ?? "";

export const TUSDC_DECIMALS = 6;
export const TUSDC_BASE = 10 ** TUSDC_DECIMALS; // 1 tUSDC in base units

// UI units (tUSDC). The program enforces the same limits in base units.
export const MIN_STAKE = 1;
export const MAX_STAKE = 100;
export const BOND = 10;

// On-chain u8 encoding for side, verdict and outcome.
export const SIDE = { none: 0, kept: 1, broken: 2, void: 3 } as const;

export const SEEDS = {
  config: "config", // ["config", admin]
  market: "market", // ["market", config, id as u64 little-endian]
  vault: "vault", // ["vault", market]
  position: "position", // ["position", market, user]
} as const;

// Byte limits from the program. They keep create_market under Solana's
// 1232-byte transaction limit, so trim drafts to these before signing.
export const LIMITS = {
  promiser: 40,
  promiseText: 240,
  criteria: 160,
  sourceUrl: 120,
  summary: 280,
  sources: 3,
  sourceLen: 120,
} as const;

export const CONFIDENCE_GATE = 0.7; // AI proposes only at or above this
export const CONFIDENCE_GATE_BPS = 7_000;

export function assertChainEnv(): void {
  const missing = Object.entries({
    NEXT_PUBLIC_PROGRAM_ID: PROGRAM_ID,
    NEXT_PUBLIC_TUSDC_MINT: TUSDC_MINT,
    NEXT_PUBLIC_CONFIG_ADMIN: CONFIG_ADMIN,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`Missing env for devnet: ${missing.join(", ")}`);
}
