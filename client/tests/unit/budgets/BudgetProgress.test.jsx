import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BudgetProgress from '../../../src/components/budgets/BudgetProgress.jsx';

/**
 * The bar is the part of a budget card that can be read without reading any
 * number, so these assertions are mostly about the colour mapping and the
 * exposed ARIA state rather than the pixels - jsdom applies no stylesheet, so a
 * class name is the only honest thing to assert here. What that class name is
 * *is* the contract with the design system: `bg-warning` / `bg-danger` resolve
 * to the warning and danger tokens, and renaming one of them would fail the
 * build rather than these tests, which is the right order of precedence.
 */

const fillOf = (label) =>
  screen.getByRole('progressbar', { name: label }).firstElementChild;

describe('BudgetProgress — fill colour by threshold level', () => {
  it('fills with the primary colour while the budget is fine', () => {
    render(
      <BudgetProgress utilization={0.25} thresholdLevel="ok" label="Food" />,
    );
    expect(fillOf('Food')).toHaveClass('bg-primary');
  });

  it('fills with the warning colour once approaching', () => {
    render(
      <BudgetProgress
        utilization={0.8}
        thresholdLevel="approaching"
        label="Food"
      />,
    );
    expect(fillOf('Food')).toHaveClass('bg-warning');
  });

  it('fills with the danger colour once exceeded', () => {
    render(
      <BudgetProgress
        utilization={1.4}
        thresholdLevel="exceeded"
        label="Food"
      />,
    );
    expect(fillOf('Food')).toHaveClass('bg-danger');
  });

  it('never carries two band colours at once', () => {
    // Guards against a regression where a stale class is left behind on the
    // fill as the level changes, which CSS would resolve by source order rather
    // than by intent.
    const { rerender } = render(
      <BudgetProgress utilization={0.1} thresholdLevel="ok" label="Food" />,
    );
    expect(
      fillOf('Food').className.match(/bg-(primary|warning|danger)/g),
    ).toEqual(['bg-primary']);

    rerender(
      <BudgetProgress
        utilization={0.85}
        thresholdLevel="approaching"
        label="Food"
      />,
    );
    expect(
      fillOf('Food').className.match(/bg-(primary|warning|danger)/g),
    ).toEqual(['bg-warning']);

    rerender(
      <BudgetProgress
        utilization={1.2}
        thresholdLevel="exceeded"
        label="Food"
      />,
    );
    expect(
      fillOf('Food').className.match(/bg-(primary|warning|danger)/g),
    ).toEqual(['bg-danger']);
  });

  it('falls back to the primary colour for an unrecognised level', () => {
    render(
      <BudgetProgress
        utilization={0.5}
        thresholdLevel="nonsense"
        label="Food"
      />,
    );
    expect(fillOf('Food')).toHaveClass('bg-primary');
  });
});

describe('BudgetProgress — fill width', () => {
  it('fills in proportion to utilization', () => {
    render(
      <BudgetProgress utilization={0.4} thresholdLevel="ok" label="Food" />,
    );
    expect(fillOf('Food').style.width).toBe('40%');
  });

  it('clamps at a full track rather than running off the end of the card', () => {
    render(
      <BudgetProgress
        utilization={2.5}
        thresholdLevel="exceeded"
        label="Food"
      />,
    );
    expect(fillOf('Food').style.width).toBe('100%');
  });

  it('clamps a negative utilization to an empty track', () => {
    render(
      <BudgetProgress utilization={-1} thresholdLevel="ok" label="Food" />,
    );
    expect(fillOf('Food').style.width).toBe('0%');
  });

  it('treats a missing utilization as empty rather than NaN-width', () => {
    render(<BudgetProgress thresholdLevel="ok" label="Food" />);
    expect(fillOf('Food').style.width).toBe('0%');
  });
});

describe('BudgetProgress — accessible state', () => {
  it('reports the used percentage', () => {
    render(
      <BudgetProgress
        utilization={0.85}
        thresholdLevel="approaching"
        label="Food"
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Food' });
    expect(bar).toHaveAttribute('aria-valuenow', '85');
    expect(bar).toHaveAttribute('aria-valuetext', '85% of budget used');
  });

  // The card shows "₹200.00 over" for an overspent budget. Announcing that as
  // "180 of 100" would mix units on screen and in the accessibility tree.
  it('keeps valuemax at 100 even when overspent', () => {
    render(
      <BudgetProgress
        utilization={1.8}
        thresholdLevel="exceeded"
        label="Food"
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Food' });
    expect(bar).toHaveAttribute('aria-valuenow', '180');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});
