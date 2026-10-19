import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubscriptionsPage from '../../src/pages/SubscriptionsPage.jsx';
import ToastViewport from '../../src/components/common/ToastViewport.jsx';
import { PageHeaderContext } from '../../src/components/layout/pageHeaderContext.js';
import { formatMoney } from '../../src/utils/formatters.js';
import { rollupSubscriptions } from '../../../server/src/services/subscriptionMath.js';
import {
  subscriptionFixture,
  subscriptionsResponse,
} from '../fixtures/subscriptions.js';

vi.mock('../../src/services/subscriptionService.js', () => ({
  listSubscriptions: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}));

const { listSubscriptions, updateSubscription, deleteSubscription } =
  await import('../../src/services/subscriptionService.js');

async function renderPage() {
  const setAction = vi.fn();

  let view;
  await act(async () => {
    view = render(
      <PageHeaderContext.Provider value={{ setAction }}>
        <SubscriptionsPage />
        <ToastViewport />
      </PageHeaderContext.Provider>,
    );
  });

  return { ...view, setAction };
}

const latestAction = (setAction) => setAction.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  listSubscriptions.mockResolvedValue(subscriptionsResponse([]));
});

describe('SubscriptionsPage — empty state', () => {
  it('prompts for the first subscription', async () => {
    await renderPage();

    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add your first subscription' }),
    ).toBeInTheDocument();
  });

  it('shows zero totals', async () => {
    await renderPage();

    const monthly = await screen.findByText(/Total monthly:/);
    const annual = screen.getByText(/Total annual:/);
    expect(monthly).toHaveTextContent('₹0.00');
    expect(annual).toHaveTextContent('₹0.00');
  });

  it('publishes an "Add Subscription" action next to the page title', async () => {
    const { setAction } = await renderPage();

    expect(latestAction(setAction)).toMatchObject({
      label: 'Add Subscription',
    });
    expect(latestAction(setAction).onClick).toEqual(expect.any(Function));
  });
});

describe('SubscriptionsPage — summary and list', () => {
  it('shows the monthly and annual rollup in bold', async () => {
    const subscriptions = [
      subscriptionFixture({ id: 'sub-1', name: 'Netflix', amount: 64900 }),
      subscriptionFixture({
        id: 'sub-2',
        name: 'iCloud',
        amount: 1200000,
        frequency: 'yearly',
        nextRenewalDate: '2026-11-28',
      }),
    ];
    listSubscriptions.mockResolvedValue(subscriptionsResponse(subscriptions));

    await renderPage();

    const monthly = await screen.findByText(/Total monthly:/);
    const annual = screen.getByText(/Total annual:/);
    expect(monthly).toHaveClass('font-bold');
    expect(monthly).toHaveTextContent('₹1,649.00');
    expect(annual).toHaveClass('font-bold');
    expect(annual).toHaveTextContent('₹19,788.00');
  });

  it('shows totals that match the pure rollup of a mixed list', async () => {
    const subscriptions = [
      subscriptionFixture({ id: 'sub-1', name: 'Netflix', amount: 64900 }),
      subscriptionFixture({ id: 'sub-2', name: 'Spotify', amount: 129900 }),
      subscriptionFixture({
        id: 'sub-3',
        name: 'iCloud',
        amount: 1200000,
        frequency: 'yearly',
        nextRenewalDate: '2026-11-28',
      }),
      subscriptionFixture({
        id: 'sub-4',
        name: 'Domain',
        amount: 600000,
        frequency: 'yearly',
        nextRenewalDate: '2026-12-28',
      }),
    ];
    const expected = rollupSubscriptions(subscriptions);

    expect(expected).toEqual({
      monthlyTotal: 344800,
      annualTotal: 4137600,
    });

    listSubscriptions.mockResolvedValue({
      subscriptions,
      rollup: expected,
    });

    await renderPage();

    const monthly = await screen.findByText(/Total monthly:/);
    const annual = screen.getByText(/Total annual:/);
    expect(monthly).toHaveTextContent(formatMoney(expected.monthlyTotal));
    expect(annual).toHaveTextContent(formatMoney(expected.annualTotal));
    expect(monthly).toHaveTextContent('₹3,448.00');
    expect(annual).toHaveTextContent('₹41,376.00');
  });

  it('renders one card per subscription with its renewal warning', async () => {
    const subscriptions = [
      subscriptionFixture({ id: 'sub-1', name: 'Netflix' }),
      subscriptionFixture({
        id: 'sub-2',
        name: 'iCloud',
        amount: 1200000,
        frequency: 'yearly',
        nextRenewalDate: '2026-11-28',
      }),
    ];
    listSubscriptions.mockResolvedValue(subscriptionsResponse(subscriptions));

    await renderPage();

    expect(
      await screen.findAllByRole('heading', { name: 'Netflix' }),
    ).toHaveLength(2);
    expect(screen.getAllByText('Renews in 5 days')[0]).toHaveClass(
      'bg-warning-subtle',
    );
    expect(screen.getAllByText('Renews in 40 days')[0]).toHaveClass(
      'bg-bg-subtle',
    );
  });
});

describe('SubscriptionsPage — create and edit', () => {
  it('opens the new-subscription modal from the top-bar action', async () => {
    const { setAction } = await renderPage();

    await act(async () => {
      latestAction(setAction).onClick();
    });

    expect(
      screen.getByRole('dialog', { name: 'New subscription' }),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens an existing subscription in the edit modal and saves it', async () => {
    const subscription = subscriptionFixture();
    listSubscriptions.mockResolvedValue(subscriptionsResponse([subscription]));
    updateSubscription.mockResolvedValue({ ...subscription, amount: 79900 });

    await renderPage();

    await userEvent
      .setup()
      .click(
        (await screen.findAllByRole('button', { name: 'Edit Netflix' }))[0],
      );

    expect(
      screen.getByRole('dialog', { name: 'Edit subscription' }),
    ).toBeInTheDocument();

    const amount = screen.getByLabelText('Amount');
    await userEvent.setup().clear(amount);
    await userEvent.setup().type(amount, '799');

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateSubscription).toHaveBeenCalledWith(subscription.id, {
        name: 'Netflix',
        amount: 79900,
        frequency: 'monthly',
        nextRenewalDate: '2026-10-24',
      }),
    );
    await waitFor(() => expect(listSubscriptions).toHaveBeenCalledTimes(2));
  });
});

describe('SubscriptionsPage — delete and errors', () => {
  it('deletes after confirmation and refreshes the list', async () => {
    listSubscriptions.mockResolvedValue(
      subscriptionsResponse([subscriptionFixture()]),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await renderPage();

    await userEvent
      .setup()
      .click(
        (await screen.findAllByRole('button', { name: 'Delete Netflix' }))[0],
      );

    expect(deleteSubscription).toHaveBeenCalledWith('subscription-1');
    await waitFor(() => expect(listSubscriptions).toHaveBeenCalledTimes(2));
  });

  it('shows a retry banner when the list cannot load', async () => {
    listSubscriptions
      .mockRejectedValueOnce(new Error('Could not load your subscriptions.'))
      .mockResolvedValueOnce(subscriptionsResponse([]));

    await renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your subscriptions.',
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();
    expect(listSubscriptions).toHaveBeenCalledTimes(2);
  });
});
