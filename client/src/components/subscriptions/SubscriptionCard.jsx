import { memo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import Badge from '../common/Badge.jsx';
import Card from '../common/Card.jsx';
import { formatMoney } from '../../utils/formatters.js';

const INITIAL_TONES = [
  'bg-primary-subtle text-primary-on-subtle',
  'bg-success-subtle text-success-on-subtle',
  'bg-warning-subtle text-warning-on-subtle',
  'bg-info-subtle text-info-on-subtle',
  'bg-danger-subtle text-danger-on-subtle',
];

function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function initialTone(name) {
  let hash = 0;
  for (const character of String(name ?? '')) {
    hash = (hash * 31 + character.codePointAt(0)) | 0;
  }

  return INITIAL_TONES[Math.abs(hash) % INITIAL_TONES.length];
}

function renewalTone(subscription) {
  if (subscription.isRenewalOverdue) return 'danger';
  if (subscription.isRenewalSoon) return 'warning';
  return 'neutral';
}

function renewalLabel(subscription) {
  const days = subscription.daysUntilRenewal;

  if (days < 0) {
    const count = Math.abs(days);
    return `Overdue by ${count} ${count === 1 ? 'day' : 'days'}`;
  }
  if (days === 0) return 'Renews today';
  if (days === 1) return 'Renews in 1 day';
  return `Renews in ${days} days`;
}

function Actions({ subscription, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(subscription)}
          aria-label={`Edit ${subscription.name}`}
          className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(subscription)}
          aria-label={`Delete ${subscription.name}`}
          className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SubscriptionCard({ subscription, onEdit, onDelete }) {
  const { name, amount, frequency } = subscription;
  const frequencyLabel = frequency === 'yearly' ? 'year' : 'month';

  return (
    <Card
      padded={false}
      className={`group ${subscription.isRenewalSoon ? 'border-warning/40' : ''}`}
    >
      <div className="hidden items-center gap-4 px-4 py-3.5 md:flex">
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-control text-sm font-bold ${initialTone(name)}`}
        >
          {initials(name)}
        </span>

        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
          {name}
        </h3>

        <p className="w-40 shrink-0 text-right text-sm">
          <span className="numbers font-mono font-semibold tabular-nums">
            {formatMoney(amount)}
          </span>
          <span className="text-text-secondary">/{frequencyLabel}</span>
        </p>

        <div className="w-36 shrink-0 text-right">
          <Badge size="sm" tone={renewalTone(subscription)}>
            {renewalLabel(subscription)}
          </Badge>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex w-20 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Actions
              subscription={subscription}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>

      <div className="px-4 py-3 md:hidden">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex size-10 shrink-0 items-center justify-center rounded-control text-sm font-bold ${initialTone(name)}`}
          >
            {initials(name)}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-text">{name}</h3>
            <p className="mt-0.5 text-sm">
              <span className="numbers font-mono font-semibold tabular-nums">
                {formatMoney(amount)}
              </span>
              <span className="text-text-secondary">/{frequencyLabel}</span>
            </p>
          </div>

          <Badge
            size="sm"
            tone={renewalTone(subscription)}
            className="shrink-0"
          >
            {renewalLabel(subscription)}
          </Badge>
        </div>

        {(onEdit || onDelete) && (
          <div className="mt-2 flex justify-end">
            <Actions
              subscription={subscription}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default memo(SubscriptionCard);
