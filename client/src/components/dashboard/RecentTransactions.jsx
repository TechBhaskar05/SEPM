import { Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

import Card from '../common/Card.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Skeleton from '../common/Skeleton.jsx';
import TransactionItem from '../transactions/TransactionItem.jsx';

/**
 * The dashboard's five most recent entries.
 *
 * Rows use TransactionItem's compact variant, so the amount sign, colour and
 * category label match the full ledger without repeating those rules here.
 */

const SKELETON_COUNT = 5;

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-20" />
    </li>
  );
}

export default function RecentTransactions({ transactions, loading }) {
  return (
    <Card
      title="Recent Transactions"
      action={
        <Link
          to="/transactions"
          className="text-sm font-semibold text-primary transition-colors hover:text-primary-light"
        >
          View all
        </Link>
      }
      padded={false}
      className="h-full"
    >
      {loading ? (
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading recent transactions</span>
          <ul>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <RowSkeleton key={index} />
            ))}
          </ul>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          compact
          icon={Receipt}
          title="No transactions yet"
          description="Your five latest entries will appear here."
        />
      ) : (
        <ul>
          {transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              compact
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
