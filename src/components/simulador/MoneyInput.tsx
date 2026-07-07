import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, handleCurrencyChange, numberToRawCurrency, parseCurrencyToNumber } from "@/utils/currencyFormat";

interface MoneyInputProps {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Campo monetário com máscara BRL automática (R$ 500.000,00).
 * O usuário digita apenas números; a formatação acontece sozinha.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, placeholder = "R$ 0,00", id, className, disabled }, ref) => {
    const display = value > 0 ? formatCurrencyInput(numberToRawCurrency(value)) : "";
    return (
      <Input
        ref={ref}
        id={id}
        inputMode="numeric"
        className={className}
        disabled={disabled}
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const raw = handleCurrencyChange(e.target.value);
          const formatted = formatCurrencyInput(raw);
          onValueChange(parseCurrencyToNumber(formatted));
        }}
      />
    );
  },
);

MoneyInput.displayName = "MoneyInput";
