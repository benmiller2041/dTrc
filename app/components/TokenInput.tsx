"use client";

import { TokenInfo } from "../../lib/tokens";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

type Props = {
  label: string;
  tokens: TokenInfo[];
  selected: TokenInfo;
  onSelect: (token: TokenInfo) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  disabled?: boolean;
};

export default function TokenInput({
  label,
  tokens,
  selected,
  onSelect,
  amount,
  onAmountChange,
  disabled
}: Props) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{label}</div>
        <div className="flex items-center gap-3">
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm shadow-sm"
            value={selected.address}
            onChange={(e) => {
              const next = tokens.find((token) => token.address === e.target.value);
              if (next) onSelect(next);
            }}
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
          <Input
            className="text-right"
            placeholder="0.0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            inputMode="decimal"
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
