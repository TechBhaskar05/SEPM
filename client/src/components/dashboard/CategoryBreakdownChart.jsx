import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { categoryColor } from '../../utils/categoryColors.js';
import { formatMoney } from '../../utils/formatters.js';

/**
 * Spending by category, as a donut plus a readable legend.
 *
 * The legend is plain markup rather than Recharts' `<Legend>`: it gives each
 * row an amount and a percentage, which a colour swatch alone cannot, and it
 * inherits the app's type and surface tokens instead of fighting Recharts'
 * default styles.
 */

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-xs shadow-card-raised">
      <p className="font-semibold text-text">{item.categoryName}</p>
      <p className="mt-0.5 tabular-nums text-text-secondary">
        {formatMoney(item.amount)} · {item.percentage}%
      </p>
    </div>
  );
}

export default function CategoryBreakdownChart({ data, total }) {
  return (
    <div>
      <div
        className="relative h-56 w-full"
        role="img"
        aria-label="Spending broken down by category"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="categoryName"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.categoryId ?? entry.categoryName}
                  fill={categoryColor(entry.categoryName)}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-text-tertiary">Total spent</span>
          <span className="mt-0.5 text-lg font-semibold tabular-nums text-text">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <ul className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
        {data.map((entry) => (
          <li
            key={entry.categoryId ?? entry.categoryName}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor(entry.categoryName) }}
                aria-hidden="true"
              />
              <span className="truncate text-text-secondary">
                {entry.categoryName}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-text">
              {formatMoney(entry.amount)}
              <span className="ml-1.5 text-xs text-text-tertiary">
                {entry.percentage}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
