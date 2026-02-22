import WalletConnect from "./components/WalletConnect";
import SwapForm from "./components/SwapForm";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(24,24,27,0.2)_0%,_rgba(24,24,27,0)_70%)]" />
      <header className="relative z-10 space-y-3">
        <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Tron / SunSwap</div>
        <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">TrcSwap</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Swap TRC20 assets through the SunSwap router with direct wallet signing. Manage slippage,
          preview quotes, and track transaction status in one place.
        </p>
      </header>
      <section className="relative z-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <WalletConnect />
          <div className="hidden rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 sm:block">
            Ensure your wallet is on TRON Mainnet and the router address is configured in
            <code className="ml-1 rounded bg-zinc-100 px-1">lib/constants.ts</code>.
          </div>
        </div>
        <SwapForm />
      </section>
    </main>
  );
}
