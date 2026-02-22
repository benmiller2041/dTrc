import { SUNSWAP_ROUTER_ADDRESS, USDT_TRC20_ADDRESS } from "./constants";
import routerAbi from "../abis/router.json";
import { getTronWeb } from "./tron";

const requireTronWeb = () => {
  const tronWeb = getTronWeb();
  if (!tronWeb || !tronWeb.ready) {
    throw new Error("TronWeb not available. Connect a Tron-compatible wallet.");
  }
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
  deadline: number
) => {
  const router = await getRouterContract();
  return router
    .swapExactTokensForTokens(
      amountIn.toString(),
      amountOutMin.toString(),
      path,
      to,
      deadline
    )
    .send();
};

export const swapTokensForExactTokens = async (
  amountOut: bigint,
  amountInMax: bigint,
  path: string[],
  to: string,
  deadline: number
) => {
  const router = await getRouterContract();
  return router
    .swapTokensForExactTokens(
      amountOut.toString(),
      amountInMax.toString(),
      path,
      to,
      deadline
    )
    .send();
};

export const buildPath = (tokenIn: string, tokenOut: string): string[] => {
  if (tokenIn === tokenOut) return [tokenIn];
  if (tokenIn === USDT_TRC20_ADDRESS || tokenOut === USDT_TRC20_ADDRESS) {
    return [tokenIn, tokenOut];
  }
  return [tokenIn, USDT_TRC20_ADDRESS, tokenOut];
};
