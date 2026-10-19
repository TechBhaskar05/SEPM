import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import GoalCard from '../../../src/components/goals/GoalCard.jsx';
import { goalFixture } from '../../fixtures/goals.js';

/**
 * The card is where the goal's three answers have to be legible in that order:
 * what it is, how far along it is, and what to do next. The fixtures come from
 * the server's real `toGoalView`, so the contribution and the achieved/overdue
 * states are the ones the API would actually send.
 */

function renderCard(overrides = {}, props = {}) {
  const goal = goalFixture(overrides);
  render(<GoalCard goal={goal} {...props} />);
  return goal;
}

describe('GoalCard — the header', () => {
  it('shows the goal name as a heading', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { name: 'Japan trip' }),
    ).toBeInTheDocument();
  });

  it('shows the deadline as "Due Jan 2027"', () => {
    renderCard();
    expect(screen.getByText('Due Jan 2027')).toBeInTheDocument();
  });

  it('formats the deadline in UTC rather than the local timezone', () => {
    // A midnight-UTC deadline is still January in UTC. A local-time formatter
    // would show December to a user west of UTC, which is the bug this test
    // exists to catch.
    renderCard({ deadline: '2027-01-01' });
    expect(screen.getByText('Due Jan 2027')).toBeInTheDocument();
  });
});

describe('GoalCard — saved versus target', () => {
  it('reads "Saved ₹X of ₹Y"', () => {
    renderCard();
    expect(
      screen.getByText((_, node) => {
        return (
          node?.tagName === 'P' &&
          node.textContent.replace(/\s+/g, ' ').trim() ===
            'Saved ₹2,500.00 of ₹10,000.00'
        );
      }),
    ).toBeInTheDocument();
  });

  it('renders the progress ring at the served percentage', () => {
    renderCard();
    const ring = screen.getByRole('progressbar', {
      name: 'Japan trip progress',
    });
    expect(ring).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('formats a lakh-sized target without losing paise', () => {
    renderCard({ targetAmount: 12500000, savedAmount: 2500000 });
    expect(
      screen.getByText((_, node) => {
        return (
          node?.tagName === 'P' &&
          node.textContent.replace(/\s+/g, ' ').trim() ===
            'Saved ₹25,000.00 of ₹1,25,000.00'
        );
      }),
    ).toBeInTheDocument();
  });
});

describe('GoalCard — the monthly contribution', () => {
  it('prominently shows what to save each month', () => {
    renderCard();
    const line = screen.getByText(
      /Save ₹2,500\.00\/month to reach this on time/,
    );
    expect(line).toHaveClass('bg-primary-subtle');
    expect(line).toHaveClass('font-semibold');
  });

  it('uses the served contribution rather than recomputing it', () => {
    // Mutate the served payload after the fixture's real maths has run: if the
    // card did its own maths this assertion would fail, which is the contract.
    const goal = goalFixture();
    goal.requiredMonthlyContribution = 12345;
    render(<GoalCard goal={goal} />);

    expect(
      screen.getByText(/Save ₹123\.45\/month to reach this on time/),
    ).toBeInTheDocument();
  });
});

describe('GoalCard — achieved goals', () => {
  it('replaces the monthly line with a success message', () => {
    renderCard({ savedAmount: 1000000 });
    expect(screen.getByText('Goal reached! 🎉')).toBeInTheDocument();
    expect(screen.queryByText(/to reach this on time/)).not.toBeInTheDocument();
  });

  it('marks the card complete with a success-tinted outline', () => {
    renderCard({ savedAmount: 1000000 });
    const card = screen
      .getByRole('heading', { name: 'Japan trip' })
      .closest('section');
    expect(card).toHaveClass('border-success/50');
    expect(card).toHaveClass('ring-success/20');
  });

  it('still shows the full saved / target figures', () => {
    renderCard({ savedAmount: 1000000 });
    expect(
      screen.getByText((_, node) => {
        return (
          node?.tagName === 'P' &&
          node.textContent.replace(/\s+/g, ' ').trim() ===
            'Saved ₹10,000.00 of ₹10,000.00'
        );
      }),
    ).toBeInTheDocument();
  });

  it('shows 100% and the success ring', () => {
    renderCard({ savedAmount: 1000000 });
    expect(screen.getByText('100%')).toBeInTheDocument();
    const arc = screen
      .getByRole('progressbar', { name: 'Japan trip progress' })
      .querySelectorAll('circle')[1];
    expect(arc).toHaveClass('stroke-success');
  });
});

describe('GoalCard — overdue goals', () => {
  it('asks for the whole remainder now instead of per month', () => {
    renderCard({ deadline: '2026-08-31' });
    expect(
      screen.getByText(/Save ₹7,500\.00 now to get back on track/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\/month/)).not.toBeInTheDocument();
  });

  it('turns the deadline badge into a danger badge', () => {
    renderCard({ deadline: '2026-08-31' });
    expect(screen.getByText('Due Aug 2026')).toHaveClass('bg-danger-subtle');
  });
});

describe('GoalCard — editing', () => {
  it('calls onEdit with the goal', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const goal = renderCard({}, { onEdit });

    await user.click(
      screen.getByRole('button', { name: 'Edit Japan trip goal' }),
    );
    expect(onEdit).toHaveBeenCalledWith(goal);
  });

  it('does not render an edit action when there is nowhere to send it', () => {
    renderCard();
    expect(
      screen.queryByRole('button', { name: /edit .* goal/i }),
    ).not.toBeInTheDocument();
  });
});
