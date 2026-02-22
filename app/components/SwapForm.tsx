"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TokenInput from "./TokenInput";
import TxStatus from "./TxStatus";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { parseUnits, formatUnits, getReadonlyTronWeb } from "../../lib/tron";
import { TOKEN_LIST, allowance, ensureAllowance } from "../../lib/tokens";
import { buildPath, getAmountsIn, getAmountsOut, swapExactTokensForTokens, swapTokensForExactTokens } from "../../lib/router";
import { DEFAULT_DEADLINE_SECONDS, DEFAULT_SLIPPAGE_BPS, SUNSWAP_ROUTER_ADDRESS } from "../../lib/constants";
import { applySlippageMax, applySlippageMin, getDeadline } from "../../lib/slippage";
import { useWallet } from "./WalletProvider";

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
  const { signer, address, isConnected, tron } = useWallet();
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
      if (!address) {
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
        const current = await allowance(tokenIn.address, address, SUNSWAP_ROUTER_ADDRESS);
        setNeedsApproval(current < baseAmount);
      } catch {
        setNeedsApproval(false);
      }
    };
    void check();
  }, [amountIn, exactMode, slippageBps, tokenIn.address, tokenIn.decimals, address]);

  const onApprove = useCallback(async () => {
    if (!address || !signer) return;
    setIsApproving(true);
    setQuoteError(null);
    try {
      const requiredAmount =
        exactMode === "exactIn"
          ? parseUnits(amountIn || "0", tokenIn.decimals)
          : applySlippageMax(parseUnits(amountIn || "0", tokenIn.decimals), slippageBps);
      await ensureAllowance(
        tokenIn.address,
        address,
        SUNSWAP_ROUTER_ADDRESS,
        requiredAmount,
        signer
      );
    } catch (err) {
      setQuoteError(parseError(err));
    } finally {
      setIsApproving(false);
    }
  }, [amountIn, exactMode, slippageBps, tokenIn.address, tokenIn.decimals, address, signer]);

  const pollTx = async (hash: string) => {
    const tronWeb = getReadonlyTronWeb();
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
    if (!address || !signer) return;
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
        await ensureAllowance(
          tokenIn.address,
          address,
          SUNSWAP_ROUTER_ADDRESS,
          amountInBase,
          signer
        );
        const txid = await swapExactTokensForTokens(
          amountInBase,
          amountOutMin,
          path,
          address,
          deadline,
          signer
        );
        setTxHash(txid);
        await pollTx(txid);
      } else {
        const amountOutBase = parseUnits(amountOut, tokenOut.decimals);
        const quotedIn = parseUnits(amountIn || "0", tokenIn.decimals);
        const amountInMax = applySlippageMax(quotedIn, slippageBps);
        await ensureAllowance(
          tokenIn.address,
          address,
          SUNSWAP_ROUTER_ADDRESS,
          amountInMax,
          signer
        );
        const txid = await swapTokensForExactTokens(
          amountOutBase,
          amountInMax,
          path,
          address,
          deadline,
          signer
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
  }, [amountIn, amountOut, exactMode, path, slippageBps, tokenIn, tokenOut, address, signer]);

  const isSwapDisabled = !isConnected || !canQuote || isSwapping || isQuoting;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Swap</div>
            <div className="text-xs text-zinc-500">SunSwap router direct integration</div>
          </div>
          <div className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            {tron.chainId || "Unknown network"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={exactMode === "exactIn" ? "default" : "outline"}
            size="sm"
            onClick={() => setExactMode("exactIn")}
          >
            Exact In
          </Button>
          <Button
            variant={exactMode === "exactOut" ? "default" : "outline"}
            size="sm"
            onClick={() => setExactMode("exactOut")}
          >
            Exact Out
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Slippage (bps)</span>
            <Input
              className="h-9 w-28 text-right"
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value) || 0)}
              inputMode="numeric"
            />
          </div>
          <div className="mt-2 text-xs text-zinc-500">Quote updates automatically.</div>
        </div>

        {quoteError && <div className="text-sm text-red-600">{quoteError}</div>}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={quoteSwap} disabled={isQuoting || !canQuote}>
            {isQuoting ? "Quoting..." : "Refresh Quote"}
          </Button>
          {needsApproval && (
            <Button variant="secondary" onClick={onApprove} disabled={!isConnected || isApproving}>
              {isApproving ? "Approving..." : "Approve"}
            </Button>
          )}
          <Button onClick={onSwap} disabled={isSwapDisabled}>
            {isSwapping ? "Swapping..." : "Swap"}
          </Button>
        </div>

        <TxStatus txHash={txHash} status={txStatus} />
      </CardContent>
    </Card>
  );
}
