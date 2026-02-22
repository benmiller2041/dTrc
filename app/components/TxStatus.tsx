"use client";

import { Card, CardContent } from "./ui/card";

type Props = {
  txHash: string | null;
  status: "idle" | "pending" | "success" | "error";
};

export default function TxStatus({ txHash, status }: Props) {
  if (!txHash && status === "idle") return null;
  const label =
    status === "pending"
      ? "Pending"
      : status === "success"
      ? "Success"
      : status === "error"
      ? "Failed"
      : "";

  return (
    <Card>
      <CardContent className="text-sm">
        <div className="font-medium text-zinc-900">Transaction {label}</div>
        {txHash && (
          <a
            className="mt-2 block text-xs text-blue-600"
            href={`https://tronscan.org/#/transaction/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {txHash}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
