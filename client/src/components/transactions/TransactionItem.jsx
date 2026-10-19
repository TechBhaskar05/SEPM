import { memo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import Badge from '../common/Badge.jsx';
import { categoryTone } from '../../utils/categoryColors.js';
import { formatDate, formatSignedMoney } from '../../utils/formatters.js';

/**
 * One ledger row.
 *
 * Desktop: a table-like row, action buttons revealed on hover in the amount
 * column's place (so nothing reflows when they appear). Mobile: the same
 * facts stacked as a card.
 *
 * Colour: income reads green, an ordinary expense stays in the default text
 * colour. Danger red is reserved for budget overruns - a list where every
 * spend is red reads as an emergency rather than a record.
 */

function categoryLabel(transaction) {
  return transaction.category?.name ?? 'Uncategorised';
}

function Actions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit transaction"
        className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete transaction"
        className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-danger-subtle hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function TransactionItem({
  transaction: t,
  onEdit,
  onDelete,
  compact = false,
}) {
  const amount = formatSignedMoney(t.amount, t.type);
  const amountColour =
    t.type === 'income'
      ? 'text-success'
      : t.type === 'transfer'
        ? 'text-text-secondary'
        : 'text-text';

  // Condensed variant for preview surfaces (the dashboard's recent list):
  // one line of description, category and date, with no hover actions. It
  // shares the amount formatting and colour rules with the full row so the
  // two can never disagree about what an income or a transfer looks like.
  if (compact) {
    return (
      <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">
            {t.description}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {categoryLabel(t)} · {formatDate(t.date)}
          </p>
        </div>
        <span
          className={`numbers shrink-0 font-mono text-sm font-semibold tabular-nums ${amountColour}`}
        >
          {amount}
        </span>
      </li>
    );
  }

  return (
    <li className="group relative border-b border-border last:border-b-0">
      {/* ---------- desktop row ---------- */}
      <div className="hidden items-center gap-4 px-4 py-3 md:flex">
        <div className="w-40 shrink-0">
          <Badge
            tone={categoryTone(categoryLabel(t))}
            variant="subtle"
            size="sm"
          >
            {categoryLabel(t)}
          </Badge>
        </div>

        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {t.description}
        </p>

        <p className="w-28 shrink-0 text-sm text-text-secondary">
          {formatDate(t.date)}
        </p>

        <p className="w-32 shrink-0 truncate text-sm text-text-secondary">
          {t.paymentMethod ?? '—'}
        </p>

        {/* The amount and the actions share this cell: the actions fade in
            over the amount on hover, so the row never changes width. */}
        <div className="relative w-32 shrink-0 text-right">
          <span
            className={`numbers font-mono text-sm font-semibold tabular-nums transition-opacity group-hover:opacity-0 ${amountColour}`}
          >
            {amount}
          </span>
          <span className="absolute inset-0 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Actions onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
          </span>
        </div>
      </div>

      {/* ---------- mobile card ---------- */}
      <div className="px-4 py-3 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {t.description}
          </p>
          <span
            className={`numbers shrink-0 font-mono text-sm font-semibold tabular-nums ${amountColour}`}
          >
            {amount}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-secondary">
          <Badge
            tone={categoryTone(categoryLabel(t))}
            variant="subtle"
            size="sm"
          >
            {categoryLabel(t)}
          </Badge>
          <span>{formatDate(t.date)}</span>
          {t.paymentMethod && <span>· {t.paymentMethod}</span>}
        </div>

        {/* Touch has no hover, so the actions are always visible here. */}
        <div className="mt-2 flex justify-end gap-1">
          <Actions onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
        </div>
      </div>
    </li>
  );
}

// The list re-renders on every keystroke in the search box; memoising the row
// keeps a long list from re-rendering all of it.
export default memo(TransactionItem);
