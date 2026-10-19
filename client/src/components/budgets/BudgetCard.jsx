import {
  Bus,
  Clapperboard,
  CreditCard,
  HeartPulse,
  Home,
  Pencil,
  PiggyBank,
  ShoppingBasket,
  ShoppingCart,
  Tags,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';

import Button from '../common/Button.jsx';
import Card from '../common/Card.jsx';
import BudgetProgress from './BudgetProgress.jsx';
import { formatMoney } from '../../utils/formatters.js';

/**
 * A recognised category gets a real pictogram; anything else falls back to a
 * generic tag rather than showing nothing.
 *
 * Keyed by the seed's category names, matched case-insensitively. A category
 * the user typed themselves lands in the fallback, which is the intended
 * behaviour rather than a missing case: the icon is decoration next to a name
 * that is always spelled out.
 */
const ICONS = [
  [/food|dining/i, UtensilsCrossed],
  [/grocery/i, ShoppingBasket],
  [/transport|travel|taxi|metro|bus/i, Bus],
  [/housing|rent|mortgage/i, Home],
  [/utilit|bill|electric|water|gas/i, Zap],
  [/health|medical|doctor|pharm/i, HeartPulse],
  [/entertain|stream|movie|game/i, Clapperboard],
  [/shopping|clothes|retail/i, ShoppingCart],
  [/salary|income/i, PiggyBank],
  [/subscription|credit card|emi/i, CreditCard],
];

/**
 * The icon element for a category, or a generic tag for an unrecognised one.
 *
 * Returns an element rather than a component type on purpose: a component type
 * chosen from a lookup during render trips `react-hooks/static-components`,
 * and the fix for that rule is not to define a component inline - it is to not
 * be picking one at all.
 */
function categoryIcon(name) {
  const match = ICONS.find(([pattern]) => pattern.test(name ?? ''));
  const Glyph = match ? match[1] : Tags;
  return <Glyph className="size-4" />;
}

/**
 * One budget, as a grid tile.
 *
 * Reading order is deliberate: what it is (name), how bad is it (the coloured
 * bar, visible before any text is read), how much (spent / limit), then the
 * exact figures. The bar carries the state on its own so a row of cards can be
 * scanned without processing any numbers.
 *
 * `h-full` on the card and its body is what makes a grid row line up: the
 * tallest card in a row sets the height and the rest stretch to match, which
 * is what lets the "+ New Budget" tile sit in the same grid as a real one.
 * `min-h-46` is the other half of that: stretch only reaches as far as the
 * tallest sibling, so a tile that ends up alone in a row (always the case in a
 * single-column layout) would otherwise fall back to its own, shorter, minimum
 * and sit 8px under the cards above it. Both sides share this value.
 *
 * @param {object} budget    A budget from GET /api/budgets.
 * @param {() => void} onEdit
 */
export default function BudgetCard({ budget, onEdit }) {
  const {
    category,
    spent,
    limitAmount,
    remainingAmount,
    utilization,
    utilizationPercent,
    thresholdLevel,
  } = budget;

  const exceeded = spent > limitAmount;
  const over = spent - limitAmount;

  return (
    <Card padded={false} className="group flex h-full min-h-46 flex-col">
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-subtle text-primary-on-subtle"
              aria-hidden="true"
            >
              {categoryIcon(category?.name)}
            </span>
            <h3 className="truncate text-sm font-semibold text-text">
              {category?.name ?? 'Uncategorised'}
            </h3>
          </div>

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={Pencil}
              onClick={() => onEdit(budget)}
              aria-label={`Edit ${category?.name ?? 'uncategorised'} budget`}
              // Always visible on touch, where there is no hover to reveal it.
              // On pointer devices it fades in on hover, and stays visible while
              // it holds focus so a keyboard user can always see what they are
              // tabbed onto.
              className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            />
          )}
        </div>

        <p className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-text tabular-nums">
            {formatMoney(spent)}
          </span>
          <span className="text-sm text-text-tertiary tabular-nums">
            / {formatMoney(limitAmount)}
          </span>
        </p>

        <BudgetProgress
          utilization={utilization}
          thresholdLevel={thresholdLevel}
          label={`${category?.name ?? 'Uncategorised'} budget`}
        />

        {/* mt-auto pins this row to the bottom, so the figures line up across a
            row of cards whose amounts wrap to different heights. */}
        <div className="mt-auto flex items-center justify-between gap-2 text-xs tabular-nums">
          <span className="text-text-tertiary">{utilizationPercent}% used</span>
          <span
            className={
              exceeded ? 'font-semibold text-danger' : 'text-text-tertiary'
            }
          >
            {exceeded
              ? `${formatMoney(over)} over`
              : `${formatMoney(remainingAmount)} left`}
          </span>
        </div>
      </div>
    </Card>
  );
}
