import { SUNSWAP_ROUTER_ADDRESS, USDT_TRC20_ADDRESS } from "./constants";
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

export const getAmountsOut = async (amountIn: bigint, path: string[]): Promise<bigint[]> => {
  const router = await getRouterContract();
  const result = await router.getAmountsOut(amountIn.toString(), path).call();
  return result.map((value: string) => BigInt(value));
};

export const getAmountsIn = async (amountOut: bigint, path: string[]): Promise<bigint[]> => {
  const router = await getRouterContract();
  const result = await router.getAmountsIn(amountOut.toString(), path).call();
  return result.map((value: string) => BigInt(value));
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
