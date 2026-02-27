import { SUNSWAP_ROUTER_ADDRESS, USDT_TRC20_ADDRESS, WTRX_ADDRESS } from "./constants";
import routerAbi from "../abis/router.json";
import { buildContractTransaction, getReadonlyTronWeb, signAndBroadcast, WalletSigner } from "./tron";

const requireTronWeb = () => {
  const tronWeb = getReadonlyTronWeb();
  return tronWeb;
};

export const getRouterContract = async () => {
  const tronWeb = requireTronWeb();
  return tronWeb.contract(routerAbi as any, SUNSWAP_ROUTER_ADDRESS);
};

/**
 * Manually decode ABI-encoded uint256[] from a hex string.
 * Layout: [32-byte offset][32-byte length][length × 32-byte elements]
 */
const decodeUint256Array = (hex: string): bigint[] => {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length < 128) throw new Error("Router returned invalid ABI data");
  const length = parseInt(raw.slice(64, 128), 16);
  const result: bigint[] = [];
  for (let i = 0; i < length; i++) {
    const start = 128 + i * 64;
    result.push(BigInt("0x" + raw.slice(start, start + 64)));
  }
  return result;
};

export const getAmountsOut = async (
  amountIn: bigint,
  path: string[],
  ownerAddress?: string | null
): Promise<bigint[]> => {
  const tronWeb = getReadonlyTronWeb();
  const caller = ownerAddress || WTRX_ADDRESS;
  const response = await tronWeb.transactionBuilder.triggerConstantContract(
    SUNSWAP_ROUTER_ADDRESS,
    "getAmountsOut(uint256,address[])",
    {},
    [
      { type: "uint256", value: amountIn.toString() },
      { type: "address[]", value: path }
    ],
    caller
  );
  if (!response?.result?.result) {
    throw new Error("No liquidity for this pair or amount is too small");
  }
  const hex: string = response.constant_result?.[0] ?? "";
  if (!hex) throw new Error("Empty response from router");
  return decodeUint256Array(hex);
};

export const getAmountsIn = async (
  amountOut: bigint,
  path: string[],
  ownerAddress?: string | null
): Promise<bigint[]> => {
  const tronWeb = getReadonlyTronWeb();
  const caller = ownerAddress || WTRX_ADDRESS;
  const response = await tronWeb.transactionBuilder.triggerConstantContract(
    SUNSWAP_ROUTER_ADDRESS,
    "getAmountsIn(uint256,address[])",
    {},
    [
      { type: "uint256", value: amountOut.toString() },
      { type: "address[]", value: path }
    ],
    caller
  );
  if (!response?.result?.result) {
    throw new Error("No liquidity for this pair or amount is too small");
  }
  const hex: string = response.constant_result?.[0] ?? "";
  if (!hex) throw new Error("Empty response from router");
  return decodeUint256Array(hex);
};

export const swapExactTokensForTokens = async (
  amountIn: bigint,
  amountOutMin: bigint,
  path: string[],
  to: string,
  deadline: number,
  signer: WalletSigner
) => {
  const tx = await buildContractTransaction(
    SUNSWAP_ROUTER_ADDRESS,
    "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
    [
      { type: "uint256", value: amountIn.toString() },
      { type: "uint256", value: amountOutMin.toString() },
      { type: "address[]", value: path },
      { type: "address", value: to },
      { type: "uint256", value: deadline }
    ],
    signer.address
  );
  return signAndBroadcast(tx, signer);
};

export const swapTokensForExactTokens = async (
  amountOut: bigint,
  amountInMax: bigint,
  path: string[],
  to: string,
  deadline: number,
  signer: WalletSigner
) => {
  const tx = await buildContractTransaction(
    SUNSWAP_ROUTER_ADDRESS,
    "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
    [
      { type: "uint256", value: amountOut.toString() },
      { type: "uint256", value: amountInMax.toString() },
      { type: "address[]", value: path },
      { type: "address", value: to },
      { type: "uint256", value: deadline }
    ],
    signer.address
  );
  return signAndBroadcast(tx, signer);
};

export const buildPath = (tokenIn: string, tokenOut: string): string[] => {
  if (tokenIn === tokenOut) return [tokenIn];
  if (tokenIn === USDT_TRC20_ADDRESS || tokenOut === USDT_TRC20_ADDRESS) {
    return [tokenIn, tokenOut];
  }
  return [tokenIn, USDT_TRC20_ADDRESS, tokenOut];
};
