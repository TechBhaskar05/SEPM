# FinTrack — Architecture

## High-level overview

```
React + Vite (client)
     │  REST API (JSON over HTTPS)
     ↓
Express (Node.js) (server)
     ├── Auth Service
     ├── Transaction Service        (idempotency-key check on writes)
     ├── Budget Service             (atomic/concurrency-safe updates)
     ├── Goal Service
     ├── Dashboard Service          (read-only aggregate for the landing page)
     ├── Subscription Service
     ├── Rule Engine Service        (ordered priority evaluator)
     ├── Forecast Service           (moving average / linear regression)
     ├── Anomaly Service            (deterministic threshold check)
     ├── Report Service
     └── AI Service                 (Groq client + fallback handling)
     ↓
Prisma ORM
     ↓
PostgreSQL (Neon / Supabase, free tier)
```

External: Groq API (AI layer), called only from `aiService.js`, never
directly from controllers or other services.

## Layering rules (strict)

1. **Routes** — define HTTP method + path, attach middleware, call controller.
   No logic here beyond wiring.
2. **Controllers** — parse/validate request (via `validators/`), call one or
   more services, shape the HTTP response. No business logic, no direct
   Prisma calls.
3. **Services** — all business logic. Pure functions where possible, take
   explicit inputs, return explicit outputs. May call Prisma directly or via
   a repository-style helper. This is the layer that gets unit tested.
4. **Prisma client** — single shared instance from `lib/prismaClient.js`,
   imported by services only.

Controllers must never import `prismaClient.js` directly. If you find
yourself doing that, the logic belongs in a service.

## Request flow example — "Add Transaction"

```
Client (TransactionForm.jsx)
  → generates Idempotency-Key (UUID) client-side
  → POST /api/transactions  { amount, category, description, ... }
     headers: { Idempotency-Key: <uuid> }
  ↓
transactionRoutes.js → authMiddleware → validateRequest(transactionSchema)
  ↓
transactionController.create()
  ↓
transactionService.createTransaction(userId, data, idempotencyKey)
  - check IdempotencyKey table for existing entry → if found, return stored result
  - else: create Transaction row + budgetService.applyToBudget() atomically
    (single Prisma $transaction)
  - store IdempotencyKey → result mapping
  ↓
Response → client updates Zustand store / local state
```

## Request flow example — "AI Categorization Fallback"

```
New transaction has no matching rule (ruleEngineService returns null)
  ↓
transactionService calls aiService.suggestCategory(transactionText)
  ↓
aiService:
  - calls Groq with a strict prompt asking for JSON: { category, subcategory }
  - validates response against a Zod schema
  - on success → returns parsed suggestion
  - on failure (timeout, malformed JSON, API error) → returns null, logs
    warning, does NOT throw
  ↓
transactionController: if suggestion is null, category stays "Uncategorized"
  (user can categorize manually) — the request still succeeds (200/201)
```

**Rule: an AI failure must never cause a non-2xx response for an otherwise
valid request.** Degrade the feature, not the request.

## Module boundaries (what each service owns)

| Service | Owns | Does NOT own |
|---|---|---|
| `transactionService` | Transaction CRUD, idempotency | Budget math, categorization logic |
| `budgetService` | Budget CRUD, atomic spent-increment, utilization % | Deciding which budget a transaction affects (that's passed in) |
| `dashboardService` | Read-only aggregates: period totals, all-time balance, category breakdown, recent rows | Writing financial rows, AI narrative (that's `aiService`, Phase 11) |
| `ruleEngineService` | Evaluating rules in priority order against a transaction | Calling AI (that's the caller's job if no rule matches) |
| `forecastService` | Computing predicted next-period spend from historical data | Displaying it (that's the controller/frontend) |
| `anomalyService` | Computing whether current spend deviates from historical average beyond threshold | Writing the human-readable explanation (that's `aiService`) |
| `aiService` | All Groq calls, prompt construction, response validation, fallback | Any deterministic calculation |

## Database transactions (Postgres)

Any operation that touches more than one table and must be atomic (e.g.,
"create transaction AND update budget.spent") must be wrapped in a Prisma
`$transaction([...])` call. See `database-schema.md` for which operations
require this.

## Error handling

- Services throw typed errors (e.g., `NotFoundError`, `ValidationError`,
  `ConflictError`) defined in `src/lib/errors.js`.
- `middleware/errorHandler.js` is the single place that maps these to HTTP
  status codes and a consistent JSON shape: `{ error: { code, message } }`.
- Never leak raw Prisma/Postgres error messages to the client; log them
  server-side, return a generic message for unexpected errors (500).

## Deployment topology

- Frontend → Vercel (static build + env vars for API base URL)
- Backend → Render free web service
- Database → Neon or Supabase free Postgres
- AI → Groq API (free tier key in backend env vars only, never shipped to
  the frontend)

## Deviations

(Record any deviation from this architecture here, with date and reason, as
the project progresses. Do not silently diverge from the layering rules
above without logging it here.)
