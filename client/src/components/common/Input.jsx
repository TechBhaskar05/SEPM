import { useId } from 'react';

import {
  CONTROL_BASE,
  FOCUS_BORDER,
  INVALID_BORDER,
  controlSize,
} from './controlStyles.js';
import Field from './Field.jsx';

/** Right padding so typed text never runs under a trailing control. */
const TRAILING_PADDING = {
  sm: 'pr-9',
  md: 'pr-11',
  lg: 'pr-12',
};

/**
 * Single-line text field.
 *
 * Handles the label/helper/error layout itself (via Field) and takes every
 * other `<input>` prop straight through - `type`, `value`, `onChange`,
 * `autoComplete`, `inputMode` and so on are passed to the DOM untouched, so
 * this is never the thing that decides how a form behaves.
 *
 * @param {string} label        Field label. Omit for a borderless search box.
 * @param {string} helperText   Hint under the control. Hidden if `error` is set.
 * @param {string} error        Validation message. Its presence is what puts
 *                              the field in the invalid state.
 * @param {boolean} optional    Marks the field "(Optional)" instead of "*".
 * @param {'sm'|'md'|'lg'} size Shares its height with Button and Select.
 * @param {React.ReactNode} [trailing]  Control rendered inside the field, flush
 *   right (for example a password visibility toggle).
 */
export default function Input({
  label,
  helperText,
  error,
  optional = false,
  size = 'md',
  id,
  className = '',
  containerClassName = '',
  trailing,
  ...rest
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;

  const { control, text } = controlSize(size);
  const invalid = Boolean(error);

  const input = (
    <input
      id={inputId}
      // `aria-invalid` and `aria-describedby` are what actually connect the
      // message to the control for a screen reader; the colour is only the
      // visual half of the same state.
      aria-invalid={invalid || undefined}
      aria-describedby={helperText || error ? messageId : undefined}
      className={[
        CONTROL_BASE,
        control,
        text,
        invalid ? INVALID_BORDER : `${FOCUS_BORDER} border-border`,
        trailing ? (TRAILING_PADDING[size] ?? TRAILING_PADDING.md) : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );

  return (
    <Field
      id={inputId}
      label={label}
      optional={optional}
      helperText={helperText}
      error={error}
      messageId={messageId}
      className={containerClassName}
    >
      {trailing ? (
        <div className="relative">
          {input}
          <span className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </span>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
