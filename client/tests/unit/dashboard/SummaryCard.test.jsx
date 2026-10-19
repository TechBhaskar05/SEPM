import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import SummaryCard from '../../../src/components/dashboard/SummaryCard.jsx';

describe('SummaryCard', () => {
  it('shows the muted label and the headline figure', () => {
    render(
      <SummaryCard
        label="Total Balance"
        value="₹37,500.00"
        icon={Wallet}
        tone="primary"
      />,
    );

    expect(screen.getByText('Total Balance')).toHaveClass(
      'text-text-secondary',
    );
    expect(screen.getByText('₹37,500.00')).toHaveClass('text-primary');
  });

  it('uses the success tint for income and savings', () => {
    render(
      <SummaryCard
        label="Income"
        value="₹9,000.00"
        icon={Wallet}
        tone="success"
      />,
    );

    expect(screen.getByText('₹9,000.00')).toHaveClass('text-success');
  });

  it('keeps expenses neutral rather than danger', () => {
    render(
      <SummaryCard
        label="Expenses"
        value="₹3,500.00"
        icon={Wallet}
        tone="neutral"
      />,
    );

    const value = screen.getByText('₹3,500.00');
    expect(value).toHaveClass('text-text');
    expect(value).not.toHaveClass('text-danger');
  });

  it('falls back to the primary tone for an unknown one', () => {
    render(
      <SummaryCard
        label="Balance"
        value="₹0.00"
        icon={Wallet}
        tone="mystery"
      />,
    );

    expect(screen.getByText('₹0.00')).toHaveClass('text-primary');
  });
});
