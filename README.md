# TrcSwap Frontend

A Next.js (App Router) + TypeScript frontend that integrates directly with the SunSwap Router on TRON using TronLink/TronWeb. No custom smart contracts or backend required.

## Features
- Connect TronLink or Trust Wallet (WalletConnect v2)
- Quote swap outputs
- Approve TRC20 tokens
- Swap `swapExactTokensForTokens` / `swapTokensForExactTokens`
- Slippage + deadline handling
- Transaction hash + status display

## Prerequisites
- Node.js 18+
- TronLink (or a Tron-compatible wallet that injects `window.tronWeb`)
- SunSwap router address

## Setup
1. Install dependencies:

```bash
npm install
```

2. Configure constants in `lib/constants.ts`:
- `SUNSWAP_ROUTER_ADDRESS`
- `USDT_TRC20_ADDRESS` (default set)
- `WTRX_ADDRESS` (default set)

3. (Optional) WalletConnect project ID for Trust Wallet:

```bash
export NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="YOUR_PROJECT_ID"
```

4. Run the app:

```bash
npm run dev
```

## Usage
1. Connect your wallet.
2. Enter an amount and select tokens.
3. Review the quote and set slippage.
4. Approve (if needed), then swap.
5. View the transaction hash and status.

## Security Warnings
- Never paste or hardcode private keys.
- This UI relies on wallet-based signing only.
- Ensure `SUNSWAP_ROUTER_ADDRESS` is correct for the network.
- Swaps are subject to slippage and deadline constraints.

## Acceptance Criteria
- Connects TronLink
- Fetches quote
- Computes slippage
- Approves if needed
- Executes swap
- Shows txid and success state

## Notes
- Trust Wallet connection is via WalletConnect. Swaps require a wallet that injects TronWeb (e.g. TronLink) unless you implement a WalletConnect Tron provider.
