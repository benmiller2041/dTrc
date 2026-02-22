"use client";

import { useEffect, useMemo, useState } from "react";
import { useTronWallet } from "../../lib/tron";
import { SignClient } from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export type WalletConnectState = {
  wcAddress: string | null;
  wcConnected: boolean;
};

export default function WalletConnect() {
  const tronWallet = useTronWallet();
  const [wcAddress, setWcAddress] = useState<string | null>(null);
  const [wcConnected, setWcConnected] = useState(false);
  const [client, setClient] = useState<SignClient | null>(null);
  const [modal, setModal] = useState<WalletConnectModal | null>(null);
  const canUseWalletConnect = WALLETCONNECT_PROJECT_ID.length > 0;

  useEffect(() => {
    if (!canUseWalletConnect) return;
    const init = async () => {
      const signClient = await SignClient.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: "TrcSwap",
          description: "SunSwap TRON frontend",
          url: "https://localhost",
          icons: []
        }
      });
      const wcModal = new WalletConnectModal({
        projectId: WALLETCONNECT_PROJECT_ID,
        themeMode: "light",
        explorerRecommendedWalletIds: [
          "c57ca95b47569778a828d191781d4b2f091f95be88980e7ac14d9a53c0d248f8" // Trust Wallet
        ]
      });
      setClient(signClient);
      setModal(wcModal);

      signClient.on("session_event", () => undefined);
      signClient.on("session_delete", () => {
        setWcConnected(false);
        setWcAddress(null);
      });

      if (signClient.session.length > 0) {
        const session = signClient.session.getAll()[0];
        const account = session?.namespaces?.tron?.accounts?.[0] || null;
        setWcAddress(account ? account.split(":")[2] : null);
        setWcConnected(Boolean(account));
      }
    };
    void init();
  }, [canUseWalletConnect]);

  const connectWalletConnect = async () => {
    if (!client || !modal) return;
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        tron: {
          methods: ["tron_signTransaction", "tron_signMessage"],
          chains: ["tron:0x2b6653dc"],
          events: ["accountsChanged", "chainChanged"]
        }
      }
    });

    if (uri) {
      await modal.openModal({ uri });
    }

    const session = await approval();
    modal.closeModal();
    const account = session?.namespaces?.tron?.accounts?.[0] || null;
    setWcAddress(account ? account.split(":")[2] : null);
    setWcConnected(Boolean(account));
  };

  const walletStatus = useMemo(() => {
    if (tronWallet.isConnected) {
      return `TronLink: ${tronWallet.address}`;
    }
    if (wcConnected && wcAddress) {
      return `WalletConnect: ${wcAddress}`;
    }
    return "Not connected";
  }, [tronWallet.isConnected, tronWallet.address, wcConnected, wcAddress]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm text-zinc-500">Wallet</div>
      <div className="text-sm font-medium text-zinc-900">{walletStatus}</div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
          onClick={() => tronWallet.connect()}
        >
          Connect TronLink
        </button>
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          onClick={connectWalletConnect}
          disabled={!canUseWalletConnect}
          title={!canUseWalletConnect ? "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" : undefined}
        >
          Connect Trust Wallet
        </button>
      </div>
      <div className="text-xs text-zinc-500">
        Swaps require a Tron-compatible wallet that injects TronWeb (e.g. TronLink).
      </div>
    </div>
  );
}
