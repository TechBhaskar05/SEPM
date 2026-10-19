import { PartyPopper, Pencil, TrendingUp, TriangleAlert } from 'lucide-react';

import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import Card from '../common/Card.jsx';
import GoalProgressRing from './GoalProgressRing.jsx';
import { formatMoney, formatMonthYear } from '../../utils/formatters.js';

/**
 * One savings goal, as a full-width card.
 *
 * Reading order is deliberate: what it is and when it is due, then how far
 * along it is (the ring, readable before any figure), then the two amounts,
 * then the single most useful number on the card - what to put aside each
 * month. That contribution is a highlighted chip rather than muted body text
 * because it is the card's answer, not a footnote.
 *
 * The server has already decided whether the goal is achieved or overdue and
 * computed the contribution; this component only renders those answers. Keeping
 * the maths on one side of the wire is what stops the card's advice drifting
 * from the service's.
 *
 * @param {object} goal   A goal from GET /api/savings-goals.
 * @param {(goal: object) => void} [onEdit]
 */
export default function GoalCard({ goal, onEdit }) {
  const {
    name,
    savedAmount,
    targetAmount,
    deadline,
    requiredMonthlyContribution,
    progressPercent,
    isAchieved,
    isOverdue,
  } = goal;

  return (
    <Card
      padded={false}
      className={`group ${
        isAchieved ? 'border-success/50 ring-1 ring-success/20' : ''
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-lg font-bold tracking-tight break-words text-text">
            {name}
          </h3>

          <div className="flex shrink-0 items-center gap-1.5">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={Pencil}
                onClick={() => onEdit(goal)}
                aria-label={`Edit ${name} goal`}
                // Always visible on touch, where there is no hover to reveal
                // it. On pointer devices it fades in on hover and stays
                // visible while focused, so a keyboard user can see it.
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              />
            )}

            <Badge size="sm" tone={isOverdue ? 'danger' : 'neutral'}>
              Due {formatMonthYear(deadline)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-5 sm:gap-6">
          <GoalProgressRing
            percent={progressPercent}
            label={`${name} progress`}
            achieved={isAchieved}
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-secondary">
              Saved{' '}
              <span className="font-semibold text-text tabular-nums">
                {formatMoney(savedAmount)}
              </span>{' '}
              of{' '}
              <span className="tabular-nums">{formatMoney(targetAmount)}</span>
            </p>

            <div className="mt-3">
              {isAchieved ? (
                <p className="inline-flex items-center gap-1.5 rounded-pill bg-success-subtle px-3 py-1.5 text-sm font-semibold text-success-on-subtle">
                  <PartyPopper className="size-4" aria-hidden="true" />
                  Goal reached! 🎉
                </p>
              ) : isOverdue ? (
                <p className="inline-flex items-center gap-1.5 rounded-pill bg-danger-subtle px-3 py-1.5 text-sm font-semibold text-danger-on-subtle">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Save {formatMoney(requiredMonthlyContribution)} now to get
                  back on track
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 rounded-pill bg-primary-subtle px-3 py-1.5 text-sm font-semibold text-primary-on-subtle">
                  <TrendingUp className="size-4" aria-hidden="true" />
                  Save {formatMoney(requiredMonthlyContribution)}/month to reach
                  this on time
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
