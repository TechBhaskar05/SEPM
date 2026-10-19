# FinTrack — Progress Tracker

**Instructions for AI assistant:** update this file every time a feature
moves between states. Do not mark something "Done" unless it has passing
tests per `conventions.md`. Keep entries short — this is a status board, not
a changelog (Git history is the changelog).

## Mid-semester evaluation target

Chosen end-to-end demo flow (fill in once decided with the team):
`Login → add transaction → budget reflects update → view on dashboard`

Mid-sem scope = Increments 1–4 below, at minimum. Everything past that is
"remaining semester" work for the report.

## Increment status

| # | Increment | Status | Notes |
|---|---|---|---|
| 1 | Foundation (auth, skeleton, DB, deploy pipeline) | In Progress | Design tokens, AppShell layout route, `components/common/` primitive set, Prisma schema + migration, and the backend auth flow (register/login/me with tests) are done; frontend login, rate limiting, `TEST_DATABASE_URL` and deploy pipeline still open |
| 2 | Transactions (CRUD, idempotency) | Done | CRUD + idempotent creation over HTTP, integration tests passing. Budget increment is wired into create (see Budgets). Frontend has no edit/delete yet — the page only creates, lists, filters and deletes |
| 3 | Budgets (utilization, concurrency-safe update) | In Progress | Service, routes, controller, validator, the atomic increment and the pure threshold maths are done, and a transaction increments its budget inside the same `$transaction`. `BudgetsPage` with `BudgetCard`/`BudgetProgress`/`BudgetForm` is built and the alert chain is verified live against Neon. CRUD + concurrency integration tests are still unrun — blocked on `TEST_DATABASE_URL` |
| 4 | Savings Goals | Not Started | |
| 5 | Dashboard | Not Started | |
| 6 | Subscriptions | Not Started | |
| 7 | Rule Engine | Not Started | |
| 8 | Forecasting | Not Started | |
| 9 | Anomaly Flagging | Not Started | |
| 10 | Reports | Not Started | |
| 11 | AI Enhancements (categorization, summary, anomaly text) | Not Started | |
| 12 | Hardening & Testing | Not Started | |
| 13 | Deployment & Demo Prep | Not Started | |

Status values: `Not Started`, `In Progress`, `Done`, `Blocked` (note why).

## Feature-level detail (update as work happens)

### Database (Prisma schema + migration)
- [x] `server/prisma/schema.prisma` — all 9 models from `database-schema.md`
      (`User`, `Category`, `Transaction`, `Budget`, `SavingsGoal`,
      `Subscription`, `FinancialRule`, `IdempotencyKey`, `Activity`),
      UUID PKs via `uuid()` default
- [x] Neon datasource: pooled `DATABASE_URL` at runtime, `DIRECT_URL` for
      migrations only, per `conventions.md`
- [x] Money stored as `Int` paise — no float/decimal column anywhere in the
      schema
- [x] Constraints: `User.email` unique; `Budget (userId, categoryId, period)`
      unique; `IdempotencyKey (userId, key)` unique; `Transaction` indexes on
      `(userId, date)` and `(userId, categoryId)`; 11 FKs
- [x] Initial migration `20261018112439_init` applied to Neon (9 tables
      verified live)
- [x] `src/lib/prismaClient.js` — shared Prisma instance, imported by services
      only
- [ ] `TEST_DATABASE_URL` set in `server/.env` — integration tests refuse to
      run without it, so they cannot delete rows from the development
      database. Do this before adding demo data
- [ ] Seed script for demo data

### Auth
- [x] Register endpoint — `POST /api/auth/register`, bcrypt at cost 12
- [x] Login endpoint + JWT issuance — `POST /api/auth/login`, HS256, 1h TTL
- [x] Auth middleware — `authMiddleware.js` verifies the bearer token and
      loads the user via `authService.getUserById()` (no Prisma import, per
      `architecture.md`)
- [x] `GET /api/auth/me` behind `authMiddleware`
- [x] `lib/errors.js` typed errors + `middleware/errorHandler.js`
      (`{ error: { code, message } }`, Prisma + Zod errors mapped, never a
      stack trace in any environment)
- [ ] Frontend login/register pages (placeholder `/login` route exists so the
      shell's logout has somewhere to land; `authStore.js` is still a
      placeholder identity with a demo sign-in)
- [x] Tests: auth integration test — register → login → `/me` against a real
      database; plus 12 unit tests for `authService` with Prisma and bcrypt
      mocked
- [ ] Rate limiting on `/api/auth/*` (unbounded password guessing until this
      lands)

