import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '../../src/pages/DashboardPage.jsx';

vi.mock('../../src/services/dashboardService.js', () => ({
  getDashboard: vi.fn(),
}));

// Recharts needs layout measurements that jsdom does not provide. The chart's
// own colour rules are covered by the categoryColor unit tests; this suite is
// about the page wiring the aggregate payload into the right regions.
vi.mock('../../src/components/dashboard/CategoryBreakdownChart.jsx', () => ({
  default: ({ data, total }) => (
    <div data-testid="category-chart">
      {data.length} categories · {total}
    </div>
  ),
}));

const { getDashboard } = await import('../../src/services/dashboardService.js');

const TRANSACTION = {
  id: 'tx-1',
  userId: 'user-1',
  categoryId: 'cat-food',
  type: 'expense',
  amount: 124900,
  description: 'Zoya Textiles',
  paymentMethod: 'UPI',
  date: '2026-10-18T12:00:00.000Z',
  source: 'manual',
  createdAt: '2026-10-18T12:00:00.000Z',
  category: { id: 'cat-food', name: 'Food & Dining' },
};

function dashboard(overrides = {}) {
  return {
    period: '2026-10',
    summary: {
      period: '2026-10',
      totalBalance: 3750000,
      totalIncome: 900000,
      totalExpenses: 350000,
      savings: 550000,
    },
    categoryBreakdown: [
      {
        categoryId: 'cat-food',
        categoryName: 'Food & Dining',
        amount: 350000,
        percentage: 100,
      },
    ],
    recentTransactions: [TRANSACTION],
    aiSummary: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getDashboard.mockReset();
});

describe('DashboardPage — loading', () => {
  it('shows skeleton regions rather than a full-page spinner', () => {
    getDashboard.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Total Balance')).not.toBeInTheDocument();
  });
});

describe('DashboardPage — the aggregate payload', () => {
  it('renders the four summary figures and the second row', async () => {
    getDashboard.mockResolvedValue(dashboard());

    renderPage();

    expect(await screen.findByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('₹37,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹9,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹3,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹5,500.00')).toBeInTheDocument();

    expect(screen.getByTestId('category-chart')).toHaveTextContent(
      '1 categories · 350000',
    );
    expect(screen.getByText('Zoya Textiles')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });

  it('shows the period in the chart heading', async () => {
    getDashboard.mockResolvedValue(dashboard());

    renderPage();

    expect(
      await screen.findByText('Spending in October 2026'),
    ).toBeInTheDocument();
  });

  it('omits the AI callout when no summary is available', async () => {
    getDashboard.mockResolvedValue(dashboard({ aiSummary: null }));

    renderPage();

    await screen.findByText('Total Balance');
    expect(screen.queryByText('AI-generated')).not.toBeInTheDocument();
  });

  it('shows the AI callout when a summary is available', async () => {
    getDashboard.mockResolvedValue(
      dashboard({ aiSummary: 'You spent less than last month.' }),
    );

    renderPage();

    expect(
      await screen.findByText('You spent less than last month.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Monthly summary')).toBeInTheDocument();
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
  });
});

describe('DashboardPage — failures', () => {
  it('shows the error and retries the fetch', async () => {
    getDashboard
      .mockRejectedValueOnce(new Error('Dashboard unavailable'))
      .mockResolvedValueOnce(dashboard());

    renderPage();

    expect(
      await screen.findByText('Dashboard unavailable'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Total Balance')).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});
