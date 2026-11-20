export function formatNaira(amount: number): string {
  if (!Number.isFinite(amount)) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function calculateDiscountPercentage(price: number, salePrice?: number | null): number | null {
  if (!salePrice || salePrice <= 0 || salePrice >= price) return null;
  return Math.round(((price - salePrice) / price) * 100);
}

export function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