### Layout / shell (design tokens + AppShell)
- [x] Tailwind v4 token set, light + dark (`client/tailwind.config.js`,
      `client/src/index.css`)
- [x] `ThemeToggle` + `uiStore` theme persistence with no flash of wrong theme
- [x] `AppShell` layout route: collapsible sidebar (icon-only rail) + mobile
      slide-over drawer, sticky top bar, 1280px capped content column
- [x] Nav config driving sidebar links, active state and page titles together
- [x] Per-page primary action in the top bar via `usePageHeader()`
- [x] Placeholder routes for all seven feature pages (Dashboard, Transactions,
      Budgets, Goals, Subscriptions, Rules, Reports)
- [ ] Replace `DesignSystemPage.jsx` once real pages cover the tokens
- [ ] No component tests yet — shell has only lint + build coverage

### Common primitives (`components/common/`)
- [x] `Button` — primary/secondary/ghost/danger × sm/md/lg, loading state that
      holds the label's width, disabled state (dimmed, `cursor-not-allowed`,
      hover gated on `enabled:`), icon slots, `fullWidth`
- [x] `Input` / `Select` — shared `Field` shell (label above, helper or error
      below, never both), one height scale across Button/Input/Select,
      `aria-invalid` + `aria-describedby` wiring
- [x] `Card` — optional header slot (title + action), `description`, `footer`,
      `padded={false}` for flush tables, `raised`
- [x] `Modal` — portal, focus trap, Escape + backdrop close, scroll lock,
      sm/md/lg/xl, `dismissible={false}` for in-flight destructive confirms
- [x] `Badge` — six semantic tones × subtle/outline × sm/md, dot + icon slots
- [x] `Toast` + `ToastViewport` + `store/toastStore.js` — bottom on mobile,
      top-right from `sm` up, 4s auto-dismiss, pause on hover/focus, capped at
      four, `toast.success/error/info(title, { description, duration })`
- [x] `EmptyState` — icon + instruction + optional CTA, `compact` variant
- [x] `Skeleton` / `SkeletonText` — pulsing blocks sized to the content they
      stand in for
- [x] `ComponentDemoPage.jsx` at `/components` — every variant of every
      component on one review page, outside the app shell
- [ ] No component tests yet — primitives have lint + build coverage only, and
      should get Vitest + Testing Library tests once the test setup lands

### Transactions
- [x] Prisma model
- [x] `transactionService.createTransaction` with idempotency check
- [x] CRUD routes/controllers
- [x] Frontend transaction list + form
- [x] Tests: idempotency test, CRUD integration test
- [ ] Frontend edit and delete (the page deletes; editing is service-only so far)

### Budgets
- [x] Prisma model
- [x] `budgetService` atomic increment logic — `applyTransactionToBudget(budgetId,
      amount, client)`, a single `{ spent: { increment } }` statement, taking an
      optional client so it can run inside a caller's `$transaction`
- [x] Threshold alert logic — `evaluateThresholds(spent, limitAmount)` and
      `calculateUtilization` are pure; 80% fires as `approaching`, 100% as
      `exceeded`. A transaction only reports the thresholds *it* crossed, worked
      out from `spent - amount` on the value the atomic update returned, so it
      does not re-alert on every later expense
- [x] CRUD routes/controllers/validator (`GET|POST /api/budgets`,
      `GET|PATCH|DELETE /api/budgets/:id`); `spent` is not an editable field
- [x] Unit tests: 36 in `tests/unit/budgetService.test.js`, including that the
      increment never reads the budget first and never leaves the shared client
      when a `$transaction` handle is passed
- [ ] Tests: concurrency test (N parallel requests, assert `spent` == sum) is
      written in `tests/integration/budgetConcurrency.test.js` — 10 trials of 10
      simultaneous ₹100 expenses against one budget, each asserting
      `spent === 100000`, plus a row-scoped CHECK constraint that forces the
      budget update to fail and asserts the transaction row, the spend and the
      idempotency key all roll back together. **Never executed**: no Docker or
      local Postgres on this machine, and the Neon dev database is off limits
      until a branch exists. Blocked on `TEST_DATABASE_URL`
