"use client";

import { useMemo } from "react";
import { useWallet } from "./WalletProvider";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export default function WalletConnect() {
  const { tron, walletConnect, isConnected } = useWallet();

  const walletStatus = useMemo(() => {
    if (tron.isConnected) {
      return `TronLink: ${tron.address}`;
    }
    if (walletConnect.connected && walletConnect.address) {
      return `WalletConnect: ${walletConnect.address}`;
    }
    return "Not connected";
  }, [tron.isConnected, tron.address, walletConnect.connected, walletConnect.address]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Wallet</div>
        <div className="text-sm font-medium text-zinc-900">{walletStatus}</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => tron.connect()}>
            {tron.isConnected ? "TronLink Connected" : "Connect TronLink"}
          </Button>
          <Button
            variant="outline"
            onClick={walletConnect.connect}
            disabled={!walletConnect.client}
            title={!walletConnect.client ? "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" : undefined}
          >
            {walletConnect.connected ? "Trust Wallet Connected" : "Connect Trust Wallet"}
          </Button>
          {walletConnect.connected && (
            <Button variant="ghost" onClick={walletConnect.disconnect}>
              Disconnect
            </Button>
          )}
        </div>
        {!isConnected && (
          <div className="text-xs text-zinc-500">
            Swaps require a Tron wallet. WalletConnect signing is enabled when connected.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
