import WalletConnect from "./components/WalletConnect";
import SwapForm from "./components/SwapForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <div className="text-2xl font-semibold text-zinc-900">TrcSwap</div>
        <div className="text-sm text-zinc-500">Swap TRC20 tokens via SunSwap Router</div>
      </div>
      <WalletConnect />
      <SwapForm />
      <div className="text-xs text-zinc-500">
        Ensure your wallet is on TRON Mainnet and the router address is configured in
        <code className="ml-1 rounded bg-zinc-100 px-1">lib/constants.ts</code>.
      </div>
    </main>
  );
}