- [ ] Frontend budget view
- [x] Frontend budget view — `BudgetsPage` (1/2/3 column grid, dashed
      "New Budget" tile as the last grid item, `EmptyState` spanning the grid),
      `BudgetCard`, `BudgetProgress`, `BudgetForm`. Toasts fire once per budget
      per period per threshold, suppressed via `sessionStorage` so a reload does
      not re-shout. **Backend chain verified live against Neon** (login ->
      categories -> create budget -> 85% expense returns
      `budgetAlert: [0.8]` -> 105% returns `[1]` -> a further expense returns
      `null`). **Rendered UI verified in headless Chrome** at 1440/834/390:
      3/2/1 columns confirmed from `gridTemplateColumns`, and the fill colour
      read back as the expected token at 79,999 / 80,000 / 100,000 paise.
      Still no transaction was ever created against a live budget from the UI,
      and the page has not been driven by hand
- [ ] Editing or deleting a transaction does not yet move `Budget.spent` back.
      Deleting an expense leaves the budget overstated, and updating its amount
      leaves it at the old value. Both need the mirror-image atomic decrement
      inside the same `$transaction`

### Savings Goals
- [ ] Prisma model
- [ ] `goalService.calculateRequiredContribution`
- [ ] Frontend goal view
- [ ] Tests: unit test for contribution math

### Dashboard
- [ ] Aggregation query/service
- [ ] Recharts integration
- [ ] Frontend page

### Subscriptions
- [ ] Prisma model
- [ ] CRUD + rollup calculation
- [ ] Frontend view

### Rule Engine
- [ ] Prisma model
- [ ] `ruleEngineService.evaluate(transaction, rules)`
- [ ] Priority ordering + first-match logic
- [ ] Frontend rule management UI
- [ ] Tests: priority/tie-break unit tests

### Forecasting
- [ ] `forecastService` (moving average / regression)
- [ ] Frontend chart
- [ ] Tests: known-series unit test

### Anomaly Flagging
- [ ] `anomalyService` threshold check
- [ ] Integration with AI explanation text
- [ ] Tests: unit test for threshold logic

### Reports
- [ ] `reportService` (each report type)
- [ ] Frontend report pages

### AI Enhancements
- [ ] `aiService` Groq client setup
- [ ] Categorization suggestion endpoint + fallback
- [ ] Summary narrative endpoint + fallback
- [ ] Anomaly explanation endpoint + fallback
- [ ] Tests: mocked-Groq contract tests for each (success + malformed-output
      cases)

### Hardening & Testing
- [ ] Full test suite passing
- [ ] Rate limiting on write + AI endpoints
- [ ] Security review (no secrets committed, helmet configured, etc.)

### Deployment
- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Database provisioned on Neon/Supabase
- [ ] Seed script for demo data
- [ ] Demo video recorded

## Known deviations from the original plan

(List anything the team decided to change from `features.md` /
`architecture.md` / `database-schema.md`, with date and reason — e.g. a
feature descoped, a different library used, a schema field renamed.)

- 2026-10-19 — The shared field schemas (`paise`, `uuid`, `isoDate`, and the new
  `yearMonth`) moved out of `transactionValidator.js` into
  `validators/commonValidator.js`. Budgets validate a limit against the same
  integer-paise rule, and `conventions.md` does not let the money rules drift;
  two copies of the int4 bound and its rationale is one too many.
- 2026-10-19 — A budget is matched to a transaction by the **period of the
  transaction's own `date`**, not by the current month, and a transaction whose
  category has no budget for that period is simply not budgeted (creation still
  returns 201). `database-schema.md` says "create transaction + update
  budget.spent" but does not say which budget, and a missing budget is a setup
  gap rather than a client error — failing the write would be the wrong
  trade-off.
- 2026-10-19 — A budget needs a real `categoryId` UUID, and the Category table
  was empty with no endpoint to read it, so `GET /api/categories` was added
  (read-only, session-gated, returns the user's own categories plus the
  `userId: null` system defaults sorted by name) together with
  `server/prisma/seed.js`, run manually via `npm run db:seed`. The seed is a
  script, not a migration — it inserts rows and never deletes any, because
  `onDelete: SetNull` means dropping a category silently uncategorises somebody's
  transactions.
