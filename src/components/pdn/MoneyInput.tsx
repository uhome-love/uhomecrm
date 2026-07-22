import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { parseMoney, formatMoneyInput } from "@/lib/fmtMoney";

/**
 * BRL money input. Shows the value formatted ("R$ 250.000") when not focused,
 * lets the user type freely while focused, and commits a parsed number on blur/Enter.
 */
export function MoneyInput({
  value,
  onCommit,
  placeholder = "—",
  className = "",
  variant = "cell",
}: {
  value: number;
  onCommit: (v: number) => void;
  placeholder?: string;
  className?: string;
  /** "cell" = transparent inline (planilha); "field" = bordered (drawer/form). */
  variant?: "cell" | "field";
}) {
  const displayFor = (v: number) => (v > 0 ? formatMoneyInput(v) : "");
  const [local, setLocal] = useState(displayFor(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(displayFor(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const parsed = parseMoney(local);
    setLocal(displayFor(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  const base =
    variant === "cell"
      ? "h-8 w-[130px] border-transparent bg-transparent px-2 tabular-nums hover:border-border focus:border-primary"
      : "tabular-nums";

  return (
    <Input
      inputMode="numeric"
      value={local}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${base} ${className}`}
    />
  );
}
