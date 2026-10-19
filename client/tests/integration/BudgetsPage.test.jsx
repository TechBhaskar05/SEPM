import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BudgetsPage from '../../src/pages/BudgetsPage.jsx';
import ToastViewport from '../../src/components/common/ToastViewport.jsx';
import { useToastStore } from '../../src/store/toastStore.js';
import { budgetFixture } from '../fixtures/budgets.js';

/**
 * The alert behaviour of the budgets page, driven the way a user drives it:
 * log transactions one at a time and watch what the page says.
 *
 * There is no POST /transactions call here - the page never sees the
 * transaction, only the budget list the server recomputes it into. So each
 * "transaction" is a new `listBudgets` result at a higher `spent`, and each step
 * is a fresh mount of the page, which is exactly what happens when the user
 * adds the transaction on the transactions page and navigates back. The fixtures
 * go through the server's real `toBudgetView`, so `alerts` and `thresholdLevel`
 * are the ones the API would actually send.
 */

vi.mock('../../src/services/budgetService.js', () => ({
  listBudgets: vi.fn(),
}));
vi.mock('../../src/services/categoryService.js', () => ({
  listCategories: vi.fn(),
}));

const { listBudgets } = await import('../../src/services/budgetService.js');
const { listCategories } =
  await import('../../src/services/categoryService.js');

const CATEGORY = { id: 'cat-food', name: 'Food & Dining' };
const LIMIT = 100000;

const toasts = () => useToastStore.getState().toasts;
const titles = () => toasts().map((toast) => toast.title);

/** Mounts the page with the budgets list a server would return at `spent`. */
async function viewBudgetsAt(
  spent,
  { period = '2026-10', strict = false } = {},
) {
  listBudgets.mockResolvedValue([
    budgetFixture({ period, limitAmount: LIMIT, spent, category: CATEGORY }),
  ]);

  const page = strict ? (
    <StrictMode>
      <BudgetsPage />
    </StrictMode>
  ) : (
    <BudgetsPage />
  );

  let mounted;
  await act(async () => {
    mounted = render(
      <>
        {page}
        <ToastViewport />
      </>,
    );
  });
  return mounted;
}

describe('BudgetsPage — the 80% toast', () => {
  beforeEach(() => {
    useToastStore.getState().clear();
    listCategories.mockResolvedValue([CATEGORY]);
  });

  it('says nothing while the budget is under the threshold', async () => {
    await viewBudgetsAt(79999);
    expect(toasts()).toHaveLength(0);
    expect(screen.queryByRole('progressbar')).toBeInTheDocument();
  });

  it('fires exactly once when a transaction crosses 80%', async () => {
    const first = await viewBudgetsAt(79999);
    expect(toasts()).toHaveLength(0);

    // The transaction that tips it over.
    first.unmount();
    await viewBudgetsAt(80000);

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toMatchObject({ variant: 'info' });
    expect(titles()).toContain('Food & Dining budget is at 80%');

    // Not just in the store: the user has to actually see it.
    expect(screen.getAllByText('Food & Dining budget is at 80%')).toHaveLength(
      1,
    );
  });

  it('is the first transaction past the line, not one before it', async () => {
    const first = await viewBudgetsAt(79000);
    expect(titles()).toEqual([]);

    // 79.95% is over the line for the toast's purposes only if the comparison
    // rounds - it must not. This is the boundary the "fires exactly at the
    // threshold" claim actually rests on.
    first.unmount();
    await viewBudgetsAt(79950);
    expect(titles()).toEqual([]);
  });

  it('does not re-fire on later transactions that keep it above 80%', async () => {
    const first = await viewBudgetsAt(80000);
    expect(toasts()).toHaveLength(1);

    for (const spent of [81000, 90000, 95000, 99999]) {
      first.unmount();
      await viewBudgetsAt(spent);
    }

    expect(toasts()).toHaveLength(1);
  });

  it('does not re-fire when spending goes back down below 80% and up again', async () => {
    const first = await viewBudgetsAt(80000);
    first.unmount();
    await viewBudgetsAt(50000);
    first.unmount();
    await viewBudgetsAt(80000);

    expect(toasts()).toHaveLength(1);
  });

  it('survives a reload rather than re-firing from sessionStorage', async () => {
    await viewBudgetsAt(80000);
    expect(toasts()).toHaveLength(1);

    // sessionStorage is what the page writes its "already warned" set to, and
    // setup.js clears it per test - so the second mount here is a reload.
    await viewBudgetsAt(80000);
    expect(toasts()).toHaveLength(1);
  });

  it('fires once under StrictMode, which double-invokes mount effects', async () => {
    await viewBudgetsAt(80000, { strict: true });
    expect(toasts()).toHaveLength(1);
  });

  it('starts a new period with a fresh alert', async () => {
    await viewBudgetsAt(80000, { period: '2026-10' });
    expect(toasts()).toHaveLength(1);

    await viewBudgetsAt(80000, { period: '2026-11' });
    expect(toasts()).toHaveLength(2);
  });
});

describe('BudgetsPage — the 100% toast', () => {
  beforeEach(() => {
    useToastStore.getState().clear();
    listCategories.mockResolvedValue([CATEGORY]);
  });

  it('adds the over-budget alert on top of the 80% one when it is crossed', async () => {
    const first = await viewBudgetsAt(80000);
    expect(toasts().map((t) => t.variant)).toEqual(['info']);

    first.unmount();
    await viewBudgetsAt(100000);

    expect(toasts().map((t) => t.variant)).toEqual(['info', 'error']);
    expect(titles()).toContain('Food & Dining budget has hit 100%');
  });

  it('does not re-fire past 100% either', async () => {
    const first = await viewBudgetsAt(100000);
    first.unmount();
    await viewBudgetsAt(180000);
    first.unmount();
    await viewBudgetsAt(250000);

    expect(toasts()).toHaveLength(2);
  });

  it('fires both at once for a budget loaded already over its limit', async () => {
    await viewBudgetsAt(150000);
    expect(toasts().map((t) => t.variant)).toEqual(['info', 'error']);
  });
});
