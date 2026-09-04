export function formatCurrencyCompact(num: number): string {
  if (typeof num !== 'number') return '₹0';
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(1) + 'L';
  }
  if (num >= 1000) {
    return '₹' + (num / 1000).toFixed(0) + 'k';
  }
  return '₹' + num.toString();
}

export function formatCurrencyDecimal(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
