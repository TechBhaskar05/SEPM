import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SubscriptionCard from '../../../src/components/subscriptions/SubscriptionCard.jsx';
import { subscriptionFixture } from '../../fixtures/subscriptions.js';

function renderCard(overrides = {}, props = {}) {
  const subscription = subscriptionFixture(overrides);
  render(<SubscriptionCard subscription={subscription} {...props} />);
  return subscription;
}

describe('SubscriptionCard — identity and cost', () => {
  it('shows the service name as a heading', () => {
    renderCard();
    expect(screen.getAllByRole('heading', { name: 'Netflix' })).toHaveLength(2);
  });

  it('renders a coloured initial badge when there is no logo', () => {
    renderCard();
    const badge = screen.getAllByText('N')[0];

    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge.className).toMatch(
      /bg-(primary|success|warning|info|danger)-subtle/,
    );
  });

  it('uses the first letters of a multi-word service name', () => {
    renderCard({ name: 'YouTube Premium' });
    expect(screen.getAllByText('YP').length).toBeGreaterThan(0);
  });

  it('shows the amount and billing frequency', () => {
    renderCard();
    expect(screen.getAllByText('₹649.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/month').length).toBeGreaterThan(0);
  });

  it('labels a yearly subscription per year', () => {
    renderCard({ frequency: 'yearly', amount: 1200000 });
    expect(screen.getAllByText('₹12,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/year').length).toBeGreaterThan(0);
  });
});

describe('SubscriptionCard — renewal reminder', () => {
  it('shows a muted "renews in N days" badge outside the warning window', () => {
    renderCard({ nextRenewalDate: '2026-11-28' });
    const badge = screen.getAllByText('Renews in 40 days')[0];

    expect(badge).toHaveClass('bg-bg-subtle');
  });

  it('turns warning-amber within 7 days', () => {
    renderCard({ nextRenewalDate: '2026-10-24' });
    const badge = screen.getAllByText('Renews in 5 days')[0];

    expect(badge).toHaveClass('bg-warning-subtle');
    expect(badge).toHaveClass('text-warning-on-subtle');
  });

  it('treats exactly 7 days as within the warning window', () => {
    renderCard({ nextRenewalDate: '2026-10-26' });
    expect(screen.getAllByText('Renews in 7 days')[0]).toHaveClass(
      'bg-warning-subtle',
    );
  });

  it('stops warning at 8 days', () => {
    renderCard({ nextRenewalDate: '2026-10-27' });
    expect(screen.getAllByText('Renews in 8 days')[0]).toHaveClass(
      'bg-bg-subtle',
    );
  });

  it('says "Renews today" for a same-day renewal', () => {
    renderCard({ nextRenewalDate: '2026-10-19' });
    expect(screen.getAllByText('Renews today').length).toBeGreaterThan(0);
  });

  it('uses danger for an overdue renewal', () => {
    renderCard({ nextRenewalDate: '2026-10-17' });
    const badge = screen.getAllByText('Overdue by 2 days')[0];

    expect(badge).toHaveClass('bg-danger-subtle');
  });
});

describe('SubscriptionCard — actions', () => {
  it('calls onEdit with the subscription', async () => {
    const onEdit = vi.fn();
    const subscription = renderCard({}, { onEdit });

    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Edit Netflix' })[0]);

    expect(onEdit).toHaveBeenCalledWith(subscription);
  });

  it('calls onDelete with the subscription', async () => {
    const onDelete = vi.fn();
    const subscription = renderCard({}, { onDelete });

    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Delete Netflix' })[0]);

    expect(onDelete).toHaveBeenCalledWith(subscription);
  });

  it('omits actions when no handlers are given', () => {
    renderCard();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
