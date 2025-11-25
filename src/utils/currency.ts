/**
 * Convert cents to euros
 */
export function centsToEuro(value: number): number {
  return Math.round(value) / 100
}

/**
 * Format currency value in euros (from cents)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(centsToEuro(value))
}

/**
 * Round to 2 decimal places
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