- 2026-10-19 — `Button` gained an `iconOnly` prop. Icon-only controls (the
  card's edit button) were the first thing that wanted a square box: the
  shared `px-3`/`px-4`/`px-5` sizing left a pill far wider than the glyph in
  it. Overriding with a width class would have fought the padding class on CSS
  source order, which is the kind of thing that fails silently.
- 2026-10-19 — `formatPeriod()` renders a period with `timeZone: 'UTC'` so a
  bare "2026-10" does not get re-read as local midnight and land in the
  previous month west of Greenwich.
- 2026-10-19 — The "New Budget" tile and `BudgetCard` both carry `min-h-46`.
  Grid `stretch` was hiding a 6px mismatch: the tile only reached the cards'
  height when it shared a row with one, so in a single-column layout — where it
  is always the last item, alone — it fell back to its own shorter minimum and
  sat under the cards above it. `h-full` alone does not fix this; stretch can
  only ever reach as far as the tallest sibling, so both sides need the same
  floor for the case where there is no sibling.
- 2026-10-19 — Creating an expense may attach a `budgetAlert` to the transaction
  response (and therefore to the stored idempotent body), reporting only the
  thresholds *that transaction* crossed. Replays return it verbatim, so a retry
  does not re-raise an alert the user already saw.

- 2026-10-18 — Integration tests **require** `TEST_DATABASE_URL` and throw
  rather than falling back to `DATABASE_URL`. `conventions.md` suggests "a test
  database (or a test schema in the same Postgres instance)"; the free Neon
  tier gives one database, so a fallback would have meant the suite's
  `deleteMany` ran against whatever data the dev database held. Scoping rows by
  an email prefix is a convention, not a boundary — refusing to start is one.
  Create the branch with `neon branches create --name dev --parent main`, or
  the equivalent in the console.
- 2026-10-18 — `authMiddleware` calls `authService.getUserById()` rather than
  importing `prismaClient` directly. `architecture.md` says the Prisma client is
  "imported by services only", and the middleware was the one file outside
  `services/` reaching for it. Routing the lookup through the service keeps the
  rule true without weakening it, rather than amending the rule to fit the
  code. It also means a token for a deleted account stops working, since the
  lookup returns null.
- 2026-10-18 — Prisma pinned to **6.19.3**, not the latest 7.x/8.x. Prisma 7
  removed `url` and `directUrl` from the `datasource` block entirely (they move
  to `prisma.config.ts`, and the runtime URL moves into the `PrismaClient`
  constructor via a driver adapter). That breaks `conventions.md`'s Neon
  pattern, which keeps both strings in the schema. v6 is the last major that
  supports `DATABASE_URL` + `DIRECT_URL` as documented. Also note `npm` tags
  `prisma`'s `latest` as an 8.0.0-rc, so an unpinned install picks up a release
  candidate — pin the version explicitly.
- 2026-10-18 — Three schema details not pinned by `database-schema.md`, added
  as conventional defaults and flagged for review: `Budget.spent` and
  `SavingsGoal.savedAmount` default to `0`; `Activity.metadata` is nullable
  ("optional extra context" in the doc, but not marked nullable); and every
  relation carries an explicit `onDelete` — `CASCADE` on user-owned rows,
  `SET NULL` for `Transaction.categoryId` so deleting a category lands the
  transaction in "Uncategorized" rather than destroying it. The first migration
  is already applied, so changing any of these needs a new migration.
- 2026-10-16 — Mobile navigation is a **slide-over drawer** behind a hamburger,
  not a bottom tab bar. The prompt allowed either; the drawer was chosen
  because seven nav items plus a user section do not fit in a 375px bottom bar.
- 2026-10-16 — The mobile drawer's scrim uses the static `neutral-900/60`
  palette step rather than a semantic token. The `bg-inverse` token inverts
  per mode (near-white in dark mode), so a scrim built from it would flash the
  screen white when opening the drawer at night.
- 2026-10-16 — A placeholder `/login` route (`LoginPage.jsx`) was added ahead
  of Increment 1, plus a `signInAsDemoUser` action in `authStore.js`. Reason:
  `AppShell` redirects unauthenticated visitors to `/login`, and with no route
  there the wildcard route bounced them back into the shell in a redirect loop.
  Both are marked PLACEHOLDER in-file and should be deleted with Increment 1.
- 2026-10-16 — `index.css` duplicates the palette hexes as literal values rather
  than referencing `--color-*`, because Tailwind v4 inlines config colours
  instead of emitting those custom properties. `tailwind.config.js` stays the
  source of truth and the two must be kept in sync.
- 2026-10-16 — Colour keys in `tailwind.config.js` must be **quoted kebab-case**
  (`'on-subtle':`) if more than one word. Tailwind v4's `@config` compat layer
  does not kebab-case camelCase keys: a key `onSubtle` only ever matches
  `text-primary-onSubtle`, and `text-primary-on-subtle` silently generates no
  CSS at all. Verify a new token actually emits by grepping the built CSS —
  a missing utility fails silently and the element just inherits a colour.
- 2026-10-16 — Added `--c-primary-on-subtle` for text/icons drawn on a
  `primary-subtle` fill. Dark mode reused the base `--c-primary` here, which
  is only 3.81:1 on the dark subtle fill — below WCAG AA 4.5:1 for the 14px nav
  labels. It now steps up to primary-300 (6.41:1); light mode is unchanged at
  5.25:1. The active nav item is also `font-semibold` (inactive stays
  `font-medium`) so the active page stays identifiable without colour.
- 2026-10-17 — Added `--c-{success,danger,warning,info}-on-subtle`, matching
  the `--c-primary-on-subtle` pattern from 2026-10-16, because badges and
  status text sit on those subtle fills. The base accents fail the same check
  the primary one did: in dark mode `--c-danger` is 2.61:1 on `danger-subtle`
  and `--c-success` is 3.83:1 on `success-subtle`. Dark mode now steps up to
  the 300 step (danger 5.06:1, success 6.38:1); light mode uses the 700 step
  (danger 5.72:1, warning 4.84:1, success 5.21:1, info 7.07:1).
- 2026-10-17 — `Badge` has no solid (filled) variant. It was specified, but a
  solid badge needs white-on-accent, and `--c-*-contrast` does not clear WCAG
  AA for every tone: white on `success-600` is 3.77:1 and white on `info-400`
  is 2.98:1. Rather than special-case two tones or ship a variant below the
  contrast the rest of the app holds to, the component ships `subtle` and
  `outline` only. If a solid badge is ever needed it has to go through the
  palette first, in both modes.
- 2026-10-17 — `Badge` outline borders use Tailwind's `/40` opacity modifier on
  a themed colour (`border-success/40`), which resolves to a `color-mix()`
  against the CSS variable. Verified in the built CSS, because an opacity
  modifier on a `var()` colour is exactly the kind of thing that fails silently
  (see the 2026-10-16 note on kebab-case colour keys).
- 2026-10-17 — Button hover styles are written `enabled:hover:*` rather than
  `hover:*`. `:hover` alone still matches a disabled button, so without the
  `enabled:` gate a disabled primary button still changes colour on hover,
  which reads as broken rather than disabled.
- 2026-10-17 — A loading `Button` sets `disabled` (that is what actually stops
  a double submit) but does not take the disabled *appearance*, and shows
  `cursor-progress` instead of `cursor-not-allowed`. Dimming means "you cannot
  do this right now"; a spinner means "this is happening right now" — the two
  states should not look the same.
- 2026-10-17 — Modal and Toast focus trapping is hand-rolled in `Modal.jsx`
  (query focusable nodes, cycle first/last on Tab, restore focus on close)
  rather than pulling in a focus-trap dependency. It is ~30 lines, adding no
  bundle weight, and principle 6's "check it is free" is a weaker reason to add
  a dependency than "do we need it". Revisit only if the trap has to handle
  portals, shadow DOM or nested dialogs.
- 2026-10-17 — Toast state lives in `client/src/store/toastStore.js`, not in
  the component, so any module can raise a notification without a callback
  threaded down the tree. `ToastViewport` is mounted in `main.jsx` above the
  router for the same reason. Dismissal timers are owned by each `Toast` rather
  than the store, so hovering or tabbing into a toast pauses it.
- 2026-10-17 — Toast stack is uniform width and its order flips per
  breakpoint (`flex-col sm:flex-col-reverse`), both found by driving the real
  page in Chrome rather than by reading the code. The first cut used
  `sm:items-end`, which let each toast shrink to its own text and left a ragged
  left edge as soon as two messages differed in length; the column now
  stretches. The same cut used one `flex-col-reverse` for both layouts, which
  put the *oldest* toast against the bottom edge on mobile — backwards for a
  bottom-anchored stack. Mobile is now newest-at-the-bottom edge, desktop
  newest-at-the-top-right corner, which is what the two anchors each want.
- 2026-10-17 — Verified in Chrome (CDP, real clicks and key events) rather than
  asserted from source: Button loading drift is 0.00px against its idle twin
  across all three variants; Modal focus stays inside across the full tab cycle,
  Shift+Tab wraps to the last stop, Escape closes, and focus returns to the
  triggering button; `dismissible={false}` survives both Escape and a backdrop
  click; 3 and 4 toasts fit on 390x844, 375x667 and 360x640 without overflow;
  the toast queue caps at four. Note for later: Tailwind's `transition-colors`
  includes `outline-color`, so the focus ring fades in over 200ms — sample
  focus styles after the transition, not immediately after focusing.

## Open questions / decisions still needed

- Final team task allocation (names against modules)
- Exact mid-sem demo script/order for the video
