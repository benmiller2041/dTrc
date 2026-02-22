"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TokenInput from "./TokenInput";
import TxStatus from "./TxStatus";
import { useTronWallet, parseUnits, formatUnits, getTronWeb } from "../../lib/tron";
import { TOKEN_LIST, allowance, ensureAllowance } from "../../lib/tokens";
import { buildPath, getAmountsIn, getAmountsOut, swapExactTokensForTokens, swapTokensForExactTokens } from "../../lib/router";
import { DEFAULT_DEADLINE_SECONDS, DEFAULT_SLIPPAGE_BPS, SUNSWAP_ROUTER_ADDRESS } from "../../lib/constants";
import { applySlippageMax, applySlippageMin, getDeadline } from "../../lib/slippage";

const parseError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("rejected") || lower.includes("denied")) return "User rejected the transaction.";
  if (lower.includes("energy")) return "Insufficient Energy for this transaction.";
  if (lower.includes("bandwidth")) return "Insufficient Bandwidth for this transaction.";
  if (lower.includes("allowance")) return "Allowance too low. Approve token first.";
  if (lower.includes("expired") || lower.includes("deadline")) return "Deadline expired.";
  if (lower.includes("insufficient_output")) return "Slippage exceeded. Try higher slippage tolerance.";
  return message;
};

