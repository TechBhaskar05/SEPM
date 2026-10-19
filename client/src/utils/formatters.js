/**
 * Display formatting.
 *
 * Money crosses the API as an integer number of paise (conventions.md "Money
 * handling") and is turned into a string here, at the presentation boundary
 * only. Nothing in the app concatenates a currency symbol onto a number by
 * hand - `formatMoney` is the one place that knows the rate.
 */

const PAISE_PER_RUPEE = 100;

const RUPEE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * 124900 -> "₹1,249.00". Rounding happens here in the formatter, on an
 * integer, never on a float the app was carrying around.
 */
export function formatMoney(paise) {
  const value = Math.round(Number(paise));
  if (!Number.isSafeInteger(value)) return '₹0.00';

  // Split into whole rupees and leftover paise rather than dividing once and
  // re-formatting: 50 paise has to render as 0.50, and Math.round(value / 100)
  // sends it to 1.00.
  const rupees = Math.floor(value / PAISE_PER_RUPEE);
  const remainder = value % PAISE_PER_RUPEE;

  return `₹${RUPEE.format(rupees)}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Signed form for a ledger row: income carries a leading "+", everything else
 * a leading "-". The sign is presentation, so it is decided here rather than
 * at each call site.
 */
export function formatSignedMoney(paise, type) {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(Number(paise) || 0))}`;
}

/** "2026-10-18" -> "18 Oct 2026". Invalid or empty input passes through. */
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Today's date as YYYY-MM-DD in local time - the form's default. */
export function todayIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * The current month as the "YYYY-MM" period a budget belongs to.
 *
 * Local time, matching `todayIso` above rather than the server's UTC
 * `periodForDate`. The two agree on the month a transaction lands in because a
 * transaction date travels as a bare "YYYY-MM-DD", which parses as UTC
 * midnight - the offset never moves it across a month boundary.
 */
export function currentPeriod() {
  return todayIso().slice(0, 7);
}

/** "2026-10" -> "October 2026". Anything unparseable passes through. */
export function formatPeriod(period) {
  if (!period) return '';
  const date = new Date(`${period}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(period);

  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Parses a rupee amount the user typed ("1,249.50", "1249.5", "₹900") into
 * integer paise, or null if it is not a usable positive amount.
 *
 * Done with string arithmetic rather than parseFloat * 100: the float route
 * is exactly what conventions.md forbids, and 0.1 + 0.2 style drift shows up
 * as an off-by-one-paise ledger.
 */
export function rupeesToPaise(input) {
  const cleaned = String(input ?? '')
    .replace(/[₹,\s]/g, '')
    .trim();

  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;

  const [rupeesPart, paisePart = ''] = cleaned.split('.');
  if (rupeesPart === '' && paisePart === '') return null;

  // More than two decimal places is a precision the ledger cannot hold.
  if (paisePart.length > 2) return null;

  const rupees = Number(rupeesPart || 0);
  const paise = Number(paisePart.padEnd(2, '0') || 0);
  const total = rupees * PAISE_PER_RUPEE + paise;

  if (!Number.isSafeInteger(total) || total <= 0) return null;
  return total;
}

/** "1249.5" -> "1249.50", for showing back what the user typed. */
export function formatRupeesInput(paise) {
  const value = Number(paise);
  if (!Number.isFinite(value)) return '';
  return (value / PAISE_PER_RUPEE).toFixed(2);
}
