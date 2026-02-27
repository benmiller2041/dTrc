export {};

declare global {
  interface Window {
    tronWeb?: TronWeb;
    tronLink?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      off?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }

  interface TronWeb {
    defaultAddress: {
      base58: string;
    };
    ready: boolean;
    fullNode: { host: string };
    trx: {
      getTransactionInfo: (txid: string) => Promise<any>;
      sign: (tx: any) => Promise<any>;
      sendRawTransaction: (tx: any) => Promise<any>;
    };
    transactionBuilder: {
      triggerSmartContract: (
        contractAddress: string,
        functionSelector: string,
        options: { feeLimit?: number; callValue?: number },
        parameters: { type: string; value: any }[],
        ownerAddress: string
      ) => Promise<{ transaction: any }>;
      triggerConstantContract: (
        contractAddress: string,
        functionSelector: string,
        options: object,
        parameters: { type: string; value: any }[],
        issuerAddress: string
      ) => Promise<{
        result: { result: boolean; message?: string };
        constant_result: string[];
        energy_used: number;
      }>;
    };
    contract: (abi?: any, address?: string) => any;
    toBigNumber: (value: string | number) => any;
  }
}
