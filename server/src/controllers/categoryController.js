import * as categoryService from '../services/categoryService.js';

export async function list(req, res) {
  const categories = await categoryService.listCategoriesForUser(req.user.id);
  res.json({ categories });
}
