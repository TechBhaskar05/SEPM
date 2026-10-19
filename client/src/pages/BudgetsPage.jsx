import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';

import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Modal from '../components/common/Modal.jsx';
import BudgetCard from '../components/budgets/BudgetCard.jsx';
import BudgetForm from '../components/budgets/BudgetForm.jsx';
import { usePageHeader } from '../components/layout/pageHeaderContext.js';
import { listBudgets } from '../services/budgetService.js';
import { listCategories } from '../services/categoryService.js';
import { toast } from '../store/toastStore.js';

/**
 * Budgets overview: one card per budget, plus a dashed "new budget" tile as
 * the last item of the same grid.
 *
 * The tile is inside the grid rather than parked in the top bar alone because
 * adding a budget is the same kind of act as adding another row, and a button
 * that looks like one of the rows invites the second one. The top bar action
 * stays as the primary route in; both open the same form.
 */

/**
 * Threshold alerts fire once per budget, per period, per threshold.
 *
 * The server sends `budgetAlert` on the transaction that crossed a threshold,
 * but that response goes to whichever screen created the transaction - often
 * not this one. So the page derives the same condition from the budget list it
 * loads, and this set is what stops it re-firing: without it, every reload of a
 * page showing an already-warned budget would shout about it again.
 *
 * sessionStorage rather than a ref, so the memory survives a reload but not the
 * browser session - an alert from last month should not suppress this month's,
 * and the key includes the period for exactly that reason.
 */
const ALERTED_KEY = 'fintrack-budget-alerts';

function readAlerted() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(ALERTED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function rememberAlerted(set) {
  try {
    sessionStorage.setItem(ALERTED_KEY, JSON.stringify([...set]));
  } catch {
    // A full or blocked storage quota is not worth failing a page render over.
  }
}

const THRESHOLD_LABEL = {
  0.8: (name, percent) => `${name} budget is at ${percent}%`,
  1: (name, percent) => `${name} budget has hit ${percent}%`,
};

export default function BudgetsPage() {
  const { setAction } = usePageHeader();

  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Monotonic request id, same pattern as the transactions page: whichever
  // fetch starts last wins, and an earlier one landing after it is dropped
  // instead of overwriting fresher rows.
  const latestRequest = useRef(0);
  const alerted = useRef(readAlerted());

  const fetchBudgets = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const result = await listBudgets();
      if (requestId !== latestRequest.current) return;
      setBudgets(result);
      setError(null);
    } catch (fetchError) {
      if (requestId !== latestRequest.current) return;
      setError(
        fetchError?.message ?? 'Could not load your budgets. Try again.',
      );
    } finally {
      if (requestId === latestRequest.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    listCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      // A missing category list only breaks the form's dropdown; the grid still
      // renders, so this is not worth a banner of its own.
      .catch(() => {});

    // Fetching on mount is the point of this effect; there is no event that
    // could replace it. Every setState inside fetchBudgets happens after an
    // await, so none is the synchronous cascade this rule guards against - the
    // rule flags the call, not the individual writes. Same reasoning, and the
    // same suppression, as the transactions page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBudgets();
    return () => {
      cancelled = true;
    };
  }, [fetchBudgets]);

  // Toast once per (budget, period, threshold). Reading the level off the
  // server's `alerts` array rather than recomputing utilization here keeps one
  // definition of the thresholds.
  useEffect(() => {
    if (!loaded) return;

    let changed = false;

    for (const budget of budgets) {
      const name = budget.category?.name ?? 'This';
      const percent = budget.utilizationPercent;

      for (const threshold of budget.alerts ?? []) {
        const key = `${budget.id}:${budget.period}:${threshold}`;
        if (alerted.current.has(key)) continue;

        alerted.current.add(key);
        changed = true;

        const message = THRESHOLD_LABEL[threshold];
        if (threshold === 1) {
          toast.error(
            message ? message(name, percent) : `${name} budget exceeded`,
            {
              description: 'Raise the limit or cut spending in this category.',
            },
          );
        } else {
          toast.info(
            message ? message(name, percent) : `${name} budget at ${percent}%`,
            { description: `${percent}% of this category is used up.` },
          );
        }
      }
    }

    if (changed) rememberAlerted(alerted.current);
  }, [budgets, loaded]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((budget) => {
    setEditing(budget);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    setAction({
      label: 'New Budget',
      icon: Plus,
      onClick: openCreate,
    });
    return () => setAction(null);
  }, [setAction, openCreate]);

  function handleSaved() {
    setFormOpen(false);
    setEditing(null);
    toast.success('Budget saved');
    fetchBudgets();
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-card border border-border bg-danger-subtle px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchBudgets}>
            Retry
          </Button>
        </div>
      )}

      {/* 1 / 2 / 3 columns. The dashed tile is a grid item like any other, so
          it inherits the row height and the gap without any extra styling - with
          `min-h-46` matching `BudgetCard`'s, which is what keeps it the same
          size when it is the only thing left in the last row. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} onEdit={openEdit} />
        ))}

        {loaded && budgets.length === 0 && !error ? (
          <EmptyState
            icon={Wallet}
            title="No budgets yet"
            description="Set a monthly limit for a category and every expense you log against it will count toward it."
            actionLabel="Create your first budget"
            onAction={openCreate}
            className="sm:col-span-2 lg:col-span-3"
          />
        ) : (
          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-46 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-strong text-text-tertiary transition-colors duration-200 hover:border-primary hover:bg-bg-subtle hover:text-text focus-visible:border-primary"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="text-sm font-medium">New Budget</span>
          </button>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit budget' : 'New budget'}
        description={
          editing
            ? 'Raise or lower the monthly limit for this category.'
            : 'A monthly limit for one category.'
        }
        size="md"
      >
        <BudgetForm
          categories={categories}
          budget={editing}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      </Modal>
    </div>
  );
}
