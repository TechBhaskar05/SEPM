import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Select from '../common/Select.jsx';
import {
  createTransaction,
  newIdempotencyKey,
  updateTransaction,
} from '../../services/transactionService.js';
import {
  formatRupeesInput,
  rupeesToPaise,
  todayIso,
} from '../../utils/formatters.js';

/**
 * Add/edit-transaction form, rendered inside a Modal.
 *
 * Owns two things the page must not have to think about: the Idempotency-Key
 * (regenerated per open, held across retries of the same submission) and
 * converting what the user typed into integer paise. In edit mode it prefills
 * the stored values and saves through PATCH instead.
 */

const TYPES = [
  { value: 'expense', label: 'Expense', icon: ArrowUpRight },
  { value: 'income', label: 'Income', icon: ArrowDownLeft },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
];

const PAYMENT_METHODS = [
  'UPI',
  'Credit card',
  'Debit card',
  'Cash',
  'Net banking',
  'Auto-pay',
];

/** "2026-10-19T00:00:00.000Z" or a Date -> the value a date input expects. */
function toDateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function initialValues(transaction) {
  if (!transaction) {
    return {
      amount: '',
      type: 'expense',
      categoryId: '',
      description: '',
      date: todayIso(),
      paymentMethod: '',
    };
  }

  return {
    amount: formatRupeesInput(transaction.amount),
    type: transaction.type ?? 'expense',
    categoryId: transaction.categoryId ?? '',
    description: transaction.description ?? '',
    date: toDateInput(transaction.date) || todayIso(),
    paymentMethod: transaction.paymentMethod ?? '',
  };
}

export default function TransactionForm({
  transaction = null,
  categories = [],
  onClose,
  onSaved,
}) {
  const editing = Boolean(transaction);
  const [values, setValues] = useState(() => initialValues(transaction));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const categoryOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Uncategorised' },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ];

    // If the category list failed to load (or is still in flight), keep the
    // row's current category selectable instead of silently showing blank.
    if (
      transaction?.category &&
      !options.some((option) => option.value === transaction.category.id)
    ) {
      options.push({
        value: transaction.category.id,
        label: transaction.category.name,
      });
    }

    return options;
  }, [categories, transaction]);

  // One key per open/submit cycle. Held in a ref rather than state so a retry
  // reuses it (that is the point of the header) while reopening the modal
  // makes a new one.
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, []);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  function validate() {
    const next = {};
    const paise = rupeesToPaise(values.amount);

    if (paise === null) {
      next.amount = values.amount.trim()
        ? 'Enter an amount like 1,249.50'
        : 'Amount is required';
    }

    if (!values.description.trim()) {
      next.description = 'Description is required';
    }

    if (!values.date) {
      next.date = 'Date is required';
    }

    setErrors(next);
    return { ok: Object.keys(next).length === 0, paise };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const { ok, paise } = validate();
    if (!ok) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      type: values.type,
      amount: paise,
      description: values.description.trim(),
      date: values.date,
      categoryId: values.categoryId || null,
      paymentMethod: values.paymentMethod || null,
    };

    try {
      const saved = editing
        ? await updateTransaction(transaction.id, payload)
        : await createTransaction(
            { ...payload, source: 'manual' },
            idempotencyKey.current,
          );

      onSaved(saved);
    } catch (error) {
      // Server-side field errors land on the fields themselves; anything else
      // is a banner above the submit button.
      if (error?.details && typeof error.details === 'object') {
        setErrors(error.details);
        setSubmitError(null);
      } else {
        setSubmitError(error?.message ?? 'Could not save the transaction');
      }
      // A rejected submission means the key was not consumed, so the same key
      // is safe to reuse for the retry.
    } finally {
      setSubmitting(false);
    }
  }

  const amountHint = useMemo(() => {
    const paise = rupeesToPaise(values.amount);
    return paise === null ? 'Entered as rupees' : `${paise} paise`;
  }, [values.amount]);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Amount"
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

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-text">Type</legend>
        <div
          role="radiogroup"
          aria-label="Transaction type"
          className="grid grid-cols-3 gap-1 rounded-control bg-bg-subtle p-1"
        >
          {TYPES.map(({ value, label, icon: Icon }) => {
            const selected = values.type === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField('type', value)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-surface text-text shadow-card'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Select
        label="Category"
        options={categoryOptions}
        value={values.categoryId}
        onChange={(event) => setField('categoryId', event.target.value)}
      />

      <Input
        label="Description"
        placeholder="What was this for?"
        value={values.description}
        onChange={(event) => setField('description', event.target.value)}
        error={errors.description}
        maxLength={200}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          value={values.date}
          onChange={(event) => setField('date', event.target.value)}
          error={errors.date}
        />
        <Select
          label="Payment method"
          optional
          value={values.paymentMethod}
          onChange={(event) => setField('paymentMethod', event.target.value)}
          options={[
            { value: '', label: 'Not specified' },
            ...PAYMENT_METHODS.map((method) => ({
              value: method,
              label: method,
            })),
          ]}
        />
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
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
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
