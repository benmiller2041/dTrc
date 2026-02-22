import { useCallback, useEffect, useMemo, useState } from "react";

export type TronWalletState = {
  address: string | null;
  isConnected: boolean;
  chainId: string | null;
  connect: () => Promise<void>;
};

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
