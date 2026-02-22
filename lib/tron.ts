import { useCallback, useEffect, useMemo, useState } from "react";
import TronWebLib from "tronweb";
import { DEFAULT_FEE_LIMIT, TRON_GRID_API } from "./constants";

export type TronWalletState = {
  address: string | null;
  isConnected: boolean;
  chainId: string | null;
  connect: () => Promise<void>;
};

export type WalletConnectSigner = {
  kind: "walletconnect";
  address: string;
  client: any;
  session: any;
};

export type TronLinkSigner = {
  kind: "tronlink";
  address: string;
};

export type WalletSigner = WalletConnectSigner | TronLinkSigner;

const getChainId = (host?: string) => {
  if (!host) return null;
  if (host.includes("trongrid.io")) return "tron-mainnet";
  if (host.includes("shasta")) return "tron-shasta";
  if (host.includes("nile")) return "tron-nile";
  return "tron-custom";
};

export const getTronWeb = () => {
  if (typeof window === "undefined") return null;
  return window.tronWeb ?? null;
};

const TronWebCtor = (TronWebLib as any).default ?? TronWebLib;
let readonlyTronWeb: TronWeb | null = null;

export const getReadonlyTronWeb = (): TronWeb => {
  if (readonlyTronWeb) return readonlyTronWeb;
  readonlyTronWeb = new TronWebCtor({
    fullHost: TRON_GRID_API
  });
  return readonlyTronWeb as TronWeb;
};

export const buildContractTransaction = async (
  contractAddress: string,
  functionSelector: string,
  parameters: { type: string; value: any }[],
  ownerAddress: string,
  feeLimit = DEFAULT_FEE_LIMIT,
  callValue = 0
) => {
  const tronWeb = getReadonlyTronWeb();
  const result = await tronWeb.transactionBuilder.triggerSmartContract(
    contractAddress,
    functionSelector,
    { feeLimit, callValue },
    parameters,
    ownerAddress
  );
  if (!result?.transaction) {
    throw new Error("Failed to build transaction.");
  }
  return result.transaction;
};

export const signAndBroadcast = async (tx: any, signer: WalletSigner): Promise<string> => {
  if (signer.kind === "tronlink") {
    const tronWeb = getTronWeb();
    if (!tronWeb) {
      throw new Error("TronLink not available to sign the transaction.");
    }
    const signed = await tronWeb.trx.sign(tx);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    const txid = result?.txid || result?.transaction?.txID;
    if (!txid) {
      throw new Error(result?.message || "Failed to broadcast transaction.");
    }
    return txid;
  }

  const response = await signer.client.request({
    topic: signer.session.topic,
    chainId: "tron:0x2b6653dc",
    request: {
      method: "tron_signTransaction",
      params: {
        address: signer.address,
        transaction: tx
      }
    }
  });

  const signedTx = (response as any)?.transaction ?? response;
  const broadcast = await fetch(`${TRON_GRID_API}/wallet/broadcasttransaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedTx)
  });
  const result = await broadcast.json();
  if (!result?.result) {
    throw new Error(result?.message || "WalletConnect broadcast failed.");
  }
  return result.txid;
};

export const useTronWallet = (): TronWalletState => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const tronWeb = getTronWeb();
    if (!tronWeb || !tronWeb.ready) {
      setAddress(null);
      setChainId(null);
      return;
    }
    const nextAddress = tronWeb.defaultAddress?.base58 || null;
    setAddress(nextAddress);
    setChainId(getChainId(tronWeb.fullNode?.host));
  }, []);

  useEffect(() => {
    refresh();

    const handler = () => refresh();
    window.tronLink?.on?.("addressChanged", handler);
    window.tronLink?.on?.("chainChanged", handler);

    const interval = setInterval(refresh, 1500);
    return () => {
      window.tronLink?.off?.("addressChanged", handler);
      window.tronLink?.off?.("chainChanged", handler);
      clearInterval(interval);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!window.tronLink) {
      throw new Error("TronLink not detected. Install TronLink or a compatible wallet.");
    }
    await window.tronLink.request({ method: "tron_requestAccounts" });
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      address,
      isConnected: Boolean(address),
      chainId,
      connect
    }),
    [address, chainId, connect]
  );
};

export const parseUnits = (value: string, decimals: number): bigint => {
  if (!value) return 0n;
  if (!/^\d*\\.?\\d*$/.test(value)) return 0n;
  const [whole, fraction = ""] = value.split(".");
  const sanitizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  const base = BigInt(10) ** BigInt(decimals);
  const wholePart = BigInt(whole || "0") * base;
  const fractionPart = BigInt(sanitizedFraction || "0");
  return wholePart + fractionPart;
};

export const formatUnits = (value: bigint, decimals: number): string => {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionStr}`;
};
