# FinTrack — Database Schema (PostgreSQL via Prisma)

This is the target schema. Keep `server/prisma/schema.prisma` in sync with
this document — if they diverge, update this file in the same change.

## Entity overview

```
User
 ├── Account            (optional — if multi-account support is added later)
 ├── Transaction ──→ Category
 ├── Budget      ──→ Category
 ├── SavingsGoal
 ├── Subscription
 ├── FinancialRule
 ├── IdempotencyKey
 └── Activity           (audit log)
```

## Tables

### User
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | TEXT | |
| email | TEXT (unique) | |
| passwordHash | TEXT | bcrypt hash, never plaintext |
| createdAt | TIMESTAMP | default now() |

### Category
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | TEXT | e.g. "Food", "Housing" |
| userId | UUID (FK → User, nullable) | null = system default category |

### Transaction
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| categoryId | UUID (FK → Category, nullable) | nullable = "Uncategorized" |
| type | ENUM('income','expense','transfer') | |
| amount | INTEGER | **paise, never a float** |
| description | TEXT | |
| paymentMethod | TEXT (nullable) | |
| date | DATE | transaction date (distinct from createdAt) |
| source | ENUM('manual','rule','ai') | how it was categorized |
| createdAt | TIMESTAMP | |

Indexes: `(userId, date)`, `(userId, categoryId)` — supports filtering and
report aggregation.

### Budget
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| categoryId | UUID (FK → Category) | |
| period | TEXT | e.g. "2026-10" (year-month) |
| limitAmount | INTEGER | paise |
| spent | INTEGER | paise — **updated only via atomic increment, never read-modify-write** |

Unique constraint: `(userId, categoryId, period)` — one budget per category
per month.

### SavingsGoal
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| name | TEXT | |
| targetAmount | INTEGER | paise |
| savedAmount | INTEGER | paise |
| deadline | DATE | |

Derived (not stored): `requiredMonthlyContribution =
ceil((targetAmount - savedAmount) / monthsUntil(deadline))` — computed in
`goalService.js` (the pure maths lives in `goalMath.js`), not stored, so it's
always current. Rounded up to a whole paisa so the goal is never left short. A
goal already at or above its target requires 0; a deadline in the past requires
the whole remainder, because there are no months left to spread it over.

### Subscription
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| name | TEXT | e.g. "Netflix" |
| amount | INTEGER | paise |
| frequency | ENUM('monthly','yearly') | |
| nextRenewalDate | DATE | |

### FinancialRule
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| priority | INTEGER | lower number = evaluated first |
| conditionType | ENUM('description_contains','amount_greater_than', ...) | |
| conditionValue | TEXT | e.g. "Swiggy" or "10000" (paise, as string) |
| actionCategoryId | UUID (FK → Category) | category to assign on match |
| isActive | BOOLEAN | default true |

### IdempotencyKey
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| key | TEXT | client-generated UUID |
| responseBody | JSONB | stored response to replay |
| statusCode | INTEGER | stored status to replay |
| createdAt | TIMESTAMP | for expiry cleanup |

Unique constraint: `(userId, key)`.

### Activity (audit log)
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User) | |
| action | TEXT | e.g. "transaction.created", "budget.updated" |
| entityId | UUID | id of the affected row |
| metadata | JSONB | optional extra context |
| createdAt | TIMESTAMP | |

## Operations requiring a Prisma `$transaction` (atomicity required)

1. **Create transaction + update budget.spent** — must happen together or
   not at all. Use:
   ```
   prisma.$transaction([
     prisma.transaction.create({ ... }),
     prisma.budget.update({
       where: { id: budgetId },
       data: { spent: { increment: amount } }
     })
   ])
   ```
2. **Idempotency check + operation + key storage** — the lookup, the
   operation, and storing the key should be consistent; if two identical
   requests race, the unique constraint on `(userId, key)` will cause the
   second insert to fail — catch that and return the first result.

## Migration workflow

```
cd server
npx prisma migrate dev --name <change-description>
```
Never hand-edit a migration file after it's been applied in any shared
environment — create a new migration instead.

## Deviations

(Log any schema deviation from this document here, with date and reason,
and update the table above in the same change.)
