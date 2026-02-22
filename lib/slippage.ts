export const applySlippageMin = (amount: bigint, slippageBps: number): bigint => {
  const bps = BigInt(slippageBps);
  return (amount * (10000n - bps)) / 10000n;
};

export const applySlippageMax = (amount: bigint, slippageBps: number): bigint => {
  const bps = BigInt(slippageBps);
  return (amount * (10000n + bps)) / 10000n;
};

export const getDeadline = (deadlineSeconds: number): number => {
  return Math.floor(Date.now() / 1000) + deadlineSeconds;
};
