"use client";

import { useMemo } from "react";
import { useWallet } from "./WalletProvider";
import { useIsMobile } from "../../lib/useIsMobile";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export default function WalletConnect() {
  const { tron, walletConnect, isConnected, address } = useWallet();
  const isMobile = useIsMobile();

  const truncatedAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const walletStatus = useMemo(() => {
    if (walletConnect.connected && walletConnect.address) {
      return `WalletConnect: ${truncatedAddress}`;
    }
    if (tron.isConnected && tron.address) {
      return `TronLink: ${truncatedAddress}`;
    }
    return "Not connected";
  }, [tron.isConnected, tron.address, walletConnect.connected, walletConnect.address, truncatedAddress]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Wallet</div>
        <div className="text-sm font-medium text-zinc-900 break-all">{walletStatus}</div>

        {/* ---- Mobile: WalletConnect only ---- */}
        {isMobile ? (
          <div className="flex flex-col gap-2">
            {walletConnect.connected ? (
              <>
                <Button variant="outline" className="w-full" disabled>
                  ✓ Connected via WalletConnect
                </Button>
                <Button variant="ghost" className="w-full" onClick={walletConnect.disconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={walletConnect.connect}
                disabled={!walletConnect.client}
                title={
                  !walletConnect.client
                    ? "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
                    : undefined
                }
              >
                Connect Wallet
              </Button>
            )}
            {!isConnected && (
              <div className="text-xs text-zinc-500">
                Tap Connect to open your mobile wallet (Trust Wallet, TronLink, etc.) via
                WalletConnect.
              </div>
            )}
          </div>
        ) : (
          /* ---- Desktop: both TronLink and WalletConnect ---- */
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => tron.connect()}>
                {tron.isConnected ? "TronLink Connected" : "Connect TronLink"}
              </Button>
              <Button
                variant="outline"
                onClick={walletConnect.connect}
                disabled={!walletConnect.client}
                title={
                  !walletConnect.client
                    ? "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
                    : undefined
                }
              >
                {walletConnect.connected ? "WalletConnect Connected" : "Connect via WalletConnect"}
              </Button>
              {walletConnect.connected && (
                <Button variant="ghost" onClick={walletConnect.disconnect}>
                  Disconnect
                </Button>
              )}
            </div>
            {!isConnected && (
              <div className="text-xs text-zinc-500">
                Swaps require a Tron wallet. Use TronLink extension or WalletConnect.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
