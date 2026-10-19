import Card from '../common/Card.jsx';

/**
 * One of the four dashboard headline figures.
 *
 * The label stays muted and the number carries the tone: balance in primary,
 * income and savings in success green, expenses in the normal text colour.
 * Expenses are not danger - spending is the point of a ledger, not a fault.
 */

const TONES = {
  primary: {
    icon: 'bg-primary-subtle text-primary-on-subtle',
    value: 'text-primary',
  },
  success: {
    icon: 'bg-success-subtle text-success-on-subtle',
    value: 'text-success',
  },
  neutral: {
    icon: 'bg-bg-subtle text-text-secondary',
    value: 'text-text',
  },
};

export default function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  className = '',
}) {
  const palette = TONES[tone] ?? TONES.primary;

  return (
    <Card className={`h-full ${className}`.trim()}>
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-control ${palette.icon}`}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 truncate text-sm font-medium text-text-secondary">
          {label}
        </p>
      </div>

      <p
        className={`mt-4 text-2xl font-bold tracking-tight tabular-nums ${palette.value}`}
      >
        {value}
      </p>
    </Card>
  );
}
