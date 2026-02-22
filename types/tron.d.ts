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
    contract: (abi?: any, address?: string) => any;
    toBigNumber: (value: string | number) => any;
  }
}
