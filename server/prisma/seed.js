import 'dotenv/config';

import prisma from '../src/lib/prismaClient.js';

/**
 * Seeds the system categories every new user starts with.
 *
 * Run manually: `npx prisma db seed` (wired up in package.json), or
 * `node prisma/seed.js`.
 *
 * A system category has `userId: null`, which is what
 * `categoryService.listCategoriesForUser` recognises as "available to
 * everyone". User-created categories carry a userId instead and are inserted
 * through the app, never by this script.
 *
 * Idempotent: re-running updates the name of a matching row rather than
 * inserting a duplicate, so it is safe to run against a database that already
 * has them. `name` is not unique in the schema (two users may both have a
 * category called "Travel"), so the match is scoped to userId = null, which is
 * the only set of rows this script owns.
 */

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining' },
  { name: 'Groceries' },
  { name: 'Transport' },
  { name: 'Housing' },
  { name: 'Utilities' },
  { name: 'Health' },
  { name: 'Entertainment' },
  { name: 'Shopping' },
  { name: 'Salary' },
  { name: 'Other' },
];

const existing = await prisma.category.findMany({
  where: { userId: null },
  select: { id: true, name: true },
});

const byName = new Map(existing.map((category) => [category.name, category]));

let created = 0;
let unchanged = 0;

for (const category of DEFAULT_CATEGORIES) {
  const match = byName.get(category.name);

  if (!match) {
    await prisma.category.create({ data: { name: category.name } });
    created += 1;
  } else {
    unchanged += 1;
  }
}

/*
 * Anything already there that is not in the list is left exactly as it is.
 * Deleting a category sets Transaction.categoryId to NULL (the schema's
 * onDelete: SetNull), which would silently turn someone's filed transactions
 * into uncategorised ones because a seed file disagreed with a rename. Renames
 * and removals are a deliberate, manual act.
 */
const orphaned = existing.filter(
  (category) => !DEFAULT_CATEGORIES.some((c) => c.name === category.name),
);

console.log(
  `Seeded categories: ${created} created, ${unchanged} already present.`,
);

if (orphaned.length > 0) {
  console.log(
    `Left untouched (not in the default list): ${orphaned.map((c) => c.name).join(', ')}`,
  );
}

await prisma.$disconnect();
