/**
 * Format a raw numeric string (digits only) into Brazilian currency display: R$ 900.000,00
 */
export function formatCurrencyInput(raw: string): string {
  if (!raw) return "";
  // Ensure only digits
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  
  // Pad to at least 3 digits for cents
  const padded = digits.padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+/, "") || "0";
  const decPart = padded.slice(-2);
  
  // Add thousands separator
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${formatted},${decPart}`;
}

/**
 * Parse a formatted currency string back to a number.
 * Handles: "R$ 900.000,00" → 900000, "500000" → 500000, "R$ 1.500,50" → 1500.50
 */
export function parseCurrencyToNumber(value: string): number {
  if (!value) return 0;
  // Remove everything except digits
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  // Last 2 digits are cents
  const num = parseInt(digits, 10) / 100;
  return Math.round(num * 100) / 100; // avoid floating point issues
}

/**
 * Handle currency input change - extracts only digits from input
 */
export function handleCurrencyChange(inputValue: string): string {
  return inputValue.replace(/\D/g, "");
}

/**
 * Convert a number to raw digits string (cents-based) for use with formatCurrencyInput
 * e.g. 900000 → "90000000", 1500.50 → "150050"
 */
export function numberToRawCurrency(value: number | null | undefined): string {
  if (!value) return "";
  return Math.round(value * 100).toString();
}