export default function SwapForm() {
  const wallet = useTronWallet();
  const [tokenIn, setTokenIn] = useState(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState(TOKEN_LIST[1] ?? TOKEN_LIST[0]);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [exactMode, setExactMode] = useState<"exactIn" | "exactOut">("exactIn");
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

  const path = useMemo(() => buildPath(tokenIn.address, tokenOut.address), [tokenIn, tokenOut]);

  const canQuote = useMemo(() => {
    return exactMode === "exactIn" ? Number(amountIn) > 0 : Number(amountOut) > 0;
  }, [exactMode, amountIn, amountOut]);

  const quoteSwap = useCallback(async () => {
    if (!canQuote) return;
    setIsQuoting(true);
    setQuoteError(null);
    try {
      if (exactMode === "exactIn") {
        const amountInBase = parseUnits(amountIn, tokenIn.decimals);
        const amounts = await getAmountsOut(amountInBase, path);
        const out = amounts[amounts.length - 1] ?? 0n;
        setAmountOut(formatUnits(out, tokenOut.decimals));
      } else {
        const amountOutBase = parseUnits(amountOut, tokenOut.decimals);
        const amounts = await getAmountsIn(amountOutBase, path);
        const input = amounts[0] ?? 0n;
        setAmountIn(formatUnits(input, tokenIn.decimals));
      }
    } catch (err) {
      setQuoteError(parseError(err));
    } finally {
      setIsQuoting(false);
    }
  }, [amountIn, amountOut, canQuote, exactMode, path, tokenIn.decimals, tokenOut.decimals]);

  useEffect(() => {
    if (!canQuote) return;
    const handle = setTimeout(() => {
      void quoteSwap();
    }, 600);
    return () => clearTimeout(handle);
  }, [canQuote, quoteSwap]);

  useEffect(() => {
    const check = async () => {
      if (!wallet.address) {
        setNeedsApproval(false);
        return;
      }
      try {
        const baseAmount =
          exactMode === "exactIn"
            ? parseUnits(amountIn || "0", tokenIn.decimals)
            : applySlippageMax(parseUnits(amountIn || "0", tokenIn.decimals), slippageBps);
        if (baseAmount === 0n) {
          setNeedsApproval(false);
          return;
        }
        const current = await allowance(tokenIn.address, wallet.address, SUNSWAP_ROUTER_ADDRESS);
        setNeedsApproval(current < baseAmount);
      } catch {
        setNeedsApproval(false);
      }
    };
    void check();
  }, [amountIn, exactMode, slippageBps, tokenIn.address, tokenIn.decimals, wallet.address]);

  const onApprove = useCallback(async () => {
    if (!wallet.address) return;
    setIsApproving(true);
    setQuoteError(null);
    try {
      const requiredAmount =
        exactMode === "exactIn"
          ? parseUnits(amountIn || "0", tokenIn.decimals)
          : applySlippageMax(parseUnits(amountIn || "0", tokenIn.decimals), slippageBps);
      await ensureAllowance(tokenIn.address, wallet.address, SUNSWAP_ROUTER_ADDRESS, requiredAmount);
    } catch (err) {
      setQuoteError(parseError(err));
    } finally {
      setIsApproving(false);
    }
  }, [amountIn, exactMode, slippageBps, tokenIn.address, tokenIn.decimals, wallet.address]);

  const pollTx = async (hash: string) => {
    const tronWeb = getTronWeb();
    if (!tronWeb) return;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const info = await tronWeb.trx.getTransactionInfo(hash);
        if (info && info.receipt && info.receipt.result === "SUCCESS") {
          setTxStatus("success");
          return;
        }
        if (info && info.receipt && info.receipt.result === "FAILED") {
          setTxStatus("error");
          return;
        }
      } catch {
        // ignore while pending
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };

  const onSwap = useCallback(async () => {
    if (!wallet.address) return;
    setIsSwapping(true);
    setQuoteError(null);
    setTxHash(null);
    setTxStatus("pending");

    try {
      const deadline = getDeadline(DEFAULT_DEADLINE_SECONDS);
      if (exactMode === "exactIn") {
        const amountInBase = parseUnits(amountIn, tokenIn.decimals);
        const quotedOut = parseUnits(amountOut || "0", tokenOut.decimals);
        const amountOutMin = applySlippageMin(quotedOut, slippageBps);
        await ensureAllowance(tokenIn.address, wallet.address, SUNSWAP_ROUTER_ADDRESS, amountInBase);
        const txid = await swapExactTokensForTokens(
          amountInBase,
          amountOutMin,
          path,
          wallet.address,
          deadline
        );
        setTxHash(txid);
        await pollTx(txid);
      } else {
        const amountOutBase = parseUnits(amountOut, tokenOut.decimals);
        const quotedIn = parseUnits(amountIn || "0", tokenIn.decimals);
        const amountInMax = applySlippageMax(quotedIn, slippageBps);
        await ensureAllowance(tokenIn.address, wallet.address, SUNSWAP_ROUTER_ADDRESS, amountInMax);
        const txid = await swapTokensForExactTokens(
          amountOutBase,
          amountInMax,
          path,
          wallet.address,
          deadline
        );
        setTxHash(txid);
        await pollTx(txid);
      }
    } catch (err) {
      setTxStatus("error");
      setQuoteError(parseError(err));
    } finally {
      setIsSwapping(false);
    }
  }, [amountIn, amountOut, exactMode, path, slippageBps, tokenIn, tokenOut, wallet.address]);

  const isSwapDisabled = !wallet.isConnected || !canQuote || isSwapping || isQuoting;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Swap</div>
          <div className="text-xs text-zinc-500">SunSwap router direct integration</div>
        </div>
        <div className="text-xs text-zinc-500">{wallet.chainId || "Unknown network"}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-full px-3 py-1 text-xs ${
            exactMode === "exactIn" ? "bg-zinc-900 text-white" : "border border-zinc-300"
          }`}
          onClick={() => setExactMode("exactIn")}
        >
          Exact In
        </button>
        <button
          className={`rounded-full px-3 py-1 text-xs ${
            exactMode === "exactOut" ? "bg-zinc-900 text-white" : "border border-zinc-300"
          }`}
          onClick={() => setExactMode("exactOut")}
        >
          Exact Out
        </button>
      </div>

      <TokenInput
        label="Token In"
        tokens={TOKEN_LIST}
        selected={tokenIn}
        onSelect={setTokenIn}
        amount={amountIn}
        onAmountChange={setAmountIn}
        disabled={exactMode === "exactOut"}
      />

      <TokenInput
        label="Token Out"
        tokens={TOKEN_LIST}
        selected={tokenOut}
        onSelect={setTokenOut}
        amount={amountOut}
        onAmountChange={setAmountOut}
        disabled={exactMode === "exactIn"}
      />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Slippage (bps)</span>
          <input
            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-right"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value) || 0)}
            inputMode="numeric"
          />
        </div>
        <div className="mt-2 text-xs text-zinc-500">Quote updates automatically.</div>
      </div>

      {quoteError && <div className="text-sm text-red-600">{quoteError}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          onClick={quoteSwap}
          disabled={isQuoting || !canQuote}
        >
          {isQuoting ? "Quoting..." : "Refresh Quote"}
        </button>
        {needsApproval && (
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            onClick={onApprove}
            disabled={!wallet.isConnected || isApproving}
          >
            {isApproving ? "Approving..." : "Approve"}
          </button>
        )}
        <button
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
          onClick={onSwap}
          disabled={isSwapDisabled}
        >
          {isSwapping ? "Swapping..." : "Swap"}
        </button>
      </div>

      <TxStatus txHash={txHash} status={txStatus} />
    </div>
  );
}
