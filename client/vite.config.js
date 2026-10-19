import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * `test` lives in this config rather than a separate vitest.config.js so the
 * component tests resolve plugins from exactly the same config `vite build`
 * uses - a second file could silently drift from the one the app actually ships
 * with.
 *
 * `environment: 'jsdom'` because the components under test render to the DOM,
 * unlike the server suite in `server/vitest.config.js`, which runs in node.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  ...(process.env.VITEST
    ? {
        // Test-only. The budget fixtures import the server's pure threshold
        // maths (`server/src/services/budgetMath.js`) so the component tests are
        // held to the same definition of 80% that the API enforces, instead of a
        // hand-copied one that could drift. That crosses the client root, which
        // Vite otherwise refuses to serve from. Scoped to `process.env.VITEST`
        // so the dev server never gains filesystem access it does not need.
        server: { fs: { allow: [repoRoot] } },
      }
    : {}),
  test: {
    environment: 'jsdom',
    globals: true,
    // Mirrors src/, per conventions.md: tests never live next to source files.
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
});
