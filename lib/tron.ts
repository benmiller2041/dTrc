import { useCallback, useEffect, useMemo, useState } from "react";
import TronWebLib from "tronweb";
import { DEFAULT_FEE_LIMIT, TRON_GRID_API, TRON_GRID_API_KEY, WTRX_ADDRESS } from "./constants";

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
  modal: any; // WalletConnectModal instance for redirect-to-wallet UI
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

const TronWebCtor =
  (TronWebLib as any).default ??
  (TronWebLib as any).TronWeb ??
  TronWebLib;
let readonlyTronWeb: TronWeb | null = null;

export const getReadonlyTronWeb = (): TronWeb => {
  if (readonlyTronWeb) return readonlyTronWeb;
  if (typeof TronWebCtor !== "function") {
    throw new Error("TronWeb constructor not available in this environment.");
  }
  const headers: Record<string, string> = {};
  if (TRON_GRID_API_KEY) headers["TRON-PRO-API-KEY"] = TRON_GRID_API_KEY;
  const instance = new TronWebCtor({
    fullHost: TRON_GRID_API,
    headers
  });
  // Ensure constant calls have a valid owner_address for TRONGrid.
  instance.setAddress(WTRX_ADDRESS);
  readonlyTronWeb = instance as TronWeb;
  return readonlyTronWeb;
};

