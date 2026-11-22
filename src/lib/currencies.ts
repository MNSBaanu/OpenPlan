// Currencies offered in Project Information. The symbol is what appears in the plan; the code (ISO 4217) is
// what other programs, such as Microsoft Project, expect. Any other symbol can still be typed in.
export interface Currency { code: string; symbol: string; name: string }

export const CURRENCIES: Currency[] = [
  { code: 'LKR', symbol: 'Rs.', name: 'Sri Lankan rupee' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'PKR', symbol: 'Rs.', name: 'Pakistani rupee' },
  { code: 'NPR', symbol: 'Rs.', name: 'Nepalese rupee' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi taka' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African rand' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian naira' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan shilling' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian real' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican peso' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian pound' },
  { code: 'THB', symbol: '฿', name: 'Thai baht' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine peso' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar' },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira' },
  { code: 'ILS', symbol: '₪', name: 'Israeli shekel' },
  { code: 'PLN', symbol: 'zł', name: 'Polish złoty' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech koruna' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian forint' },
  { code: 'SEK', symbol: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', symbol: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', symbol: 'DKK', name: 'Danish krone' }
];

// The currency a project is in: its saved code, or else the one currency that uses its symbol. A symbol shared by
// several currencies (such as "Rs." or "$"-style ones) is not guessed, so no country is assumed.
export function currencyOf(code: string | undefined, symbol: string | undefined): Currency | undefined {
  const c = String(code || '').toUpperCase();
  const byCode = CURRENCIES.find(x => x.code === c);
  if (byCode) return byCode;
  const same = CURRENCIES.filter(x => x.symbol === (symbol || '').trim());
  return same.length === 1 ? same[0] : undefined;
}
