import { LoaderCircle } from 'lucide-react';

import { controlSize } from './controlStyles.js';

/**
 * The app's action primitive: `primary` for the one thing a screen wants you to
 * do, `secondary`/`ghost` for everything else, `danger` for destructive or
 * irreversible actions.
 *
 * Two behaviours are worth knowing about:
 *
 * 1. `loading` swaps the label for a spinner *without the button resizing*.
 *    The label stays in the layout at `opacity-0` - so the box keeps its exact
 *    width, and the text stays in the accessibility tree - and the spinner is
 *    laid over it, centred, by an absolutely positioned sibling.
 * 2. A loading button is really `disabled` (that is what stops a double
 *    submit), but it does not look disabled: it keeps its full colour and
 *    shows `cursor-progress`. The dimmed/cursor-not-allowed treatment means
 *    "you cannot do this right now", which is a different message from "this is
 *    happening right now".
 *
 * Hover styles are gated on `enabled:` so they genuinely cannot fire on a
 * disabled button - `:hover` alone still matches disabled elements.
 */
const VARIANTS = {
  primary:
    'bg-primary text-primary-contrast enabled:hover:bg-primary-light enabled:active:bg-primary-dark',
  secondary:
    'border border-border-strong bg-surface text-text enabled:hover:bg-bg-subtle enabled:active:bg-bg-subtle',
  ghost:
    'text-text-secondary enabled:hover:bg-bg-subtle enabled:hover:text-text enabled:active:bg-bg-subtle',
  danger:
    'bg-danger text-danger-contrast enabled:hover:bg-danger-light enabled:active:bg-danger-dark',
};

const SIZES = {
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
};

/**
 * Icon-only buttons get a square box instead of horizontal padding: `px-3` on
 * a single glyph leaves a pill that is far wider than the thing in it.
 */
const ICON_ONLY_SIZES = {
  sm: 'w-8',
  md: 'w-10',
  lg: 'w-12',
};

/**
 * @param {'primary'|'secondary'|'ghost'|'danger'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} loading  Show a spinner in place of the label.
 * @param {boolean} disabled Dim the button and block interaction.
 * @param {boolean} fullWidth Stretch to the width of the container.
 * @param {boolean} iconOnly  Square box for a button whose only child is an
 *   icon. The icon is aria-hidden, so an icon-only button MUST carry its own
 *   `aria-label` - otherwise it is announced as an unlabelled button.
 * @param {React.ComponentType} icon Icon before the label.
 * @param {React.ComponentType} iconAfter Icon after the label.
 * @param {string} className Extra classes, appended last so callers can win.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  icon: Icon,
  iconAfter: IconAfter,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const { control, text, icon, gap } = controlSize(size);
  const isInert = disabled || loading;

  return (
    <button
      type={type}
      disabled={isInert}
      aria-busy={loading || undefined}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-control font-semibold whitespace-nowrap',
        'transition-colors duration-200',
        control,
        text,
        iconOnly
          ? (ICON_ONLY_SIZES[size] ?? ICON_ONLY_SIZES.md)
          : (SIZES[size] ?? SIZES.md),
        VARIANTS[variant] ?? VARIANTS.primary,
        // The disabled look is deliberately absent while loading.
        disabled ? 'cursor-not-allowed opacity-50' : '',
        loading && !disabled ? 'cursor-progress' : '',
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className="relative inline-flex items-center justify-center">
        <span
          className={`inline-flex items-center justify-center ${gap} ${loading ? 'opacity-0' : ''}`}
        >
          {Icon && <Icon className={icon} aria-hidden="true" />}
          {children}
          {IconAfter && <IconAfter className={icon} aria-hidden="true" />}
        </span>

        {loading && (
          <LoaderCircle
            className={`absolute animate-spin motion-reduce:animate-none ${icon}`}
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}
