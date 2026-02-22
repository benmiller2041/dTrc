Build a Next.js (App Router) + TypeScript frontend that integrates directly with SunSwap on TRON using TronLink and TronWeb, without deploying any custom smart contract.

The app must allow users to:

Connect Trustwallet, tronlink wallet

Approve TRC20 token

Quote swap output

Execute swapExactTokensForTokens

Execute swapTokensForExactTokens

Handle slippage + deadline

Display transaction hash + status

Tech Stack

Next.js 14+ (App Router)

TypeScript

TailwindCSS (optional UI)

Shadcn

TronWeb

TronLink (window.tronWeb)

walletconnect v2

No backend required

Project Structure
/app
  /page.tsx
  /components
      WalletConnect.tsx
      SwapForm.tsx
      TokenInput.tsx
      TxStatus.tsx
/lib
  tron.ts
  router.ts
  tokens.ts
  slippage.ts
  constants.ts
/abis
  router.json
  trc20.json
/types
  tron.d.ts
Requirements
1️⃣ Wallet Integration

Implement:

Detect TronLink

Request account access

Read connected address

Detect network (Mainne)

Expose hook:

useTronWallet()

Return:

address

isConnected

connect()

chainId

2️⃣ Router Integration (SunSwap)

Implement wrapper in /lib/router.ts:

Functions:

getAmountsOut(amountIn, path)
getAmountsIn(amountOut, path)
swapExactTokensForTokens(...)
swapTokensForExactTokens(...)

Must:

Instantiate contract using:

window.tronWeb.contract().at(SUNSWAP_ROUTER_ADDRESS)

Handle .call() for reads

Handle .send() for writes

3️⃣ TRC20 Integration

In /lib/tokens.ts implement:

decimals(tokenAddress)
symbol(tokenAddress)
allowance(owner, spender)
approve(tokenAddress, spender, amount)
balanceOf(tokenAddress, owner)

Auto-approve only if allowance < required.

4️⃣ Swap Logic
Exact Input Mode

Flow:

Convert human input → base units

Call getAmountsOut

Compute:

amountOutMin = quotedOut * (1 - slippageBps/10000)

Approve if needed

Call:

swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  path,
  userAddress,
  deadline
)
Exact Output Mode

Flow:

Convert desired output → base units

Call getAmountsIn

Compute:

amountInMax = quotedIn * (1 + slippageBps/10000)

Approve if needed

Call:

swapTokensForExactTokens(
  amountOut,
  amountInMax,
  path,
  userAddress,
  deadline
)
5️⃣ Slippage & Deadline

In /lib/slippage.ts:

Accept slippage in BPS (50 = 0.5%)

Compute min/max amounts safely

Deadline:

Math.floor(Date.now()/1000) + DEADLINE_SECONDS
6️⃣ Path Building

Support:

Direct path:

[tokenIn, tokenOut]

Two-hop path via WTRX:

[tokenIn, USDT TRC20, tokenOut]

Implement helper:

buildPath(tokenIn, tokenOut)
7️⃣ UI Requirements

SwapForm must include:

Token In selector

Token Out selector

Amount input

Slippage input

Toggle: Exact In / Exact Out

Quote preview

Approve button (conditional)

Swap button

Loading states

Error messages

Tx hash display with TronScan link

8️⃣ Error Handling

Handle:

User rejects transaction

Insufficient Energy

Insufficient Bandwidth

Allowance too low

Slippage exceeded

Deadline expired

Display readable messages.

9️⃣ Constants

In /lib/constants.ts define:

SUNSWAP_ROUTER_ADDRESS
USDT TRC20_ADDRESS
DEFAULT_SLIPPAGE_BPS = 50
DEFAULT_DEADLINE_SECONDS = 1200
🔟 Deliverables

The agent must generate:

Full working frontend

Clean modular architecture

No hardcoded private keys

Wallet-based signing only

Production-ready swap UI

README.md with:

Setup instructions

How to configure router address

Security warnings

Acceptance Criteria

When user:

Connects TronLink

Inputs amount

Clicks swap

The app must:

Fetch quote

Compute slippage

Approve if needed

Execute swap

Return txid

Show success state