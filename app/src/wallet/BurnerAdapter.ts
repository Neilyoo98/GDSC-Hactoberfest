// app/src/wallet/BurnerAdapter.ts    OWNER: P4
// The burner keypair as a wallet-adapter wallet, so useWallet() and the connect button treat it like
// Phantom. Providers.tsx auto-selects it when NEXT_PUBLIC_BURNER=1 (Playwright, backup on stage).
import {
  BaseSignerWalletAdapter, WalletNotConnectedError, WalletReadyState, type WalletName,
} from "@solana/wallet-adapter-base";
import type { Keypair, Transaction, TransactionVersion, VersionedTransaction } from "@solana/web3.js";
import { burnerKeypair } from "./burner";

export const BurnerWalletName = "Burner (devnet)" as WalletName<"Burner (devnet)">;

const ICON =
  "data:image/svg+xml;base64," +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#B54708"/><path d="M16 6c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3-1-3-1-5 0-7z" fill="#FAFAF7"/></svg>');

export class BurnerWalletAdapter extends BaseSignerWalletAdapter {
  name = BurnerWalletName;
  url = "https://github.com/Neilyoo98/GDSC-Hactoberfest";
  icon = ICON;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(["legacy", 0]);

  private _kp: Keypair | null = null;
  private _connecting = false;

  get publicKey() { return this._kp?.publicKey ?? null; }
  get connecting() { return this._connecting; }
  get readyState() {
    return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Loadable;
  }

  async connect() {
    if (!this._kp) {
      this._connecting = true;
      try {
        this._kp = burnerKeypair();
      } finally {
        this._connecting = false;
      }
    }
    // Always emit, even if already connected: React StrictMode mounts the provider twice, and the
    // second auto-connect hit the early return without "connect", so the app saw no wallet on reload.
    this.emit("connect", this._kp.publicKey);
  }

  async disconnect() {
    this._kp = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this._kp) throw new WalletNotConnectedError();
    if ("version" in tx) tx.sign([this._kp]);
    else tx.partialSign(this._kp);
    return tx;
  }
}
