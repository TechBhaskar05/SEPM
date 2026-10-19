import { useMemo, useState } from 'react';

import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import { createGoal, updateGoal } from '../../services/goalService.js';
import {
  formatRupeesInput,
  rupeesToPaise,
  todayIso,
} from '../../utils/formatters.js';

/**
 * Create / edit form for one savings goal, rendered inside a Modal.
 *
 * Amounts are entered in rupees and converted once, here, into the integer
 * paise the API stores (conventions.md "Money handling"). The hint under each
 * field shows the paise value so the conversion is never a black box - that is
 * the number the database will hold.
 *
 * `savedAmount` is optional and blank means zero, which is why it cannot use
 * `rupeesToPaise` directly: that parser rejects zero (a transaction of zero is
 * meaningless, a goal with nothing saved yet is normal).
 */

/** "2027-01-31T00:00:00.000Z" or a Date -> the value a date input expects. */
function toDateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * Saved amount parser: blank and zero are both valid and mean 0.
 * Everything else goes through the shared rupee parser.
 */
function parseSavedAmount(input) {
  const cleaned = String(input ?? '')
    .replace(/[₹,\s]/g, '')
    .trim();

  if (!cleaned || /^0+(?:\.0{0,2})?$/.test(cleaned)) return 0;
  return rupeesToPaise(cleaned);
}

export default function GoalForm({ goal = null, onClose, onSaved }) {
  const editing = Boolean(goal);

  const [values, setValues] = useState({
    name: goal?.name ?? '',
    // Prefilled on edit so the user edits the number in front of them rather
    // than retyping it.
    targetAmount: goal ? formatRupeesInput(goal.targetAmount) : '',
    savedAmount: goal ? formatRupeesInput(goal.savedAmount) : '',
    deadline: toDateInput(goal?.deadline),
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  const targetHint = useMemo(() => {
    const paise = rupeesToPaise(values.targetAmount);
    if (paise === null) return 'Entered in rupees, stored in paise';
    return `${paise} paise`;
  }, [values.targetAmount]);

  const savedHint = useMemo(() => {
    if (!values.savedAmount.trim()) return 'Leave blank to start from zero';
    const paise = parseSavedAmount(values.savedAmount);
    if (paise === null) return 'Entered in rupees, stored in paise';
    return `${paise} paise`;
  }, [values.savedAmount]);

  const deadlineHint =
    values.deadline && values.deadline < todayIso()
      ? 'This date has passed - the goal will show as overdue.'
      : 'Contributions are counted in whole calendar months.';

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const targetAmount = rupeesToPaise(values.targetAmount);
    const savedAmount = parseSavedAmount(values.savedAmount);
    const next = {};

    if (!values.name.trim()) {
      next.name = 'Name is required';
    }
    if (targetAmount === null) {
      next.targetAmount = values.targetAmount.trim()
        ? 'Enter an amount like 10,000'
        : 'Target amount is required';
    }
    if (savedAmount === null) {
      next.savedAmount = 'Enter an amount like 2,500';
    }
    if (!values.deadline) {
      next.deadline = 'Choose a deadline';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: values.name.trim(),
      targetAmount,
      savedAmount,
      deadline: values.deadline,
    };

    try {
      const saved = editing
        ? await updateGoal(goal.id, payload)
        : await createGoal(payload);

      onSaved(saved);
    } catch (error) {
      // Field-level errors land on the field they belong to; anything else (a
      // network failure, a 404) is a banner. A root-level Zod issue comes back
      // as `_`, which is not a field, so it is folded into that banner too.
      if (error?.details && typeof error.details === 'object') {
        const fields = ['name', 'targetAmount', 'savedAmount', 'deadline'];
        const fieldErrors = {};
        const other = [];

        for (const [key, message] of Object.entries(error.details)) {
          if (fields.includes(key)) fieldErrors[key] = message;
          else other.push(message);
        }

        setErrors(fieldErrors);
        setSubmitError(other.length > 0 ? other.join(' ') : null);
      } else {
        setSubmitError(error?.message ?? 'Could not save the goal');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Goal name"
        placeholder="Japan trip"
        autoComplete="off"
        maxLength={100}
        value={values.name}
        onChange={(event) => setField('name', event.target.value)}
        error={errors.name}
        autoFocus
      />

      <Input
        label="Target amount"
        size="lg"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={values.targetAmount}
        onChange={(event) => setField('targetAmount', event.target.value)}
        error={errors.targetAmount}
        helperText={!errors.targetAmount ? targetHint : undefined}
        containerClassName="text-2xl font-semibold"
      />

      <Input
        label="Saved so far"
        optional
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={values.savedAmount}
        onChange={(event) => setField('savedAmount', event.target.value)}
        error={errors.savedAmount}
        helperText={!errors.savedAmount ? savedHint : undefined}
      />

      <Input
        label="Deadline"
        type="date"
        value={values.deadline}
        onChange={(event) => setField('deadline', event.target.value)}
        error={errors.deadline}
        helperText={!errors.deadline ? deadlineHint : undefined}
      />

      {submitError && (
        <p
          role="alert"
          className="rounded-control bg-danger-subtle px-3 py-2 text-sm text-danger"
        >
          {submitError}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}
      </Button>

      <Button
        type="button"
        variant="ghost"
        fullWidth
        onClick={onClose}
        disabled={submitting}
      >
        Cancel
      </Button>
    </form>
  );
}
