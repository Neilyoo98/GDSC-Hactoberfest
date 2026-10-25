"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useBrowserTestWallets } from "./Providers";

export function TestWalletManager() {
  const { adapters, ready, createWallet } = useBrowserTestWallets();
  const { wallet, connected, connecting, select, disconnect } = useWallet();
  const { setVisible: setWalletPickerVisible } = useWalletModal();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [openingWalletPicker, setOpeningWalletPicker] = useState(false);

  useEffect(() => {
    if (!pendingName) return;
    const target = adapters.find((adapter) => adapter.name === pendingName);
    if (!target) return;
    if (wallet?.adapter.name !== target.name) {
      select(target.name);
      return;
    }
    if (connected) {
      const timer = window.setTimeout(() => setPendingName(null), 0);
      return () => window.clearTimeout(timer);
    }
    if (connecting) return;

    let active = true;
    void target.connect()
      .then(() => {
        if (active) setPendingName(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPendingName(null);
        setError(cause instanceof Error ? cause.message : "Could not connect this test wallet.");
      });
    return () => {
      active = false;
    };
  }, [adapters, connected, connecting, pendingName, select, wallet]);

  function createWalletForBrowser() {
    setError(null);
    try {
      const adapter = createWallet();
      setPendingName(adapter.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a test wallet.");
    }
  }

  async function switchToWalletApp() {
    setError(null);
    setPendingName(null);
    setOpeningWalletPicker(true);
    try {
      if (connected) await disconnect();
      setWalletPickerVisible(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch wallets.");
    } finally {
      setOpeningWalletPicker(false);
    }
  }

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1500);
    } catch {
      setError("Could not copy the address. Select and copy it manually.");
    }
  }

  return (
    <details className="test-wallet-manager">
      <summary>Test wallets{adapters.length > 0 ? ` · ${adapters.length}` : ""}</summary>
      <div className="test-wallet-popover">
        <p className="test-wallet-warning">
          For mock/devnet testing only. Secret keys are stored unencrypted in this browser’s local storage. Never use these wallets for real funds.
        </p>
        <button
          type="button"
          className="test-wallet-main"
          disabled={openingWalletPicker || Boolean(pendingName)}
          onClick={() => void switchToWalletApp()}
        >
          {openingWalletPicker ? "Opening wallet picker…" : "Switch to Phantom or another wallet"}
        </button>
        <button
          type="button"
          className="test-wallet-create"
          disabled={!ready || adapters.length >= 10 || Boolean(pendingName)}
          onClick={createWalletForBrowser}
        >
          {pendingName?.startsWith("Test wallet") ? "Connecting…" : "+ Create new wallet"}
        </button>
        {!ready && <p className="muted">Loading saved test wallets…</p>}
        {adapters.map((adapter) => {
          const isActive = wallet?.adapter.name === adapter.name && connected;
          return (
            <div className="test-wallet-row" key={adapter.name}>
              <button
                type="button"
                className="test-wallet-select"
                disabled={Boolean(pendingName)}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  setError(null);
                  setPendingName(adapter.name);
                }}
              >
                <span>{adapter.name}</span>
                <small>{isActive ? "Connected" : "Switch"}</small>
              </button>
              <button
                type="button"
                className="test-wallet-address"
                title="Copy wallet address"
                onClick={() => void copyAddress(adapter.address)}
              >
                {copiedAddress === adapter.address ? "Copied" : `${adapter.address.slice(0, 5)}…${adapter.address.slice(-5)} · Copy`}
              </button>
            </div>
          );
        })}
        {error && <p className="test-wallet-error" role="alert">{error}</p>}
        <p className="test-wallet-note">
          On devnet, configure the displayed addresses as council members before testing council votes.
        </p>
      </div>
    </details>
  );
}
