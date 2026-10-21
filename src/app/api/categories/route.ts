// GET /api/categories — list sorted categories (public: active only, admin: ?all=true)
// POST /api/categories — create new category (admin only)
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  isValidCategorySlug,
  getUniqueCategorySlug,
} from '@/lib/utils';
import type { Category } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const allParam = searchParams.get('all');

  let activeOnly = true;
  if (allParam === 'true') {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return errorResponse('Unauthorized: Admin only', 403);
    }
    activeOnly = false;
  }

  const categories = db.categories.findAll({ activeOnly });
  const allProducts = db.products.findAll();

  const data = categories.map((cat) => ({
    ...cat,
    productCount: allProducts.filter(
      (p) => p.categoryId === cat.id || p.category === cat.slug
    ).length,
  }));

  return successResponse(data);
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data kategori tidak valid', 400);
  }

  if (!body.name || typeof body.name !== 'string') {
    return errorResponse('Nama kategori wajib diisi', 400);
  }

  const name = body.name.trim();
  if (name.length < 2 || name.length > 40) {
    return errorResponse('Nama kategori harus antara 2 hingga 40 karakter', 400);
  }

  const existingName = db.categories.findByName(name);
  if (existingName) {
    return errorResponse('Nama kategori sudah digunakan', 400);
  }

  let slug: string;
  if (body.slug !== undefined && typeof body.slug === 'string' && body.slug.trim()) {
    const customSlug = body.slug.trim().toLowerCase();
    if (!isValidCategorySlug(customSlug)) {
      return errorResponse(
        'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung',
        400
      );
    }
    if (db.categories.findBySlug(customSlug)) {
      return errorResponse('Slug sudah digunakan', 400);
    }
    slug = customSlug;
  } else {
    const allSlugs = db.categories.findAll().map((c) => c.slug);
    slug = getUniqueCategorySlug(name, allSlugs);
  }

  const active = typeof body.active === 'boolean' ? body.active : true;

  let order: number;
  if (typeof body.order === 'number' && Number.isInteger(body.order) && body.order >= 0) {
    order = body.order;
  } else {
    const all = db.categories.findAll();
    order = all.length > 0 ? Math.max(...all.map((c) => c.order)) + 1 : 1;
  }

  const newCategory: Category = {
    id: generateId('cat'),
    name,
    slug,
    order,
    active,
    createdAt: new Date().toISOString(),
  };

  const created = db.categories.create(newCategory);
  return successResponse(created, 201);
}
