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

  if (!isPublic) {
    return successResponse(items);
  }

  // Resolve childCategoryIds for public query
  const resolvedItems = items.map((item) => {
    if (!item.childCategoryIds || !Array.isArray(item.childCategoryIds)) {
      return item;
    }

    const resolvedChildren = item.childCategoryIds
      .map((catId) => {
        const cat = db.categories.findById(catId);
        if (!cat || !cat.active) return null;
        return {
          name: cat.name,
          slug: cat.slug,
        };
      })
      .filter(Boolean) as { name: string; slug: string }[];

    return {
      ...item,
      childCategoryIds: resolvedChildren,
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

  let target = '';
  if (type === 'category' || type === 'url') {
    if (!body.target || typeof body.target !== 'string' || !body.target.trim()) {
      return errorResponse('Target wajib diisi untuk tipe category dan url', 400);
    }
    target = body.target.trim();
  } else if (type === 'all') {
    target = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : '/products';
  } else if (type === 'new') {
    target = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : '/products?sort=newest';
  } else if (type === 'sale') {
    target = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : '/products?sale=1';
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

  const newItem: NavigationItem = {
    id: generateId('nav'),
    label,
    type,
    target,
    accent,
    order,
    active,
    system,
    childCategoryIds,
    createdAt: new Date().toISOString(),
  };

  const created = db.navigation.create(newItem);
  return successResponse(created, 201);
}
