import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TransactionForm from '../../../src/components/transactions/TransactionForm.jsx';

vi.mock('../../../src/services/transactionService.js', () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  newIdempotencyKey: vi.fn(() => 'test-key'),
}));

const { createTransaction, updateTransaction } =
  await import('../../../src/services/transactionService.js');

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
};

function renderForm(props = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();

  render(
    <TransactionForm
      categories={[CATEGORY]}
      onClose={onClose}
      onSaved={onSaved}
      {...props}
    />,
  );

  return { onSaved, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TransactionForm — creating', () => {
  it('sends the selected category UUID and integer paise', async () => {
    createTransaction.mockResolvedValue({ id: 'tx-new', description: 'Lunch' });
    const { onSaved } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Amount'), '1,249.50');
    await user.type(screen.getByLabelText('Description'), 'Lunch');
    await user.selectOptions(screen.getByLabelText('Category'), CATEGORY.id);
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    await waitFor(() =>
      expect(createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 124950,
          categoryId: CATEGORY.id,
          description: 'Lunch',
          source: 'manual',
        }),
        'test-key',
      ),
    );
    expect(onSaved).toHaveBeenCalledWith({
      id: 'tx-new',
      description: 'Lunch',
    });
  });
});

describe('TransactionForm — editing', () => {
  it('prefills the stored transaction and saves through updateTransaction', async () => {
    updateTransaction.mockResolvedValue({
      ...TRANSACTION,
      description: 'Dinner',
    });
    const { onSaved } = renderForm({ transaction: TRANSACTION });
    const user = userEvent.setup();

    expect(screen.getByLabelText('Amount')).toHaveValue('1249.00');
    expect(screen.getByLabelText('Description')).toHaveValue('Lunch');
    expect(screen.getByLabelText('Category')).toHaveValue(CATEGORY.id);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-18');
    expect(screen.getByLabelText(/Payment method/i)).toHaveValue('UPI');

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateTransaction).toHaveBeenCalledWith(
        TRANSACTION.id,
        expect.objectContaining({
          amount: 124900,
          categoryId: CATEGORY.id,
          description: 'Dinner',
          date: '2026-10-18',
          paymentMethod: 'UPI',
          type: 'expense',
        }),
      ),
    );
    expect(createTransaction).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("keeps the transaction's category selectable when the category list is empty", () => {
    renderForm({ transaction: TRANSACTION, categories: [] });

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-19' },
    });

    expect(screen.getByLabelText('Category')).toHaveValue(CATEGORY.id);
    expect(
      screen.getByRole('option', { name: CATEGORY.name }),
    ).toBeInTheDocument();
  });
});
