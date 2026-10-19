import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TransactionItem from '../../../src/components/transactions/TransactionItem.jsx';

function transaction(categoryName) {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 124900,
    description: 'Zoya Textiles',
    paymentMethod: 'UPI',
    date: '2026-10-18T12:00:00.000Z',
    category: { id: 'cat-1', name: categoryName },
  };
}

function renderItem(categoryName) {
  return render(
    <ul>
      <TransactionItem
        transaction={transaction(categoryName)}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </ul>,
  );
}

describe('TransactionItem — category colours', () => {
  it('renders the Food badge in the same amber tone as the dashboard slice', () => {
    renderItem('Food & Dining');

    // Desktop and mobile markup both live in the DOM; both must agree.
    const badges = screen.getAllByText('Food & Dining');
    expect(badges).toHaveLength(2);

    for (const badge of badges) {
      expect(badge).toHaveClass('bg-warning-subtle');
      expect(badge).toHaveClass('text-warning-on-subtle');
    }
  });

  it('maps a renamed category by name instead of the old slug', () => {
    renderItem('Groceries merchant');

    const badges = screen.getAllByText('Groceries merchant');
    expect(badges[0]).toHaveClass('bg-success-subtle');
  });
});
