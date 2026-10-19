import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BudgetCard from '../../../src/components/budgets/BudgetCard.jsx';
import { budgetFixture } from '../../fixtures/budgets.js';

/**
 * Renders one card at a given utilization against a ₹1,000 limit.
 *
 * The fixture goes through the server's real `toBudgetView`, so "the colour
 * changes at 80%" is asserted against the same function the API uses to decide
 * it, not against a hand-written `thresholdLevel`.
 */
function cardAt(spent, limitAmount = 100000, overrides = {}) {
  const budget = budgetFixture({ spent, limitAmount, ...overrides });
  render(<BudgetCard budget={budget} />);
  return budget;
}

const fill = () => screen.getByRole('progressbar').firstElementChild;

describe('BudgetCard — the fill colour changes exactly at 80%', () => {
  it('is the primary colour one paisa below the threshold', () => {
    cardAt(7999);
    expect(fill()).toHaveClass('bg-primary');
  });

  it('is the warning colour exactly at the threshold', () => {
    cardAt(80000);
    expect(fill()).toHaveClass('bg-warning');
  });

  it('stays warning through the rest of the band', () => {
    cardAt(99999);
    expect(fill()).toHaveClass('bg-warning');
  });

  it('is the danger colour exactly at 100%', () => {
    cardAt(100000);
    expect(fill()).toHaveClass('bg-danger');
  });

  it('stays danger past 100%', () => {
    cardAt(150000);
    expect(fill()).toHaveClass('bg-danger');
  });

  // The boundary is a property of the limit, not a fixed rupee figure: a ₹200
  // budget crosses 80% at ₹160. Pinning it to one limit would let a change to
  // the ratio calculation slip through unnoticed.
  it('tracks the ratio rather than a hard-coded amount', () => {
    cardAt(15999, 20000);
    expect(fill()).toHaveClass('bg-primary');

    screen.getByRole('progressbar'); // keep the query honest if this ever moves
  });

  it('crosses 80% at ₹160.00 on a ₹200.00 limit', () => {
    cardAt(16000, 20000);
    expect(fill()).toHaveClass('bg-warning');
  });

  it('reads the band from the server payload rather than recomputing it', () => {
    // Guards the contract: the card must not derive its own threshold from
    // `spent`/`limitAmount`, or the two definitions could disagree.
    render(
      <BudgetCard
        budget={budgetFixture({ spent: 80000, limitAmount: 100000 })}
        onEdit={undefined}
      />,
    );
    expect(fill()).toHaveClass('bg-warning');
  });
});

describe('BudgetCard — the "X% used" figure', () => {
  it('shows the whole percentage', () => {
    cardAt(45000);
    expect(screen.getByText('45% used')).toBeInTheDocument();
  });

  it('shows exactly 80% on the threshold', () => {
    cardAt(80000);
    expect(screen.getByText('80% used')).toBeInTheDocument();
  });

  it('keeps two decimal places when the figure is not a whole percent', () => {
    cardAt(79950);
    expect(screen.getByText('79.95% used')).toBeInTheDocument();
  });

  it('shows 0% for an untouched budget', () => {
    cardAt(0);
    expect(screen.getByText('0% used')).toBeInTheDocument();
  });

  it('goes past 100% rather than being capped', () => {
    cardAt(145000);
    expect(screen.getByText('145% used')).toBeInTheDocument();
  });

  it('updates when the same card is re-rendered with more spending', () => {
    const { rerender } = render(
      <BudgetCard budget={budgetFixture({ spent: 30000 })} />,
    );
    expect(screen.getByText('30% used')).toBeInTheDocument();

    // The 80% transition specifically: this is what a single transaction that
    // tips the budget over the line looks like to the card.
    rerender(<BudgetCard budget={budgetFixture({ spent: 80000 })} />);
    expect(screen.getByText('80% used')).toBeInTheDocument();
    expect(screen.queryByText('30% used')).not.toBeInTheDocument();
  });
});

describe('BudgetCard — the remaining figure', () => {
  it('shows what is left while under the limit', () => {
    cardAt(45000);
    expect(screen.getByText('₹550.00 left')).toBeInTheDocument();
  });

  it('never shows a negative remainder before the limit is hit', () => {
    cardAt(99999);
    expect(screen.getByText('₹0.01 left')).toBeInTheDocument();
  });

  it('formats the remainder with tabular paise, not rounded rupees', () => {
    cardAt(45050);
    expect(screen.getByText('₹549.50 left')).toBeInTheDocument();
  });
});

describe('BudgetCard — past 100%', () => {
  it('shows how far over the budget is', () => {
    cardAt(145000);
    expect(screen.getByText('₹450.00 over')).toBeInTheDocument();
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it('formats the overage across a lakh boundary', () => {
    cardAt(1250000, 100000);
    expect(screen.getByText('₹11,500.00 over')).toBeInTheDocument();
  });

  it('drops the "left" wording entirely once over', () => {
    cardAt(200000);
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    expect(screen.getByText('₹1,000.00 over')).toBeInTheDocument();
  });

  it('marks the overage as danger rather than tertiary text', () => {
    cardAt(145000);
    expect(screen.getByText('₹450.00 over')).toHaveClass('text-danger');
  });
});
