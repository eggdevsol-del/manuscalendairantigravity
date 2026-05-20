export function formatCurrency(cents: number | undefined | null): string {
  if (cents == null || isNaN(cents)) {
    return "$0.00";
  }
  
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}
