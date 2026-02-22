"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { TronWalletState, useTronWallet, WalletSigner } from "../../lib/tron";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

type SignClientInstance = InstanceType<typeof SignClient>;

type WalletConnectState = {
  address: string | null;
  connected: boolean;
  client: SignClientInstance | null;
  session: any | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

type WalletContextValue = {
  tron: TronWalletState;
  walletConnect: WalletConnectState;
  signer: WalletSigner | null;
  address: string | null;
  isConnected: boolean;
  chainId: string | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const tron = useTronWallet();
  const [client, setClient] = useState<SignClientInstance | null>(null);
  const [modal, setModal] = useState<WalletConnectModal | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [wcAddress, setWcAddress] = useState<string | null>(null);
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
          "c57ca95b47569778a828d191781d4b2f091f95be88980e7ac14d9a53c0d248f8"
        ]
      });

      setClient(signClient);
      setModal(wcModal);

      signClient.on("session_delete", () => {
        setSession(null);
        setWcAddress(null);
      });

      if (signClient.session.length > 0) {
        const existing = signClient.session.getAll()[0];
        const account = existing?.namespaces?.tron?.accounts?.[0] || null;
        setSession(existing);
        setWcAddress(account ? account.split(":")[2] : null);
      }
    };
    void init();
  }, [canUseWalletConnect]);

  const connectWalletConnect = useCallback(async () => {
    if (!client || !modal) return;
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        tron: {
          methods: ["tron_signTransaction", "tron_signMessage"],
          chains: ["tron:0x2b6653dc"],
          events: ["accountsChanged", "chainChanged"]
        }
      },
      sessionProperties: {
        tron_method_version: "v1"
      }
    });

    if (uri) {
      await modal.openModal({ uri });
    }

    const approved = await approval();
    modal.closeModal();
    const account = approved?.namespaces?.tron?.accounts?.[0] || null;
    setSession(approved);
    setWcAddress(account ? account.split(":")[2] : null);
  }, [client, modal]);

  const disconnectWalletConnect = useCallback(async () => {
    if (!client || !session) return;
    await client.disconnect({
      topic: session.topic,
      reason: {
        code: 6000,
        message: "User disconnected"
      }
    });
    setSession(null);
    setWcAddress(null);
  }, [client, session]);

  const walletConnectState = useMemo<WalletConnectState>(
    () => ({
      address: wcAddress,
      connected: Boolean(wcAddress),
      client,
      session,
      connect: connectWalletConnect,
      disconnect: disconnectWalletConnect
    }),
    [wcAddress, client, session, connectWalletConnect, disconnectWalletConnect]
  );

  const signer = useMemo<WalletSigner | null>(() => {
    if (tron.isConnected && tron.address) {
      return { kind: "tronlink", address: tron.address };
    }
    if (walletConnectState.connected && wcAddress && client && session) {
      return { kind: "walletconnect", address: wcAddress, client, session };
    }
    return null;
  }, [tron.isConnected, tron.address, walletConnectState.connected, wcAddress, client, session]);

  const chainId = useMemo(() => {
    if (tron.chainId) return tron.chainId;
    if (walletConnectState.connected && session) {
      const chain = session.namespaces?.tron?.accounts?.[0];
      if (chain?.includes("0x2b6653dc")) return "tron-mainnet";
      if (chain?.includes("shasta")) return "tron-shasta";
      if (chain?.includes("nile")) return "tron-nile";
      return "tron-mainnet";
    }
    return null;
  }, [tron.chainId, walletConnectState.connected, session]);

  const value = useMemo<WalletContextValue>(
    () => ({
      tron,
      walletConnect: walletConnectState,
      signer,
      address: signer?.address ?? null,
      isConnected: Boolean(signer),
      chainId
    }),
    [tron, walletConnectState, signer, chainId]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};
