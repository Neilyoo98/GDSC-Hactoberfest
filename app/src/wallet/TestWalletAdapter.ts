"use client";

import {
  BaseSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  type WalletName,
} from "@solana/wallet-adapter-base";
import type {
  Keypair,
  Transaction,
  TransactionVersion,
  VersionedTransaction,
} from "@solana/web3.js";
import { Keypair as SolanaKeypair } from "@solana/web3.js";

export interface StoredTestWallet {
  name: string;
  secretKey: number[];
}

const STORAGE_KEY = "kept.test-wallets.v1";
const ICON =
  "data:image/svg+xml;base64," +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1f5f45"/><path d="M16 5 27 11v10l-11 6L5 21V11z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#fff"/></svg>');

export function loadTestWallets(): StoredTestWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is StoredTestWallet =>
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        typeof item.name === "string" &&
        "secretKey" in item &&
        Array.isArray(item.secretKey) &&
        item.secretKey.length === 64 &&
        item.secretKey.every(
          (byte: unknown) =>
            typeof byte === "number" && Number.isInteger(byte) && byte >= 0 && byte <= 255,
        ),
    );
  } catch {
    return [];
  }
}

export function saveTestWallets(wallets: StoredTestWallet[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function generateTestWallet(name: string): StoredTestWallet {
  const keypair = SolanaKeypair.generate();
  return { name, secretKey: Array.from(keypair.secretKey) };
}

export class TestWalletAdapter extends BaseSignerWalletAdapter {
  readonly name: WalletName<string>;
  readonly url = "https://solana.com/developers";
  readonly icon = ICON;
  readonly address: string;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set([
    "legacy",
    0,
  ]);

  private keypair: Keypair | null = null;
  private _connecting = false;

  constructor(private readonly stored: StoredTestWallet) {
    super();
    this.name = stored.name as WalletName<string>;
    this.address = SolanaKeypair.fromSecretKey(Uint8Array.from(stored.secretKey)).publicKey.toBase58();
  }

  get publicKey() {
    return this.keypair?.publicKey ?? null;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    return typeof window === "undefined"
      ? WalletReadyState.Unsupported
      : WalletReadyState.Loadable;
  }

  async connect() {
    this._connecting = true;
    try {
      this.keypair = SolanaKeypair.fromSecretKey(Uint8Array.from(this.stored.secretKey));
      this.emit("connect", this.keypair.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect() {
    this.keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this.keypair) throw new WalletNotConnectedError();
    if ("version" in tx) tx.sign([this.keypair]);
    else tx.partialSign(this.keypair);
    return tx;
  }
}
