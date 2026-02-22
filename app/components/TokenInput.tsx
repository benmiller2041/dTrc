"use client";

import { TokenInfo } from "../../lib/tokens";

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
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 text-xs uppercase text-zinc-500">{label}</div>
      <div className="flex items-center gap-3">
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm"
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
        <input
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-right text-sm"
          placeholder="0.0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          inputMode="decimal"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
