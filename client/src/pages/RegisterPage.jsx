import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import { useAuthStore } from '../store/authStore.js';
import { toast } from '../store/toastStore.js';
import {
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordConfirmation,
} from '../utils/validation.js';

const EMPTY_VALUES = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/**
 * Account creation.
 *
 * Same rhythm as LoginPage - per-field messages on blur, a toast for
 * whole-form server failures - with two additions: the password rules are
 * the server's real ones (so a rejected password is rare), and changing the
 * password re-checks the confirmation field, since that is the one field
 * whose validity depends on another.
 *
 * A duplicate email comes back as 409 CONFLICT and gets its own toast
 * title; the server deliberately does not say whether an email exists on
 * the login route, so this is the only place that answer is given.
 */
export default function RegisterPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const register = useAuthStore((state) => state.register);
  const location = useLocation();

  const [values, setValues] = useState(EMPTY_VALUES);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Built per render on purpose: the confirmation rule needs the *current*
  // password, so it cannot live in a module-level constant the way
  // LoginPage's validators do.
  const validators = {
    name: validateName,
    email: validateEmail,
    password: validateNewPassword,
    confirmPassword: (value) =>
      validatePasswordConfirmation(values.password, value),
  };

  const formIsValid =
    validateName(values.name) === null &&
    validateEmail(values.email) === null &&
    validateNewPassword(values.password) === null &&
    validatePasswordConfirmation(values.password, values.confirmPassword) ===
      null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (!touched[name]) return;

    setErrors((current) => ({ ...current, [name]: validators[name](value) }));

    // Editing the password can invalidate a previously matching confirmation,
    // so re-check it against the *new* value rather than the one this render
    // was built with.
    if (name === 'password' && touched.confirmPassword) {
      setErrors((current) => ({
        ...current,
        confirmPassword: validatePasswordConfirmation(
          value,
          values.confirmPassword,
        ),
      }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: validators[name](value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formIsValid || submitting) return;

    setSubmitting(true);
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success('Account created', {
        description: 'Welcome to FinTrack - your dashboard is ready.',
      });
    } catch (error) {
      const fieldDetails = Object.entries(error.details ?? {}).filter(
        ([field]) => field in validators,
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
          error.status === 409
            ? 'Email already in use'
            : 'Could not create account',
          { description: error.message },
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // A registered visitor is signed in by definition, so send them straight
  // to wherever they were originally headed.
  if (isAuthenticated) {
    return (
      <Navigate to={location.state?.from?.pathname ?? '/dashboard'} replace />
    );
  }

  return (
    <AuthLayout
      heading="Create your account"
      subheading="Track spending, budgets and goals from day one."
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Input
          label="Name"
          type="text"
          name="name"
          value={values.name}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.name ? errors.name : undefined}
          placeholder="Ada Lovelace"
          autoComplete="name"
          autoFocus
        />
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
        />
        <Input
          label="Password"
          type="password"
          name="password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.password ? errors.password : undefined}
          helperText="At least 8 characters"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          value={values.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.confirmPassword ? errors.confirmPassword : undefined}
          placeholder="••••••••"
          autoComplete="new-password"
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!formIsValid}
          className="mt-2"
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-primary transition-colors hover:text-primary-light"
        >
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
