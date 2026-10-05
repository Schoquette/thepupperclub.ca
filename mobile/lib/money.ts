/** Format a number as "1,234.56" (comma-grouped, always 2 decimal places). */
export const formatMoney = (n: number | string): string =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
