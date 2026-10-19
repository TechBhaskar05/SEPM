import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Repeat } from 'lucide-react';

import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Modal from '../components/common/Modal.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import SubscriptionCard from '../components/subscriptions/SubscriptionCard.jsx';
import SubscriptionForm from '../components/subscriptions/SubscriptionForm.jsx';
import { usePageHeader } from '../components/layout/pageHeaderContext.js';
import {
  deleteSubscription,
  listSubscriptions,
} from '../services/subscriptionService.js';
import { formatMoney } from '../utils/formatters.js';
import { toast } from '../store/toastStore.js';

const EMPTY_ROLLUP = { monthlyTotal: 0, annualTotal: 0 };

export default function SubscriptionsPage() {
  const { setAction } = usePageHeader();

  const [subscriptions, setSubscriptions] = useState([]);
  const [rollup, setRollup] = useState(EMPTY_ROLLUP);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const latestRequest = useRef(0);

  const fetchSubscriptions = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const result = await listSubscriptions();
      if (requestId !== latestRequest.current) return;
      setSubscriptions(result.subscriptions);
      setRollup(result.rollup);
      setError(null);
    } catch (fetchError) {
      if (requestId !== latestRequest.current) return;
      setError(
        fetchError?.message ?? 'Could not load your subscriptions. Try again.',
      );
    } finally {
      if (requestId === latestRequest.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((subscription) => {
    setEditing(subscription);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  useEffect(() => {
    setAction({
      label: 'Add Subscription',
      icon: Plus,
      onClick: openCreate,
    });
    return () => setAction(null);
  }, [setAction, openCreate]);

  function handleSaved(saved) {
    const wasEditing = Boolean(editing);

    setFormOpen(false);
    setEditing(null);
    toast.success(wasEditing ? 'Subscription updated' : 'Subscription added', {
      description: saved?.name,
    });
    fetchSubscriptions();
  }

  async function handleDelete(subscription) {
    if (!window.confirm(`Delete the ${subscription.name} subscription?`)) {
      return;
    }

    try {
      await deleteSubscription(subscription.id);
      toast.success('Subscription deleted', {
        description: subscription.name,
      });
      fetchSubscriptions();
    } catch (deleteError) {
      toast.error('Could not delete the subscription', {
        description: deleteError?.message,
      });
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-card border border-border bg-danger-subtle px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchSubscriptions}>
            Retry
          </Button>
        </div>
      )}

      {loaded ? (
        <Card className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold text-text">
            Total monthly:{' '}
            <span className="numbers tabular-nums">
              {formatMoney(rollup.monthlyTotal)}
            </span>
          </p>
          <span className="text-text-tertiary" aria-hidden="true">
            ·
          </span>
          <p className="text-sm font-bold text-text">
            Total annual:{' '}
            <span className="numbers tabular-nums">
              {formatMoney(rollup.annualTotal)}
            </span>
          </p>
        </Card>
      ) : (
        <Skeleton className="h-[68px] w-full" />
      )}

      {!loaded ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Loading subscriptions…</span>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-[76px] w-full" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        !error && (
          <EmptyState
            icon={Repeat}
            title="No subscriptions yet"
            description="Add recurring services and FinTrack will roll their cost up into one monthly and annual total."
            actionLabel="Add your first subscription"
            onAction={openCreate}
          />
        )
      ) : (
        <ul className="space-y-3">
          {subscriptions.map((subscription) => (
            <li key={subscription.id}>
              <SubscriptionCard
                subscription={subscription}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit subscription' : 'New subscription'}
        description={
          editing
            ? 'Update the cost, billing frequency, or renewal date.'
            : 'What recurring service are you paying for?'
        }
        size="md"
      >
        <SubscriptionForm
          subscription={editing}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      </Modal>
    </div>
  );
}
