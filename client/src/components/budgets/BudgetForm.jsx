import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';

import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Select from '../common/Select.jsx';
import { createBudget, updateBudget } from '../../services/budgetService.js';
import {
  currentPeriod,
  formatPeriod,
  formatRupeesInput,
  rupeesToPaise,
} from '../../utils/formatters.js';

/**
 * Create / edit form for one monthly budget, rendered inside a Modal.
 *
 * In edit mode it is the same form with the two fields the server will not
 * change locked to their existing values: a budget belongs to one category and
 * one period for its whole life, and moving either would mean creating a
 * different budget rather than editing this one.
 *
 * The amount is entered in rupees and converted once, here, into the integer
 * paise the API stores (conventions.md "Money handling"). The hint under the
 * field shows the paise value so the conversion is never a black box - that is
 * the number the database will hold.
 */
export default function BudgetForm({
  onClose,
  onSaved,
  categories = [],
  budget = null,
  period = currentPeriod(),
}) {
  const editing = Boolean(budget);

  const [values, setValues] = useState({
    categoryId: budget?.categoryId ?? '',
    // Prefilled with the existing limit on edit, so the field is not emptied
    // and the user edits the number in front of them rather than retyping it.
    amount: budget ? formatRupeesInput(budget.limitAmount) : '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const budgetPeriod = budget?.period ?? period;

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  const options = useMemo(
    () => [
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );

  const amountHint = useMemo(() => {
    const paise = rupeesToPaise(values.amount);
    if (paise === null) return 'Entered in rupees, stored in paise';
    return `${formatPeriod(budgetPeriod)} · ${paise} paise`;
  }, [values.amount, budgetPeriod]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const limitAmount = rupeesToPaise(values.amount);
    const next = {};

    if (limitAmount === null) {
      next.amount = values.amount.trim()
        ? 'Enter an amount like 5,000'
        : 'Monthly limit is required';
    }
    if (!editing && !values.categoryId) {
      next.categoryId = 'Choose a category';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const saved = editing
        ? await updateBudget(budget.id, { limitAmount })
        : await createBudget({
            categoryId: values.categoryId,
            period: budgetPeriod,
            limitAmount,
          });

      onSaved(saved);
    } catch (error) {
      // Field-level errors from the server land on the field they belong to;
      // anything else (a 409 conflict, a network failure) is a banner.
      if (error?.details && typeof error.details === 'object') {
        setErrors(error.details);
        setSubmitError(null);
      } else {
        setSubmitError(error?.message ?? 'Could not save the budget');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Monthly limit"
        size="lg"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={values.amount}
        onChange={(event) => setField('amount', event.target.value)}
        error={errors.amount}
        helperText={!errors.amount ? amountHint : undefined}
        containerClassName="text-2xl font-semibold"
        autoFocus
      />

      <Select
        label="Category"
        options={
          editing
            ? options
            : [{ value: '', label: 'Select a category…' }, ...options]
        }
        // Locked rather than hidden: the field is what the budget is for, and
        // hiding it on edit would leave the form looking like it edits less than
        // it does.
        disabled={editing}
        value={values.categoryId}
        onChange={(event) => setField('categoryId', event.target.value)}
        error={errors.categoryId}
        helperText={
          !errors.categoryId && editing
            ? 'A budget stays with the category it was created for.'
            : undefined
        }
      />

      <div>
        <p className="mb-1.5 text-sm font-medium text-text">Period</p>
        <p className="flex items-center gap-2 rounded-control border border-border bg-bg-subtle px-3 py-2.5 text-sm text-text-secondary">
          <Info
            className="size-4 shrink-0 text-text-tertiary"
            aria-hidden="true"
          />
          {formatPeriod(budgetPeriod)}
          <span className="text-text-tertiary">
            (one budget per category per month)
          </span>
        </p>
      </div>

      {submitError && (
        <p
          role="alert"
          className="rounded-control bg-danger-subtle px-3 py-2 text-sm text-danger"
        >
          {submitError}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}
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
