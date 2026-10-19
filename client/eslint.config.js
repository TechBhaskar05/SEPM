import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      // Formatting (2-space indent, single quotes, semicolons) is owned by
      // Prettier - see .prettierrc.json. eslint-config-prettier disables the
      // stylistic ESLint rules so the two tools never disagree, so they are
      // intentionally not re-enabled here.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Config files run in Node, not in the browser, and are the only ones
    // allowed to say so. `process.env` in vite.config.js is the whole point of
    // the VITEST branch, so the globals are scoped by file pattern here rather
    // than annotated at each call site - one definition of what each kind of
    // file is permitted to touch, instead of a comment per line.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
];
