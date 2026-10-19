import { useMemo, useState } from 'react';

import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Select from '../common/Select.jsx';
import {
  createSubscription,
  updateSubscription,
} from '../../services/subscriptionService.js';
import {
  formatRupeesInput,
  rupeesToPaise,
  todayIso,
} from '../../utils/formatters.js';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function toDateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export default function SubscriptionForm({
  subscription = null,
  onClose,
  onSaved,
}) {
  const editing = Boolean(subscription);

  const [values, setValues] = useState({
    name: subscription?.name ?? '',
    amount: subscription ? formatRupeesInput(subscription.amount) : '',
    frequency: subscription?.frequency ?? 'monthly',
    nextRenewalDate: toDateInput(subscription?.nextRenewalDate),
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  const amountHint = useMemo(() => {
    const paise = rupeesToPaise(values.amount);
    if (paise === null) return 'Entered in rupees, stored in paise';
    return `${paise} paise`;
  }, [values.amount]);

  const renewalHint = useMemo(() => {
    if (!values.nextRenewalDate) {
      return 'We will flag this when the renewal is within 7 days.';
    }
    if (values.nextRenewalDate < todayIso()) {
      return 'This date has passed - the subscription will show as overdue.';
    }
    return 'We will flag this when the renewal is within 7 days.';
  }, [values.nextRenewalDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const amount = rupeesToPaise(values.amount);
    const next = {};

    if (!values.name.trim()) {
      next.name = 'Name is required';
    }
    if (amount === null) {
      next.amount = values.amount.trim()
        ? 'Enter an amount like 649'
        : 'Amount is required';
    }
    if (!values.nextRenewalDate) {
      next.nextRenewalDate = 'Choose the next renewal date';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: values.name.trim(),
      amount,
      frequency: values.frequency,
      nextRenewalDate: values.nextRenewalDate,
    };

    try {
      const saved = editing
        ? await updateSubscription(subscription.id, payload)
        : await createSubscription(payload);

      onSaved(saved);
    } catch (error) {
      if (error?.details && typeof error.details === 'object') {
        const fields = ['name', 'amount', 'frequency', 'nextRenewalDate'];
        const fieldErrors = {};
        const other = [];

        for (const [key, message] of Object.entries(error.details)) {
          if (fields.includes(key)) fieldErrors[key] = message;
          else other.push(message);
        }

        setErrors(fieldErrors);
        setSubmitError(other.length > 0 ? other.join(' ') : null);
      } else {
        setSubmitError(error?.message ?? 'Could not save the subscription');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Service name"
        placeholder="Netflix"
        autoComplete="off"
        maxLength={100}
        value={values.name}
        onChange={(event) => setField('name', event.target.value)}
        error={errors.name}
        autoFocus
      />

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
      />

      <Select
        label="Billing frequency"
        options={FREQUENCIES}
        value={values.frequency}
        onChange={(event) => setField('frequency', event.target.value)}
        error={errors.frequency}
      />

      <Input
        label="Next renewal"
        type="date"
        value={values.nextRenewalDate}
        onChange={(event) => setField('nextRenewalDate', event.target.value)}
        error={errors.nextRenewalDate}
        helperText={!errors.nextRenewalDate ? renewalHint : undefined}
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
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add subscription'}
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
