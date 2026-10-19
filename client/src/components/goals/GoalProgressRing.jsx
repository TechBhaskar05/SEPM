import { Check } from 'lucide-react';

/**
 * Circular progress ring for one savings goal.
 *
 * Deliberately not BudgetProgress's horizontal bar: budgets and goals are
 * different ideas, and carrying the difference in the shape means the two can
 * be told apart at a glance without reading a label. The ring is used for every
 * goal card so the page reads as one system.
 *
 * The arc is capped at a full circle for over-saved goals, but the figure in
 * the middle is not capped - someone who saved ₹11,000 toward a ₹10,000 goal
 * should see 110%, not a silently rounded 100%. `aria-valuenow` is capped
 * because progressbar semantics are 0-100; the accessible value text carries
 * the actual story.
 *
 * @param {number} percent     saved / target, already rounded by the server.
 * @param {string} label       Accessible name, e.g. "Japan trip progress".
 * @param {boolean} achieved   Use the success colour and a check badge.
 */
export default function GoalProgressRing({
  percent = 0,
  label,
  achieved = false,
}) {
  const value = Math.max(0, Number(percent) || 0);
  const arc = Math.min(value, 100);
  const rounded = Math.round(value);

  return (
    <div className="relative flex size-28 shrink-0 items-center justify-center sm:size-32">
      <svg
        viewBox="0 0 120 120"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(arc)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={achieved ? 'Goal reached' : `${rounded}% saved`}
        // Start the arc at twelve o'clock rather than three o'clock. The
        // rotation applies to the SVG only; the text is a sibling, so it stays
        // upright.
        className="size-full -rotate-90"
      >
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="9"
          // `pathLength` normalises the circumference to 100, which lets the
          // dash values be percentages instead of a hard-coded 2πr.
          pathLength="100"
          className="stroke-border"
        />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - arc}
          className={`transition-[stroke-dashoffset,stroke] duration-700 ease-out motion-reduce:transition-none ${
            achieved ? 'stroke-success' : 'stroke-primary'
          }`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight text-text tabular-nums">
          {rounded}%
        </span>
        <span className="text-[11px] font-medium tracking-wide text-text-tertiary uppercase">
          {achieved ? 'complete' : 'saved'}
        </span>
      </div>

      {achieved && (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-pill bg-success text-success-contrast ring-2 ring-surface"
          aria-hidden="true"
        >
          <Check className="size-3.5" />
        </span>
      )}
    </div>
  );
}
