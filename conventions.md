# FinTrack — Conventions

## Folder structure (authoritative — do not deviate without updating this file)

```
FinTrack/
├── client/
│   └── src/
│       ├── components/<feature>/     # e.g. components/budgets/
│       ├── components/common/        # theme-aware primitives, no feature knowledge
│       ├── components/layout/        # app chrome (AppShell, Sidebar, TopBar)
│       ├── pages/
│       ├── store/                    # Zustand stores
│       ├── services/                 # Axios API wrappers, one per entity
│       ├── hooks/
│       └── utils/
├── server/
│   ├── prisma/
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── middleware/
│       ├── lib/
│       ├── validators/
│       └── utils/
├── docs/                              # submission artifacts
└── tests/ (inside server/)
```

One feature = one file per layer, same base name, e.g. for "budgets":
`budgetRoutes.js`, `budgetController.js`, `budgetService.js`,
`budgetValidator.js`, `BudgetCard.jsx`, `budgetService.js` (frontend API
wrapper — lives in `client/src/services/`, same name as backend counterpart
but different folder, this is fine, they're not the same file).

`components/common/` is the shared primitive layer (Button, Input, Select,
Card, Modal, Badge, Toast, EmptyState, Skeleton). A file there must not import
from `store/`, `services/` or any feature folder — primitives know about design
tokens, not about transactions. Feature folders build on top of them and may
know about anything.

Review surfaces (`pages/DesignSystemPage.jsx`, `pages/ComponentDemoPage.jsx`)
are temporary and live outside `AppShell`; delete each one once real pages
cover what it was previewing.

## File naming

- Backend files: `camelCase.js` — e.g. `transactionService.js`,
  `authMiddleware.js`.
- Frontend components: `PascalCase.jsx` — e.g. `TransactionForm.jsx`,
  `BudgetProgress.jsx`.
- Frontend non-component files (services, hooks, utils, store): `camelCase.js`
  — e.g. `authStore.js`, `useAuth.js`.
- Test files: `<fileUnderTest>.test.js`, placed in `tests/unit/` or
  `tests/integration/` mirroring the `src/` structure, not alongside source
  files.
- Prisma migrations: auto-named by Prisma CLI, do not rename.

## Naming inside code

- Database tables/models: `PascalCase` singular (Prisma convention) —
  `Transaction`, `Budget`, `SavingsGoal`.
- Database columns: `camelCase` in Prisma schema (Prisma maps to snake_case
  in Postgres automatically if configured — confirm `schema.prisma`
  `@map`/`@@map` usage before assuming either case).
- API routes: kebab-case, plural nouns — `/api/transactions`,
  `/api/savings-goals`, `/api/rule-engine/rules`.
- Environment variables: `UPPER_SNAKE_CASE` — `DATABASE_URL`,
  `GROQ_API_KEY`, `JWT_SECRET`.

## Money handling (critical — do not deviate)

- All monetary amounts are stored as **integers representing the smallest
  currency unit** (paise for INR: ₹1 = 100).
- Never store or calculate money as a JS `float`/`Number` with decimals, and
  never use a Postgres `FLOAT`/`DOUBLE` column for money — use `INTEGER` or
  `BIGINT`.
- Conversion to/from display format (₹123.45) happens only at the
  presentation boundary: `utils/money.js` on the backend (for any
  formatted strings in reports) and the frontend `utils/formatters.js`.
  Internal logic always works in integer paise.

## Idempotency pattern

- Every mutating endpoint that creates a financial record (currently:
  `POST /api/transactions`) requires an `Idempotency-Key` header, client
  generates a UUID v4 per logical submission (regenerate only on a genuinely
  new user action, not on retry).
- Server: check `IdempotencyKey` table for `(userId, key)`. If found, return
  the stored response with the same status code. If not found, perform the
  operation, store the key + response, then return it.
- Idempotency keys expire after 24 hours (cleanup job or lazy deletion on
  lookup — decide and document here once implemented).

  **Decided (2026-10-18): lazy deletion on lookup.** A key older than 24h is
  treated as unseen and deleted the next time it is looked up, rather than
  running a scheduled cleanup. A background job would need a cron the free-tier
  hosts cannot run — the same constraint that descoped recurring transactions
  in `features.md`. The cost is that a key nobody retries again lingers; for
  this app that is bounded by the number of transactions a user makes, and
  the row is a few hundred bytes. If that ever matters, delete keys older than
  24h opportunistically on each create, which costs one extra deleteMany and
  needs no scheduler.

## Concurrency-safe budget updates

- Never do `const budget = await getBudget(id); budget.spent += amount;
await save(budget);` — this is a read-then-write race condition.
- Always do a single atomic update:
  `UPDATE "Budget" SET spent = spent + $1 WHERE id = $2` (raw SQL or Prisma's
  equivalent atomic update), ideally inside the same `$transaction` as the
  transaction-row insert.

## AI integration rules

- All Groq calls go through `aiService.js` — no other file calls Groq
  directly.
- Every AI call has a timeout (recommend 5-8s) and a try/catch; failure
  returns `null`/a safe default, never throws up to the controller.
- AI responses that are expected to be structured (e.g., category
  suggestion) are requested as JSON and validated against a Zod schema
  before use. Invalid JSON is treated as a failure (same fallback path).
- Never let an AI-feature failure change the HTTP status code of the
  underlying request (e.g., transaction creation still returns 201 even if
  the categorization suggestion failed).

## Testing conventions

- Unit tests: for every `services/*.js` file, a corresponding
  `tests/unit/*.test.js`. Mock Prisma client and Groq client — no real DB
  or network calls in unit tests.
- Integration tests: for every route group, a `tests/integration/*.test.js`
  using Supertest against a test database (or a test schema in the same
  Postgres instance) — real DB, mocked Groq.
- Commands: `npm test` / `npm run test:unit` run the unit suites.
  `npm run test:integration` runs the DB-backed suites and refuses to start
  without `TEST_DATABASE_URL`. `npm run test:all` runs both, so it needs a test
  database too.
- Required test cases (minimum, do not skip):
  - Budget concurrency test: fire N parallel "add transaction" requests
    against one budget, assert final `spent` equals the sum.
  - Idempotency test: same `Idempotency-Key` sent twice, assert only one
    transaction row exists and both responses match.
  - Rule-engine priority test: overlapping rules, assert the highest-priority
    match wins deterministically.
  - AI-contract test: mock Groq to return malformed JSON, assert the service
    returns `null`/fallback rather than throwing.

## Git / commit conventions

- Branch per feature: `feature/<short-name>`, e.g. `feature/budget-service`.
- Commit messages: `<type>: <short description>` — types: `feat`, `fix`,
  `test`, `docs`, `refactor`, `chore`. E.g. `feat: add atomic budget
increment in budgetService`.
- Keep commits small and focused — one logical change per commit, not one
  commit per day of work. This matters for the "Git commit history" evidence
  required in the submission.
- `main` branch must always build and pass tests — use feature branches +
  PRs (even within the team) rather than committing broken code directly.

## Environment variables (keep `.env.example` in sync with these)

**Server (`server/.env.example`)**

```
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
GROQ_API_KEY=
PORT=
```

`PORT` defaults to **5001**, not 5000. macOS AirPlay Receiver listens on 5000
and answers requests with a 403 before Express ever sees them; Render supplies
`PORT` at runtime, so this default only affects local development.

**Neon-specific note:** Neon's free tier autosuspends when idle and connects
through a pooler (PgBouncer). Use the **pooled** connection string as
`DATABASE_URL` (used by the app at runtime) and the **direct** connection
string as `DIRECT_URL` (used only for `prisma migrate`). In
`schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Running migrations against the pooled URL directly can fail or behave
unexpectedly — always use `DIRECT_URL` for `npx prisma migrate dev/deploy`.

**Client (`client/.env.example`)**

```
VITE_API_BASE_URL=
```

The example value points at `http://localhost:5001/api` to match the server's
local default.

Never commit real `.env` files or real keys — only `.env.example` with
placeholder values, per the submission rubric's "no passwords/API keys"
requirement.

## Deviations

(Log any deviation from these conventions here, with date and reason.)
