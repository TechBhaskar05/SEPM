/**
 * One colour and one badge tone per category, everywhere.
 *
 * The chart, the transaction list badge and any future category-coloured
 * surface read from this mapping, so "Food & Dining" is the same amber in the
 * dashboard donut as it is in the Transactions ledger. Colours are literal
 * palette hexes rather than theme variables because SVG `fill` is not
 * guaranteed to resolve CSS custom properties in every browser; the values are
 * drawn from tailwind.config.js. The matching `tone` lets a Badge use the
 * semantic palette, which does adapt between light and dark mode.
 *
 * Unknown categories fall back to a deterministic hash, not `Math.random()`:
 * the same custom category keeps the same colour across renders and reloads.
 */

const CATEGORY_STYLES = [
  { pattern: /uncategor/i, color: '#94A3B8', tone: 'neutral' }, // neutral-400
  { pattern: /food|dining/i, color: '#F59E0B', tone: 'warning' }, // warning-500
  {
    pattern: /grocery|grocer|supermarket/i,
    color: '#10B981',
    tone: 'success',
  }, // success-500
  {
    pattern: /transport|travel|taxi|metro|bus/i,
    color: '#6366F1',
    tone: 'info',
  }, // info-500
  { pattern: /housing|rent|mortgage/i, color: '#0D9488', tone: 'primary' }, // primary-600
  {
    pattern: /utilit|bill|electric|water|gas/i,
    color: '#2DD4BF',
    tone: 'primary',
  }, // primary-400
  { pattern: /health|medical|doctor|pharm/i, color: '#F43F5E', tone: 'danger' }, // danger-500
  { pattern: /entertain|stream|movie|game/i, color: '#818CF8', tone: 'info' }, // info-400
  { pattern: /shopping|clothes|retail/i, color: '#D97706', tone: 'warning' }, // warning-600
  { pattern: /salary|income/i, color: '#059669', tone: 'success' }, // success-600
  {
    pattern: /subscription|credit card|emi/i,
    color: '#4F46E5',
    tone: 'info',
  }, // info-600
  { pattern: /other|misc/i, color: '#64748B', tone: 'neutral' }, // neutral-500
];

const FALLBACK_STYLES = [
  { color: '#0F766E', tone: 'primary' }, // primary-700
  { color: '#F59E0B', tone: 'warning' }, // warning-500
  { color: '#6366F1', tone: 'info' }, // info-500
  { color: '#E11D48', tone: 'danger' }, // danger-600
  { color: '#10B981', tone: 'success' }, // success-500
  { color: '#D97706', tone: 'warning' }, // warning-600
  { color: '#818CF8', tone: 'info' }, // info-400
  { color: '#64748B', tone: 'neutral' }, // neutral-500
];

const UNCATEGORISED_STYLE = { color: '#94A3B8', tone: 'neutral' };

/**
 * @param {string} name  The category's display name.
 * @returns {{ color: string, tone: string }} A stable colour + badge tone.
 */
export function categoryStyle(name) {
  const label = String(name ?? '').trim();
  if (!label) return UNCATEGORISED_STYLE;

  const known = CATEGORY_STYLES.find(({ pattern }) => pattern.test(label));
  if (known) return { color: known.color, tone: known.tone };

  // FNV-style 32-bit hash. Cheap and deterministic; the modulo only has to be
  // stable, not uniformly distributed over this handful of colours.
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }

  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length];
}

/** The chart colour for a category. */
export function categoryColor(name) {
  return categoryStyle(name).color;
}

/** The Badge tone for a category, chosen to match its chart colour family. */
export function categoryTone(name) {
  return categoryStyle(name).tone;
}
