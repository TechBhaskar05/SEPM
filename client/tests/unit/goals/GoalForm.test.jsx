import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoalForm from '../../../src/components/goals/GoalForm.jsx';
import { goalFixture } from '../../fixtures/goals.js';

vi.mock('../../../src/services/goalService.js', () => ({
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
}));

const { createGoal, updateGoal } =
  await import('../../../src/services/goalService.js');

/**
 * These tests pin the form's job at the boundary: rupees typed by the user
 * become integer paise in the payload, and the deadline travels as the bare
 * YYYY-MM-DD the validator expects. Blank saved-so-far is a real value (zero),
 * not an error, because a new goal normally starts with nothing put aside.
 */

function renderForm(props = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();

  render(<GoalForm onSaved={onSaved} onClose={onClose} {...props} />);

  return { onSaved, onClose };
}

async function fillCreateForm({
  name = 'Japan trip',
  target = '10,000',
  saved = '',
  deadline = '2027-06-30',
} = {}) {
  const user = userEvent.setup();

  if (name) await user.type(screen.getByLabelText('Goal name'), name);
  if (target) {
    await user.type(screen.getByLabelText('Target amount'), target);
  }
  if (saved) {
    await user.type(screen.getByLabelText(/Saved so far/i), saved);
  }
  fireEvent.change(screen.getByLabelText('Deadline'), {
    target: { value: deadline },
  });

  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoalForm — creating a goal', () => {
  it('sends integer paise and a bare calendar date', async () => {
    createGoal.mockResolvedValue({ id: 'goal-new', name: 'Japan trip' });
    const { onSaved } = renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith({
        name: 'Japan trip',
        targetAmount: 1000000,
        savedAmount: 0,
        deadline: '2027-06-30',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith({
      id: 'goal-new',
      name: 'Japan trip',
    });
  });

  it('accepts "0" in saved so far as zero rather than an invalid amount', async () => {
    createGoal.mockResolvedValue({ id: 'goal-new', name: 'Japan trip' });
    renderForm();
    const user = await fillCreateForm({ saved: '0' });

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith(
        expect.objectContaining({ savedAmount: 0 }),
      ),
    );
  });

  it('converts a fractional rupee amount without float drift', async () => {
    createGoal.mockResolvedValue({ id: 'goal-new', name: 'Japan trip' });
    renderForm();
    const user = await fillCreateForm({
      target: '10,000.50',
      saved: '0.25',
    });

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAmount: 1000050,
          savedAmount: 25,
        }),
      ),
    );
  });

  it('blocks submission until the required fields are usable', async () => {
    const { onSaved } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Target amount is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a deadline')).toBeInTheDocument();
    expect(createGoal).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('puts a server field error on the field it belongs to', async () => {
    createGoal.mockRejectedValue({
      message: 'Validation failed',
      details: { targetAmount: 'Target amount is too large' },
    });
    renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(
      await screen.findByText('Target amount is too large'),
    ).toBeInTheDocument();
  });

  it('shows non-field server errors as a banner', async () => {
    createGoal.mockRejectedValue({
      message: 'Unable to reach the server. Check your connection.',
    });
    renderForm();
    const user = await fillCreateForm();

    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server.',
    );
  });
});

describe('GoalForm — editing a goal', () => {
  it('prefills every field from the goal', () => {
    renderForm({ goal: goalFixture() });

    expect(screen.getByLabelText('Goal name')).toHaveValue('Japan trip');
    expect(screen.getByLabelText('Target amount')).toHaveValue('10000.00');
    expect(screen.getByLabelText(/Saved so far/i)).toHaveValue('2500.00');
    expect(screen.getByLabelText('Deadline')).toHaveValue('2027-01-31');
  });

  it('updates the saved amount and sends the full editable payload', async () => {
    const goal = goalFixture();
    updateGoal.mockResolvedValue({ ...goal, savedAmount: 1000000 });
    const { onSaved } = renderForm({ goal });
    const user = userEvent.setup();

    const saved = screen.getByLabelText(/Saved so far/i);
    await user.clear(saved);
    await user.type(saved, '10,000');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateGoal).toHaveBeenCalledWith(goal.id, {
        name: 'Japan trip',
        targetAmount: 1000000,
        savedAmount: 1000000,
        deadline: '2027-01-31',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ savedAmount: 1000000 }),
    );
  });

  it('flags a deadline that has already passed without blocking it', () => {
    renderForm({ goal: goalFixture({ deadline: '2026-09-30' }) });

    expect(
      screen.getByText('This date has passed - the goal will show as overdue.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
