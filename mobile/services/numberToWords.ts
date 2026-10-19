/**
 * Converts a numeric Indian Rupee amount into formal Indian English words.
 * Handles Crores, Lakhs, Thousands, Hundreds, Tens, Units, and Paise.
 *
 * Examples:
 * - 200 -> "Two Hundred Rupees Only"
 * - 320 -> "Three Hundred Twenty Rupees Only"
 * - 1250.50 -> "One Thousand Two Hundred Fifty Rupees and Fifty Paise Only"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    const h = Math.floor(n / 100);
    str += ONES[h] + ' Hundred';
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n >= 20) {
    const t = Math.floor(n / 10);
    str += TENS[t];
    const u = n % 10;
    if (u > 0) str += ' ' + ONES[u];
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

export function numberToIndianRupeesWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Zero Rupees Only';
  }

  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const absAmount = Math.abs(rounded);

  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  if (rupees === 0 && paise === 0) {
    return 'Zero Rupees Only';
  }

  const parts: string[] = [];

  let rem = rupees;

  // Crores (>= 1,00,00,000)
  if (rem >= 10000000) {
    const cr = Math.floor(rem / 10000000);
    parts.push(convertBelowThousand(cr) + ' Crore');
    rem %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (rem >= 100000) {
    const lk = Math.floor(rem / 100000);
    parts.push(convertBelowThousand(lk) + ' Lakh');
    rem %= 100000;
  }

  // Thousands (>= 1,000)
  if (rem >= 1000) {
    const th = Math.floor(rem / 1000);
    parts.push(convertBelowThousand(th) + ' Thousand');
    rem %= 1000;
  }

  // Hundreds & remaining
  if (rem > 0) {
    parts.push(convertBelowThousand(rem));
  }

  let words = parts.filter(Boolean).join(' ').trim();
  if (!words) {
    words = 'Zero';
  }

  let result = `${words} ${rupees === 1 ? 'Rupee' : 'Rupees'}`;

  if (paise > 0) {
    const paiseWords = convertBelowThousand(paise);
    result += ` and ${paiseWords} ${paise === 1 ? 'Paise' : 'Paise'}`;
  }

  result += ' Only';

  if (isNegative) {
    result = 'Minus ' + result;
  }

  return result;
}
