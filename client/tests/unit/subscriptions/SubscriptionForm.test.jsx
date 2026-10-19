import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubscriptionForm from '../../../src/components/subscriptions/SubscriptionForm.jsx';
import { subscriptionFixture } from '../../fixtures/subscriptions.js';

vi.mock('../../../src/services/subscriptionService.js', () => ({
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
}));

const { createSubscription, updateSubscription } =
  await import('../../../src/services/subscriptionService.js');

function renderForm(props = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();

  render(<SubscriptionForm onSaved={onSaved} onClose={onClose} {...props} />);

  return { onSaved, onClose };
}

async function fillCreateForm({
  name = 'Netflix',
  amount = '649',
  frequency = 'monthly',
  renewal = '2026-11-24',
} = {}) {
  const user = userEvent.setup();

  if (name) await user.type(screen.getByLabelText('Service name'), name);
  if (amount) await user.type(screen.getByLabelText('Amount'), amount);
  await user.selectOptions(
    screen.getByLabelText('Billing frequency'),
    frequency,
  );
  fireEvent.change(screen.getByLabelText('Next renewal'), {
    target: { value: renewal },
  });

  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionForm — creating a subscription', () => {
  it('sends integer paise, the frequency and a bare calendar date', async () => {
    createSubscription.mockResolvedValue({ id: 'sub-new', name: 'Netflix' });
    const { onSaved } = renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    await waitFor(() =>
      expect(createSubscription).toHaveBeenCalledWith({
        name: 'Netflix',
        amount: 64900,
        frequency: 'monthly',
        nextRenewalDate: '2026-11-24',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith({
      id: 'sub-new',
      name: 'Netflix',
    });
  });

  it('sends a yearly frequency unchanged', async () => {
    createSubscription.mockResolvedValue({ id: 'sub-new', name: 'iCloud' });
    renderForm();
    const user = await fillCreateForm({
      name: 'iCloud',
      amount: '1,200',
      frequency: 'yearly',
    });

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    await waitFor(() =>
      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 120000,
          frequency: 'yearly',
        }),
      ),
    );
  });

  it('converts a fractional rupee amount without float drift', async () => {
    createSubscription.mockResolvedValue({ id: 'sub-new', name: 'Netflix' });
    renderForm();
    const user = await fillCreateForm({ amount: '649.99' });

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    await waitFor(() =>
      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 64999 }),
      ),
    );
  });

  it('blocks submission until the required fields are usable', async () => {
    const { onSaved } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    expect(
      screen.getByText('Choose the next renewal date'),
    ).toBeInTheDocument();
    expect(createSubscription).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('puts a server field error on the field it belongs to', async () => {
    createSubscription.mockRejectedValue({
      message: 'Validation failed',
      details: { amount: 'Amount is too large' },
    });
    renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    expect(await screen.findByText('Amount is too large')).toBeInTheDocument();
  });

  it('shows non-field server errors as a banner', async () => {
    createSubscription.mockRejectedValue({
      message: 'Unable to reach the server. Check your connection.',
    });
    renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Add subscription' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server.',
    );
  });
});

describe('SubscriptionForm — editing a subscription', () => {
  it('prefills every field from the subscription', () => {
    renderForm({ subscription: subscriptionFixture() });

    expect(screen.getByLabelText('Service name')).toHaveValue('Netflix');
    expect(screen.getByLabelText('Amount')).toHaveValue('649.00');
    expect(screen.getByLabelText('Billing frequency')).toHaveValue('monthly');
    expect(screen.getByLabelText('Next renewal')).toHaveValue('2026-10-24');
  });

  it('sends the full editable payload to the update endpoint', async () => {
    const subscription = subscriptionFixture();
    updateSubscription.mockResolvedValue({
      ...subscription,
      amount: 79900,
      frequency: 'yearly',
    });
    const { onSaved } = renderForm({ subscription });
    const user = userEvent.setup();

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '799');
    await user.selectOptions(
      screen.getByLabelText('Billing frequency'),
      'yearly',
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateSubscription).toHaveBeenCalledWith(subscription.id, {
        name: 'Netflix',
        amount: 79900,
        frequency: 'yearly',
        nextRenewalDate: '2026-10-24',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 79900, frequency: 'yearly' }),
    );
  });

  it('flags an already-passed renewal without blocking it', () => {
    renderForm({
      subscription: subscriptionFixture({ nextRenewalDate: '2026-10-01' }),
    });

    expect(
      screen.getByText(
        'This date has passed - the subscription will show as overdue.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
