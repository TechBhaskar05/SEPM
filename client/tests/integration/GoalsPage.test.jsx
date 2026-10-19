import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoalsPage from '../../src/pages/GoalsPage.jsx';
import ToastViewport from '../../src/components/common/ToastViewport.jsx';
import { PageHeaderContext } from '../../src/components/layout/pageHeaderContext.js';
import { goalFixture } from '../fixtures/goals.js';

vi.mock('../../src/services/goalService.js', () => ({
  listGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}));

const { listGoals } = await import('../../src/services/goalService.js');

/**
 * The page owns three pieces of behaviour worth pinning: the empty state, the
 * vertical list (one full-width card per goal, no grid), and the top-bar action
 * that opens the create modal. The service is mocked so these stay component
 * tests; the API itself is covered by the server suite.
 */

async function renderPage() {
  const setAction = vi.fn();

  let view;
  await act(async () => {
    view = render(
      <PageHeaderContext.Provider value={{ setAction }}>
        <GoalsPage />
        <ToastViewport />
      </PageHeaderContext.Provider>,
    );
  });

  return { ...view, setAction };
}

/** The most recent action object the page published to the top bar. */
const latestAction = (setAction) => setAction.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoalsPage — empty state', () => {
  it('prompts for the first goal', async () => {
    listGoals.mockResolvedValue([]);
    await renderPage();

    expect(screen.getByText('No savings goals yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create your first goal' }),
    ).toBeInTheDocument();
  });

  it('publishes a "New Goal" action next to the page title', async () => {
    listGoals.mockResolvedValue([]);
    const { setAction } = await renderPage();

    expect(latestAction(setAction)).toMatchObject({ label: 'New Goal' });
    expect(latestAction(setAction).onClick).toEqual(expect.any(Function));
  });
});

describe('GoalsPage — the list', () => {
  it('renders one full-width card per goal, in the served order', async () => {
    listGoals.mockResolvedValue([
      goalFixture(),
      goalFixture({
        id: 'goal-2',
        name: 'Emergency fund',
        targetAmount: 500000,
        savedAmount: 100000,
        deadline: '2026-12-31',
      }),
    ]);
    await renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Japan trip' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Emergency fund' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(
      screen.getByText(/Save ₹2,000\.00\/month to reach this on time/),
    ).toBeInTheDocument();
  });

  it('does not use a grid: the cards are a vertical stack', async () => {
    listGoals.mockResolvedValue([goalFixture()]);
    await renderPage();

    const card = screen
      .getByRole('heading', { name: 'Japan trip' })
      .closest('section');
    expect(card.parentElement).toHaveClass('space-y-4');
    expect(card.parentElement).not.toHaveClass('grid');
  });
});

describe('GoalsPage — failures', () => {
  it('shows a retry banner when the list cannot load', async () => {
    listGoals
      .mockRejectedValueOnce(new Error('Could not load your savings goals.'))
      .mockResolvedValueOnce([]);
    await renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your savings goals.',
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No savings goals yet')).toBeInTheDocument();
    expect(listGoals).toHaveBeenCalledTimes(2);
  });
});

describe('GoalsPage — the create action', () => {
  it('opens the new-goal modal from the top-bar action', async () => {
    listGoals.mockResolvedValue([]);
    const { setAction } = await renderPage();

    await act(async () => {
      latestAction(setAction).onClick();
    });

    expect(
      screen.getByRole('dialog', { name: 'New goal' }),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
