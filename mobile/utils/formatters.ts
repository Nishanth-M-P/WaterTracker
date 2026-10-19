/**
 * Sanitizes customer names, strictly preventing programming values such as 'None', 'null', 'undefined'
 * from ever being displayed in the UI, PDFs, or reports.
 */
export function formatCustomerName(name?: string | null, fallback: string = 'Unnamed Customer'): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'nan' ||
    lower === '' ||
    lower === 'n/a'
  ) {
    return fallback;
  }
  return trimmed;
}

/**
 * Checks whether a customer name is considered missing or placeholder ('Unnamed Customer', 'None', etc.)
 */
export function isPlaceholderCustomerName(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  return (
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'nan' ||
    lower === '' ||
    lower === 'n/a' ||
    lower.startsWith('unnamed customer') ||
    lower.startsWith('customer #')
  );
}
