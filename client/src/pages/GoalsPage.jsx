import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Target } from 'lucide-react';

import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Modal from '../components/common/Modal.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import GoalCard from '../components/goals/GoalCard.jsx';
import GoalForm from '../components/goals/GoalForm.jsx';
import { usePageHeader } from '../components/layout/pageHeaderContext.js';
import { listGoals } from '../services/goalService.js';
import { toast } from '../store/toastStore.js';

/**
 * Savings goals: a vertical list of full-width cards, one per goal.
 *
 * A list rather than a grid on purpose. A goal card carries more prose than a
 * budget tile - saved / target, the monthly contribution sentence, the deadline
 * - and at three columns those lines wrap into a wall. A single full-width
 * column gives each goal room to read like a plan rather than a metric.
 *
 * The primary action lives in the top bar next to the page title (via
 * usePageHeader), matching every other page's "one obvious next step".
 */
export default function GoalsPage() {
  const { setAction } = usePageHeader();

  const [goals, setGoals] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Monotonic request id, same pattern as budgets and transactions: whichever
  // fetch starts last wins, so a slow earlier response cannot overwrite fresher
  // rows after a create or edit.
  const latestRequest = useRef(0);

  const fetchGoals = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const result = await listGoals();
      if (requestId !== latestRequest.current) return;
      setGoals(result);
      setError(null);
    } catch (fetchError) {
      if (requestId !== latestRequest.current) return;
      setError(
        fetchError?.message ?? 'Could not load your savings goals. Try again.',
      );
    } finally {
      if (requestId === latestRequest.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the point of this effect; there is no event that
    // could replace it. Every setState inside fetchGoals happens after an
    // await, so none is the synchronous cascade the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGoals();
  }, [fetchGoals]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((goal) => {
    setEditing(goal);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  useEffect(() => {
    setAction({
      label: 'New Goal',
      icon: Plus,
      onClick: openCreate,
    });
    return () => setAction(null);
  }, [setAction, openCreate]);

  function handleSaved(saved) {
    const wasEditing = Boolean(editing);

    setFormOpen(false);
    setEditing(null);
    toast.success(wasEditing ? 'Goal updated' : 'Goal created', {
      description: saved?.name,
    });
    fetchGoals();
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-card border border-border bg-danger-subtle px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchGoals}>
            Retry
          </Button>
        </div>
      )}

      {!loaded ? (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only">Loading savings goals…</span>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-48 w-full sm:h-52" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        !error && (
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            description="Set a target and a deadline, and FinTrack will work out what to put aside each month."
            actionLabel="Create your first goal"
            onAction={openCreate}
          />
        )
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={openEdit} />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit goal' : 'New goal'}
        description={
          editing
            ? 'Update the target, what you have saved, or the deadline.'
            : 'What are you saving for, and by when?'
        }
        size="md"
      >
        <GoalForm goal={editing} onClose={closeForm} onSaved={handleSaved} />
      </Modal>
    </div>
  );
}
