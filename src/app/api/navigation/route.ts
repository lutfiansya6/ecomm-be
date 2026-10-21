// GET /api/navigation — list navigation items (public: active only, ?public=1 resolves children)
// POST /api/navigation — create navigation item (admin only)
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { NavigationItem, NavigationItemType } from '@/types';

const VALID_TYPES: NavigationItemType[] = ['all', 'new', 'sale', 'category', 'url'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isPublic = searchParams.get('public') === '1' || searchParams.get('public') === 'true';

  const items = db.navigation.findAll({ activeOnly: isPublic });
  const allProducts = db.products.findAll();
  const validProductIds = new Set(allProducts.map((p) => p.id));

  const mappedItems = items.map((item) => {
    const slug = item.slug || item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const productCount = (item.productIds || []).filter((id) => validProductIds.has(id)).length;
    return {
      ...item,
      slug,
      productCount,
      target: isPublic ? `/products?menu=${slug}` : (item.target || `/products?menu=${slug}`),
      label_en: item.label_en || item.label,
      label_id: item.label_id || item.label,
    };
  });

  if (!isPublic) {
    return successResponse(mappedItems);
  }

  // Resolve childCategoryIds for public query
  const resolvedItems = mappedItems.map((item) => {
    if (!item.childCategoryIds || !Array.isArray(item.childCategoryIds) || item.childCategoryIds.length === 0) {
      const copy = { ...item };
      delete copy.children;
      return copy;
    }

    const resolvedChildren = item.childCategoryIds
      .map((catId) => {
        const cat = db.categories.findById(catId);
        if (!cat || !cat.active) return null;
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          label_en: cat.label_en || cat.name,
          label_id: cat.label_id || cat.name,
        };
      })
      .filter(Boolean) as { id?: string; name: string; slug: string; label_en: string; label_id: string }[];

    if (resolvedChildren.length === 0) {
      const copy = { ...item };
      delete copy.children;
      return copy;
    }

    return {
      ...item,
      children: resolvedChildren,
    };
  });

  return successResponse(resolvedItems);
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
    return errorResponse('Data tidak valid', 400);
  }

  if (!body.label || typeof body.label !== 'string') {
    return errorResponse('Label wajib diisi', 400);
  }
  const label = body.label.trim();
  if (label.length < 2 || label.length > 50) {
    return errorResponse('Label harus antara 2 hingga 50 karakter', 400);
  }

  const existing = db.navigation.findByLabel(label);
  if (existing) {
    return errorResponse('Label menu navigasi sudah digunakan', 400);
  }

  if (!body.type || typeof body.type !== 'string' || !VALID_TYPES.includes(body.type as NavigationItemType)) {
    return errorResponse(
      `Tipe menu navigasi harus salah satu dari: ${VALID_TYPES.join(', ')}`,
      400
    );
  }
  const type = body.type as NavigationItemType;

  let slug =
    typeof body.slug === 'string' && body.slug.trim()
      ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  if (!slug) {
    slug = `menu-${Date.now()}`;
  }

  const existingSlug = db.navigation.findBySlug(slug);
  if (existingSlug) {
    return errorResponse('Slug menu navigasi sudah digunakan', 400);
  }

  let productIds: string[] = [];
  if (Array.isArray(body.productIds)) {
    const rawIds = body.productIds.map(String).map((s) => s.trim()).filter(Boolean);
    const uniqueIds = Array.from(new Set(rawIds));
    const allProducts = db.products.findAll();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    for (const pid of uniqueIds) {
      if (!productMap.has(pid)) {
        return errorResponse(`Produk dengan ID "${pid}" tidak ditemukan`, 400);
      }
    }
    productIds = uniqueIds;
  }

  let target = '';
  if (type === 'category' || type === 'url') {
    if (typeof body.target === 'string' && body.target.trim()) {
      target = body.target.trim();
    } else {
      target = `/products?menu=${slug}`;
    }
  } else {
    target = `/products?menu=${slug}`;
  }

  const accent = typeof body.accent === 'boolean' ? body.accent : type === 'sale';
  const active = typeof body.active === 'boolean' ? body.active : true;
  const system = false; // User-created items cannot be system items

  let childCategoryIds: string[] | undefined;
  if (Array.isArray(body.childCategoryIds)) {
    childCategoryIds = body.childCategoryIds.map((id) => String(id).trim()).filter(Boolean);
  }

  let order: number;
  if (typeof body.order === 'number' && Number.isInteger(body.order) && body.order >= 0) {
    order = body.order;
  } else {
    const all = db.navigation.findAll();
    order = all.length > 0 ? Math.max(...all.map((i) => i.order)) + 1 : 1;
  }

  const label_en =
    typeof body.label_en === 'string' && body.label_en.trim()
      ? body.label_en.trim()
      : label;
  const label_id =
    typeof body.label_id === 'string' && body.label_id.trim()
      ? body.label_id.trim()
      : label;

  const rawGender = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : '';
  const validGenders = ['women', 'men', 'unisex'];
  const gender = validGenders.includes(rawGender) ? (rawGender as 'women' | 'men' | 'unisex') : undefined;

  const newItem: NavigationItem = {
    id: generateId('nav'),
    label,
    slug,
    type,
    target,
    accent,
    order,
    active,
    system,
    productIds,
    gender,
    childCategoryIds,
    label_en,
    label_id,
    createdAt: new Date().toISOString(),
  };

  const created = db.navigation.create(newItem);
  return successResponse({
    ...created,
    productCount: productIds.length,
  }, 201);
}