export const buildContractTransaction = async (
  contractAddress: string,
  functionSelector: string,
  parameters: { type: string; value: any }[],
  ownerAddress: string,
  feeLimit = DEFAULT_FEE_LIMIT,
  callValue = 0
) => {
  // Prefer TronLink's authenticated TronWeb for building transactions — the
  // read-only instance has no API key and TronGrid will throttle/hang it.
  const tronWeb = getTronWeb() ?? getReadonlyTronWeb();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Transaction build timed out. Check your network connection.")), 15_000)
  );
  const result = await Promise.race([
    tronWeb.transactionBuilder.triggerSmartContract(
      contractAddress,
      functionSelector,
      { feeLimit, callValue },
      parameters,
      ownerAddress
    ),
    timeout
  ]);
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
    const signTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond. Make sure TronLink is unlocked and the approval popup is visible.")), 60_000)
    );
    const signed = await Promise.race([tronWeb.trx.sign(tx), signTimeout]);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    const txid = result?.txid || result?.transaction?.txID;
    if (!txid) {
      throw new Error(result?.message || "Failed to broadcast transaction.");
    }
    return txid;
  }

  const wcTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("WalletConnect sign timed out. Check your mobile wallet for a pending request.")), 120_000)
  );

  // Always resolve the topic from the live client session store so stale
  // React state doesn't cause "no matching key" errors.
  const liveSessions = signer.client.session.getAll();
  const liveSession = liveSessions.find((s: any) => s.topic === signer.session.topic) ?? signer.session;

  // Fire the sign request to the WalletConnect relay FIRST, then redirect
  // the user to their wallet so it wakes up and shows the signing prompt.
  const requestPromise = signer.client.request({
    topic: liveSession.topic,
    chainId: "tron:0x2b6653dc",
    request: {
      method: "tron_signTransaction",
      // Array format required by TrustWallet and most TRON mobile wallets.
      params: [{ address: signer.address, transaction: tx }]
    }
  });

  // Redirect user to wallet so it reconnects to the relay and shows the prompt.
  const peerRedirect = liveSession.peer?.metadata?.redirect;
  const walletDeepLink = peerRedirect?.native || peerRedirect?.universal || null;
  let modalOpened = false;
  if (walletDeepLink && typeof window !== "undefined") {
    // Using href (not window.open) so it opens the wallet app without
    // leaving the dapp page on mobile browsers.
    window.location.href = walletDeepLink;
  } else if (signer.modal) {
    // Fallback: open WalletConnect modal so user sees a "check your wallet" UI.
    try { await signer.modal.openModal(); modalOpened = true; } catch { /* ignore */ }
  }

  let response: any;
  try {
    response = await Promise.race([requestPromise, wcTimeout]);
  } finally {
    if (modalOpened) {
      try { signer.modal.closeModal(); } catch { /* ignore */ }
    }
  }

  // ---- Extract signature from wallet response ----
  // Wallets differ wildly in their WalletConnect response shape:
  //   • Full signed tx at root:        { txID, raw_data, raw_data_hex, signature: [...] }
  //   • Wrapped:                        { transaction: { txID, ..., signature: [...] } }
  //   • Signature-only (some wallets):  { signature: ["..."] }  (without raw_data)
  //   • Raw array (edge case):          ["<hex_sig>"]
  const raw = response as any;

  let signature: string[] | undefined;
  if (Array.isArray(raw?.signature)) {
    signature = raw.signature;
  } else if (Array.isArray(raw?.transaction?.signature)) {
    signature = raw.transaction.signature;
  } else if (Array.isArray(raw)) {
    // Some wallets return the signature as a bare array
    signature = raw;
  }

  if (!signature || signature.length === 0) {
    console.error("[WC] Wallet returned no signature. Raw response:", JSON.stringify(raw));
    throw new Error("Wallet returned an empty or invalid signature.");
  }

  // ---- Reconstruct broadcast payload from original unsigned tx + signature ----
  // The original `tx` from buildContractTransaction always contains the
  // required fields: txID, raw_data, and raw_data_hex.
  // We MUST use it as the base and simply attach the signature the wallet
  // provided, because some wallets strip raw_data_hex or other fields.
  const signedTx: Record<string, any> = {
    ...tx,
    signature
  };

  // Safety net: ensure raw_data_hex exists (TronGrid requires it).
  // In practice buildContractTransaction always provides it, but guard anyway.
  if (!signedTx.raw_data_hex && signedTx.raw_data) {
    try {
      const tronWeb = getReadonlyTronWeb();
      const hexBytes = (tronWeb as any).utils?.code?.byteArray2hexStr
        ? (tronWeb as any).utils.code.byteArray2hexStr(
            (tronWeb as any).utils.transaction.txPbToRawDataBytes?.(signedTx.raw_data) ?? []
          )
        : undefined;
      if (hexBytes) signedTx.raw_data_hex = hexBytes;
    } catch {
      // If we can't generate it, proceed anyway — it was likely already present.
    }
  }

  const broadcastHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (TRON_GRID_API_KEY) broadcastHeaders["TRON-PRO-API-KEY"] = TRON_GRID_API_KEY;

  console.debug("[WC] Broadcasting signed tx:", JSON.stringify(signedTx).slice(0, 500));

  const broadcast = await fetch(`${TRON_GRID_API}/wallet/broadcasttransaction`, {
    method: "POST",
    headers: broadcastHeaders,
    body: JSON.stringify(signedTx)
  });
  const result = await broadcast.json();

  console.debug("[WC] Broadcast response:", JSON.stringify(result));

  // TronGrid success: { result: true, txid: "..." }
  // TronGrid failure: { result: false, code: "...", message: "<hex>" }
  const txid = result?.txid as string | undefined;
  if (result?.result === true && txid) return txid;

  // Decode hex error message if present
  let errMsg = "WalletConnect broadcast failed.";
  if (result?.message) {
    try {
      const hex: string = result.message;
      const decoded = Buffer.from(hex, "hex").toString("utf8");
      // Only use decoded if it looks like readable text
      errMsg = decoded && /^[\x20-\x7E]+$/.test(decoded) ? decoded : hex;
    } catch {
      errMsg = result.message;
    }
  } else if (result?.code) {
    errMsg = `Broadcast failed: ${result.code}`;
  }
  throw new Error(errMsg);
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
  if (!/^\d*\.?\d*$/.test(value)) return 0n;
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
