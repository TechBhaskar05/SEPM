import { describe, expect, it } from 'vitest';

import {
  categoryColor,
  categoryStyle,
  categoryTone,
} from '../../../src/utils/categoryColors.js';

describe('categoryColor', () => {
  it('maps the seeded categories to stable colours', () => {
    expect(categoryColor('Food & Dining')).toBe('#F59E0B');
    expect(categoryColor('Transport')).toBe('#6366F1');
    expect(categoryColor('Groceries')).toBe('#10B981');
  });

  it('pairs each colour with the Badge tone used elsewhere', () => {
    expect(categoryTone('Food & Dining')).toBe('warning');
    expect(categoryTone('Transport')).toBe('info');
    expect(categoryTone('Groceries')).toBe('success');
    expect(categoryTone('Housing')).toBe('primary');
    expect(categoryTone('Health')).toBe('danger');
    expect(categoryStyle('Food & Dining')).toEqual({
      color: '#F59E0B',
      tone: 'warning',
    });
  });

  it('is case-insensitive, so a renamed cased label keeps its colour', () => {
    expect(categoryColor('food & dining')).toBe(categoryColor('Food & Dining'));
  });

  it('gives uncategorised rows the neutral swatch', () => {
    expect(categoryColor('Uncategorised')).toBe('#94A3B8');
    expect(categoryColor(null)).toBe('#94A3B8');
    expect(categoryTone(null)).toBe('neutral');
  });

  it('keeps an unknown category on the same fallback colour every render', () => {
    const first = categoryColor('Board games');
    const second = categoryColor('Board games');

    expect(first).toBe(second);
    expect(first).toMatch(/^#[0-9A-F]{6}$/i);
    expect(categoryTone('Board games')).toBe(categoryTone('Board games'));
  });
});
