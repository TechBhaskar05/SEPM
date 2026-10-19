import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Receipt, X } from 'lucide-react';

import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Input from '../components/common/Input.jsx';
import Modal from '../components/common/Modal.jsx';
import Select from '../components/common/Select.jsx';
import TransactionForm from '../components/transactions/TransactionForm.jsx';
import TransactionList from '../components/transactions/TransactionList.jsx';
import { usePageHeader } from '../components/layout/pageHeaderContext.js';
import { useAuthStore } from '../store/authStore.js';
import { toast } from '../store/toastStore.js';
import {
  listTransactions,
  deleteTransaction,
} from '../services/transactionService.js';
import { listCategories } from '../services/categoryService.js';

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Any method' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Credit card', label: 'Credit card' },
  { value: 'Debit card', label: 'Debit card' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Net banking', label: 'Net banking' },
  { value: 'Auto-pay', label: 'Auto-pay' },
];

const EMPTY_FILTERS = {
  search: '',
  categoryId: '',
  from: '',
  to: '',
  paymentMethod: '',
};

export default function TransactionsPage() {
  const { setAction } = usePageHeader();
  const userId = useAuthStore((state) => state.user?.id);

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const hasFilters = Object.values(filters).some(Boolean);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );

  /**
   * Fetching runs against the server-side filters the API already supports
   * (category, date range). `search` and `paymentMethod` are not query
   * parameters yet, so they are applied in `visible` to the rows already
   * loaded - they narrow the current page, not the whole ledger.
   *
   * A monotonically increasing request id decides which response may write
   * state: whichever fetch starts last wins, and an earlier one landing after
   * it is dropped instead of overwriting fresher rows. That is what lets the
   * effect and the post-create refresh share one code path without either
   * knowing about the other.
   *
   * No `loading` state is set from here. The effect that calls this must not
   * synchronously setState (React's cascading-render rule), and a flag that
   * only ever flips around a request is exactly what `loaded` below derives.
   */
  const latestRequest = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const fetchTransactions = useCallback(async () => {
    const id = latestRequest.current + 1;
    latestRequest.current = id;
    const isStale = () => latestRequest.current !== id;

    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.categoryId) params.categoryId = filters.categoryId;

    try {
      const data = await listTransactions({ ...params, limit: 100 });
      if (isStale()) return;
      setError(null);
      setTransactions(data.transactions ?? []);
    } catch (requestError) {
      if (!isStale()) {
        setError(requestError?.message ?? 'Could not load transactions');
      }
    } finally {
      // Both setStates are after an await, so neither is the synchronous
      // setState-in-effect the lint rule is about.
      if (!isStale()) {
        setLoaded(true);
      }
    }
  }, [filters.from, filters.to, filters.categoryId]);

  // Skeletons show only before the first response. Later refreshes keep the
  // current rows on screen instead of flashing the list away and back.
  const loading = !loaded;

  // Runs on mount and whenever a server-side filter changes. Refreshes after
  // a create or delete call fetchTransactions directly and share the same
  // request-id guard, so neither can clobber the other's rows.
  useEffect(() => {
    // Fetching on mount is the point of this effect; there is no event that
    // could replace it. Every setState inside fetchTransactions happens after
    // an await, so none is the synchronous cascade this rule guards against -
    // the rule flags the call, not the individual writes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions();
  }, [fetchTransactions, userId]);

  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (
        needle &&
        !String(transaction.description ?? '')
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (
        filters.paymentMethod &&
        transaction.paymentMethod !== filters.paymentMethod
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, filters.search, filters.paymentMethod]);

  useEffect(() => {
    let cancelled = false;

    listCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  useEffect(() => {
    setAction({
      label: 'Add Transaction',
      icon: Plus,
      onClick: openCreate,
    });
    return () => setAction(null);
  }, [setAction, openCreate]);

  function handleSaved(transaction) {
    const wasEditing = Boolean(editing);

    setFormOpen(false);
    setEditing(null);
    toast.success(wasEditing ? 'Transaction updated' : 'Transaction added', {
      description: transaction.description,
    });
    fetchTransactions();
  }

  async function handleDelete(transaction) {
    const confirmed = window.confirm(`Delete "${transaction.description}"?`);
    if (!confirmed) return;

    try {
      await deleteTransaction(transaction.id);
      setTransactions((current) =>
        current.filter((row) => row.id !== transaction.id),
      );
      toast.success('Transaction deleted');
    } catch (deleteError) {
      toast.error('Could not delete', { description: deleteError?.message });
    }
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Input
            size="sm"
            placeholder="Search descriptions"
            aria-label="Search transactions"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value }))
            }
          />
        </div>

        <Select
          size="sm"
          aria-label="Filter by category"
          className="w-40"
          options={categoryOptions}
          value={filters.categoryId}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, categoryId: event.target.value }))
          }
        />

        <Input
          size="sm"
          type="date"
          aria-label="From date"
          className="w-36"
          value={filters.from}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, from: event.target.value }))
          }
        />

        <Input
          size="sm"
          type="date"
          aria-label="To date"
          className="w-36"
          value={filters.to}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, to: event.target.value }))
          }
        />

        <Select
          size="sm"
          aria-label="Filter by payment method"
          className="w-40"
          options={PAYMENT_METHOD_OPTIONS}
          value={filters.paymentMethod}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              paymentMethod: event.target.value,
            }))
          }
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <Card padded={false} raised>
        {error ? (
          <EmptyState
            icon={Receipt}
            title="Could not load transactions"
            description={error}
            actionLabel="Try again"
            onAction={fetchTransactions}
            compact
          />
        ) : (
          <TransactionList
            transactions={visible}
            loading={loading}
            hasFilters={hasFilters}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAdd={openCreate}
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit transaction' : 'Add transaction'}
        description="Amounts are stored in paise, so decimals are exact."
        size="md"
      >
        <TransactionForm
          transaction={editing}
          categories={categories}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      </Modal>
    </div>
  );
}
