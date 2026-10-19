import { describe, expect, it } from 'vitest';

import { formatMoney } from '../../../src/utils/formatters.js';

describe('formatMoney', () => {
  it('renders whole rupees with two paise digits', () => {
    expect(formatMoney(124900)).toBe('₹1,249.00');
  });

  it('keeps a sub-rupee amount in the paise place', () => {
    expect(formatMoney(50)).toBe('₹0.50');
  });

  it('renders a negative amount with the sign in front of the symbol', () => {
    expect(formatMoney(-150000)).toBe('-₹1,500.00');
    expect(formatMoney(-50)).toBe('-₹0.50');
  });

  it('falls back to zero for an unusable value', () => {
    expect(formatMoney(Number.NaN)).toBe('₹0.00');
  });
});
