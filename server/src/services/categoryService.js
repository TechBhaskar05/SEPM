import prisma from '../lib/prismaClient.js';

/**
 * Categories a user can pick from.
 *
 * A category is either the user's own (userId = their id) or a system default
 * (userId = null, see prisma/seed.js). Both are offered in the same list,
 * because from a user's point of view "Food" is just the food category whether
 * this app shipped it or they typed it.
 *
 * Read-only for now. Creating and editing categories is not in any increment;
 * it arrives with the rule engine, which is the first feature that needs a
 * category the user made rather than one they picked.
 */

/** The shape the API returns. `system` is derived, not a column. */
function toCategoryView(category) {
  return {
    id: category.id,
    name: category.name,
    system: category.userId === null,
  };
}

/**
 * Every category available to one user: theirs, plus the system defaults.
 *
 * Sorted by name here rather than in the database so a system category and a
 * personal one interleave in one alphabetical list - ordering by
 * (userId, name) would put every personal category before every default one,
 * which reads as two separate lists wearing one dropdown.
 */
export async function listCategoriesForUser(userId) {
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    select: { id: true, name: true, userId: true },
  });

  return categories
    .map(toCategoryView)
    .sort((a, b) => a.name.localeCompare(b.name));
}
