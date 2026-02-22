import { buildContractTransaction, getReadonlyTronWeb, signAndBroadcast, WalletSigner } from "./tron";
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
  const tronWeb = getReadonlyTronWeb();
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

export const approve = async (
  tokenAddress: string,
  spender: string,
  amount: bigint,
  signer: WalletSigner
) => {
  const tx = await buildContractTransaction(
    tokenAddress,
    "approve(address,uint256)",
    [
      { type: "address", value: spender },
      { type: "uint256", value: amount.toString() }
    ],
    signer.address
  );
  return signAndBroadcast(tx, signer);
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
  requiredAmount: bigint,
  signer: WalletSigner
): Promise<boolean> => {
  const current = await allowance(tokenAddress, owner, spender);
  if (current >= requiredAmount) return false;
  await approve(tokenAddress, spender, requiredAmount, signer);
  return true;
};
