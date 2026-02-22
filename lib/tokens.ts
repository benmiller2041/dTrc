import { getTronWeb } from "./tron";
import trc20Abi from "../abis/trc20.json";

export type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
};

export const TOKEN_LIST: TokenInfo[] = [
  { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", symbol: "USDT", decimals: 6 },
  { address: "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR", symbol: "WTRX", decimals: 6 }
];

const requireTronWeb = () => {
  const tronWeb = getTronWeb();
  if (!tronWeb || !tronWeb.ready) {
    throw new Error("TronWeb not available. Connect a Tron-compatible wallet.");
  }
  return tronWeb;
};

export const getTokenContract = async (tokenAddress: string) => {
  const tronWeb = requireTronWeb();
  return tronWeb.contract(trc20Abi as any, tokenAddress);
};

export const decimals = async (tokenAddress: string): Promise<number> => {
  const contract = await getTokenContract(tokenAddress);
  const value = await contract.decimals().call();
  return Number(value);
};

export const symbol = async (tokenAddress: string): Promise<string> => {
  const contract = await getTokenContract(tokenAddress);
  return contract.symbol().call();
};

export const allowance = async (tokenAddress: string, owner: string, spender: string): Promise<bigint> => {
  const contract = await getTokenContract(tokenAddress);
  const value = await contract.allowance(owner, spender).call();
  return BigInt(value.toString());
};

export const approve = async (tokenAddress: string, spender: string, amount: bigint) => {
  const contract = await getTokenContract(tokenAddress);
  return contract.approve(spender, amount.toString()).send();
};

export const balanceOf = async (tokenAddress: string, owner: string): Promise<bigint> => {
  const contract = await getTokenContract(tokenAddress);
  const value = await contract.balanceOf(owner).call();
  return BigInt(value.toString());
};

export const ensureAllowance = async (
  tokenAddress: string,
  owner: string,
  spender: string,
  requiredAmount: bigint
): Promise<boolean> => {
  const current = await allowance(tokenAddress, owner, spender);
  if (current >= requiredAmount) return false;
  await approve(tokenAddress, spender, requiredAmount);
  return true;
};
