import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TransactionsPage from '../../src/pages/TransactionsPage.jsx';
import ToastViewport from '../../src/components/common/ToastViewport.jsx';
import { PageHeaderContext } from '../../src/components/layout/pageHeaderContext.js';

vi.mock('../../src/services/transactionService.js', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  newIdempotencyKey: vi.fn(() => 'test-key'),
}));
vi.mock('../../src/services/categoryService.js', () => ({
  listCategories: vi.fn(),
}));

const { listTransactions, updateTransaction } =
  await import('../../src/services/transactionService.js');
const { listCategories } =
  await import('../../src/services/categoryService.js');

const CATEGORY = { id: '11111111-1111-4111-8111-111111111111', name: 'Food' };

const TRANSACTION = {
  id: 'tx-1',
  amount: 124900,
  type: 'expense',
  categoryId: CATEGORY.id,
  category: CATEGORY,
  description: 'Lunch',
  date: '2026-10-18T00:00:00.000Z',
  paymentMethod: 'UPI',
  source: 'manual',
  createdAt: '2026-10-18T09:00:00.000Z',
};

async function renderPage() {
  const setAction = vi.fn();

  let view;
  await act(async () => {
    view = render(
      <PageHeaderContext.Provider value={{ setAction }}>
        <TransactionsPage />
        <ToastViewport />
      </PageHeaderContext.Provider>,
    );
  });

  return { ...view, setAction };
}

beforeEach(() => {
  vi.clearAllMocks();
  listCategories.mockResolvedValue([CATEGORY]);
  listTransactions.mockResolvedValue({ transactions: [TRANSACTION] });
});

describe('TransactionsPage — category filter', () => {
  it('offers the real category UUIDs from the API', async () => {
    await renderPage();

    const filter = screen.getByRole('combobox', {
      name: 'Filter by category',
    });
    const option = await within(filter).findByRole('option', {
      name: CATEGORY.name,
    });

    expect(option).toHaveValue(CATEGORY.id);
  });
});

describe('TransactionsPage — editing', () => {
  it('opens the row in the edit modal and saves through the update endpoint', async () => {
    updateTransaction.mockResolvedValue({
      ...TRANSACTION,
      description: 'Dinner',
    });
    await renderPage();

    expect((await screen.findAllByText('Lunch')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole('button', { name: 'Edit transaction' })[0],
    );

    expect(
      screen.getByRole('dialog', { name: 'Edit transaction' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Lunch');
    expect(screen.getByLabelText('Category')).toHaveValue(CATEGORY.id);

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateTransaction).toHaveBeenCalledWith(
        TRANSACTION.id,
        expect.objectContaining({
          categoryId: CATEGORY.id,
          description: 'Dinner',
        }),
      ),
    );
    expect(listTransactions).toHaveBeenCalledTimes(2);
  });
});
