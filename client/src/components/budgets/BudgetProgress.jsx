/**
 * Fill colour per threshold state.
 *
 * The whole bar changes colour rather than only an icon changing: at a glance,
 * across a grid of a dozen cards, colour is what separates "fine" from "nearly
 * gone" from "gone" without reading a single number. The names match the
 * `thresholdLevel` the server returns from `evaluateThresholds`, so the card
 * never has to re-derive which band a budget is in.
 */
const FILL = {
  ok: 'bg-primary',
  approaching: 'bg-warning',
  exceeded: 'bg-danger',
};

/**
 * Horizontal utilization bar.
 *
 * The fill is capped at 100% width. An overspent budget does not grow past the
 * track - a bar running off the end of its own card is not more informative
 * than a full one, and the `exceeded` colour plus the "over by" figure in the
 * card footer already say how far past it went.
 *
 * @param {number} utilization   spent / limit, so 1 is exactly full. Values
 *                               above 1 are allowed and clamped for width.
 * @param {'ok'|'approaching'|'exceeded'} thresholdLevel
 * @param {string} label        Accessible name, e.g. "Food & Dining budget".
 */
export default function BudgetProgress({
  utilization = 0,
  thresholdLevel = 'ok',
  label,
}) {
  const ratio = Math.max(0, Number(utilization) || 0);
  const width = Math.min(ratio, 1) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      // The maximum stays 100 even when overspent: `valuenow` is a percentage
      // of the budget, and a screen reader announcing "180 of 100" would be
      // reporting a different unit to the visible numbers.
      aria-valuemax={100}
      aria-valuetext={`${Math.round(ratio * 100)}% of budget used`}
      className="h-2 w-full overflow-hidden rounded-pill bg-bg-subtle"
    >
      <div
        className={`h-full rounded-pill transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none ${FILL[thresholdLevel] ?? FILL.ok}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
