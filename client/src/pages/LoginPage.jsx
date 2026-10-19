import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import { useAuthStore } from '../store/authStore.js';
import { toast } from '../store/toastStore.js';
import { validateEmail, validatePasswordPresent } from '../utils/validation.js';

/** Field name -> validator, shared by blur, change and submit. */
const VALIDATORS = {
  email: validateEmail,
  password: validatePasswordPresent,
};

const EMPTY_VALUES = { email: '', password: '' };

/**
 * Email + password sign-in.
 *
 * Validation is shown per field, on blur and live thereafter for any field
 * already flagged - the submit button is disabled while the form is invalid,
 * so blur is what tells the user *why* it is disabled rather than leaving
 * them to guess. Server failures land in a toast (wrong credentials, a
 * dropped connection), except for field-level `details`, which are folded
 * back into the same inline messages the client-side rules use.
 */
export default function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const location = useLocation();

  const [values, setValues] = useState(EMPTY_VALUES);
  // Fields the user has left, or tried to submit: scolding a half-typed
  // form is noise, not help.
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const formIsValid = Object.entries(VALIDATORS).every(
    ([field, validate]) => validate(values[field]) === null,
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    // A field already flagged keeps validating live, so its message clears
    // the moment the input becomes acceptable again.
    if (touched[name]) {
      setErrors((current) => ({ ...current, [name]: VALIDATORS[name](value) }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: VALIDATORS[name](value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // The button is already disabled while invalid, but Enter-key implicit
    // submission can still reach here - this is the belt to that suspenders.
    if (!formIsValid || submitting) return;

    setSubmitting(true);
    try {
      const user = await login(values);
      toast.success('Welcome back', {
        description: `Signed in as ${user.email}.`,
      });
    } catch (error) {
      // Server-side validation carries per-field details: show them on the
      // fields they belong to. Everything else is a whole-form problem.
      const fieldDetails = Object.entries(error.details ?? {}).filter(
        ([field]) => field in VALIDATORS,
      );

      if (fieldDetails.length > 0) {
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(fieldDetails.map(([field]) => [field, true])),
        }));
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(fieldDetails),
        }));
      } else {
        toast.error(
          error.status === 401 ? 'Sign-in failed' : 'Could not sign in',
          {
            description: error.message,
          },
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // The store flips the moment login() resolves; this is what moves the user
  // into the app - back to wherever they were headed before the login wall.
  if (isAuthenticated) {
    return (
      <Navigate to={location.state?.from?.pathname ?? '/dashboard'} replace />
    );
  }

  return (
    <AuthLayout
      heading="Welcome back"
      subheading="Log in to pick up where you left off."
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.email ? errors.email : undefined}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          name="password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.password ? errors.password : undefined}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!formIsValid}
          className="mt-2"
        >
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="font-semibold text-primary transition-colors hover:text-primary-light"
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
