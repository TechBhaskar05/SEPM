import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  PieChart as PieChartIcon,
  Sparkles,
  Wallet,
} from 'lucide-react';

import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import CategoryBreakdownChart from '../components/dashboard/CategoryBreakdownChart.jsx';
import RecentTransactions from '../components/dashboard/RecentTransactions.jsx';
import SummaryCard from '../components/dashboard/SummaryCard.jsx';
import { getDashboard } from '../services/dashboardService.js';
import { formatMoney, formatPeriod } from '../utils/formatters.js';

/**
 * Dashboard: the month at a glance.
 *
 * Loading renders the real layout with skeletons in place of the figures,
 * chart and rows - never a full-page spinner - so the page keeps its height
 * and nothing shifts when the data lands.
 */

function SummaryCardSkeleton() {
  return (
    <Card className="h-full">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 shrink-0" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-4 h-8 w-36" />
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Skeleton className="size-40 rounded-full" />
      <div className="w-full space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading recent transactions</span>
      <ul>
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Category Breakdown" className="h-full lg:col-span-3">
          <ChartSkeleton />
        </Card>
        <Card
          title="Recent Transactions"
          padded={false}
          className="h-full lg:col-span-2"
        >
          <RecentSkeleton />
        </Card>
      </div>
    </div>
  );
}

function AiSummaryCallout({ summary }) {
  return (
    <div className="flex gap-3 rounded-card border border-info/30 bg-info-subtle p-4">
      <Sparkles
        className="mt-0.5 size-5 shrink-0 text-info-on-subtle"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-info-on-subtle">
            Monthly summary
          </p>
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            AI-generated
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          {summary}
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-card border border-border bg-danger-subtle px-4 py-3 text-sm text-danger"
    >
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Same monotonic request guard as the other pages: the last fetch started
  // wins, so a retry cannot be overwritten by a slower earlier response.
  const latestRequest = useRef(0);

  const fetchDashboard = useCallback(async () => {
    const requestId = ++latestRequest.current;

    try {
      const result = await getDashboard();
      if (requestId !== latestRequest.current) return;
      setData(result);
      setError(null);
    } catch (fetchError) {
      if (requestId !== latestRequest.current) return;
      setError(
        fetchError?.message ?? 'Could not load your dashboard. Try again.',
      );
    } finally {
      if (requestId === latestRequest.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the point of this effect. Every setState inside
    // fetchDashboard happens after an await, so none is the synchronous
    // cascade the rule guards against - it flags the call, not the writes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboard();
  }, [fetchDashboard]);

  if (!loaded) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <ErrorBanner
          message={error ?? 'Could not load your dashboard.'}
          onRetry={fetchDashboard}
        />
      </div>
    );
  }

  const { summary, categoryBreakdown, recentTransactions, aiSummary, period } =
    data;

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onRetry={fetchDashboard} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Balance"
          value={formatMoney(summary.totalBalance)}
          icon={Wallet}
          tone="primary"
        />
        <SummaryCard
          label="Income"
          value={formatMoney(summary.totalIncome)}
          icon={ArrowDownLeft}
          tone="success"
        />
        <SummaryCard
          label="Expenses"
          value={formatMoney(summary.totalExpenses)}
          icon={ArrowUpRight}
          tone="neutral"
        />
        <SummaryCard
          label="Savings"
          value={formatMoney(summary.savings)}
          icon={PiggyBank}
          tone="success"
        />
      </div>

      {aiSummary && <AiSummaryCallout summary={aiSummary} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card
          title="Category Breakdown"
          description={`Spending in ${formatPeriod(period)}`}
          className="h-full lg:col-span-3"
        >
          {categoryBreakdown.length === 0 ? (
            <EmptyState
              compact
              icon={PieChartIcon}
              title="No spending yet"
              description="Expenses you record this month will be broken down here."
            />
          ) : (
            <CategoryBreakdownChart
              data={categoryBreakdown}
              total={summary.totalExpenses}
            />
          )}
        </Card>

        <div className="h-full lg:col-span-2">
          <RecentTransactions transactions={recentTransactions} />
        </div>
      </div>
    </div>
  );
}
