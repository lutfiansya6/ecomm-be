// PUT /api/navigation/[id] (admin) — update navigation item
// DELETE /api/navigation/[id] (admin) — delete navigation item (reject if system: true)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { NavigationItem, NavigationItemType } from '@/types';

const VALID_TYPES: NavigationItemType[] = ['all', 'new', 'sale', 'category', 'url'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const existing = db.navigation.findById(id);
  if (!existing) {
    return errorResponse('Item navigasi tidak ditemukan', 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  // Aturan: Untuk system:true, type dan system tidak boleh diubah
  if (existing.system) {
    if (body.type !== undefined && body.type !== existing.type) {
      return errorResponse('Tipe item navigasi sistem tidak boleh diubah', 400);
    }
    if (body.system !== undefined && body.system !== true) {
      return errorResponse('Status sistem tidak boleh diubah', 400);
    }
  }

  const updates: Partial<NavigationItem> = {};

  if (body.label !== undefined) {
    if (typeof body.label !== 'string') {
      return errorResponse('Label harus berupa teks', 400);
    }
    const label = body.label.trim();
    if (label.length < 2 || label.length > 50) {
      return errorResponse('Label harus antara 2 hingga 50 karakter', 400);
    }
    const dup = db.navigation
      .findAll()
      .find((item) => item.id !== existing.id && item.label.toLowerCase() === label.toLowerCase());
    if (dup) {
      return errorResponse('Label menu navigasi sudah digunakan', 400);
    }
    updates.label = label;
  }

  if (body.type !== undefined && !existing.system) {
    if (typeof body.type !== 'string' || !VALID_TYPES.includes(body.type as NavigationItemType)) {
      return errorResponse(
        `Tipe menu navigasi harus salah satu dari: ${VALID_TYPES.join(', ')}`,
        400
      );
    }
    updates.type = body.type as NavigationItemType;
  }

  const effectiveType = updates.type || existing.type;
  if (body.target !== undefined) {
    if (typeof body.target !== 'string') {
      return errorResponse('Target harus berupa teks', 400);
    }
    const target = body.target.trim();
    if ((effectiveType === 'category' || effectiveType === 'url') && !target) {
      return errorResponse('Target wajib diisi untuk tipe category dan url', 400);
    }
    updates.target = target;
  }

  if (body.accent !== undefined) {
    if (typeof body.accent !== 'boolean') {
      return errorResponse('Accent harus berupa boolean', 400);
    }
    updates.accent = body.accent;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return errorResponse('Active harus berupa boolean', 400);
    }
    updates.active = body.active;
  }

  if (body.order !== undefined) {
    if (typeof body.order !== 'number' || !Number.isInteger(body.order) || body.order < 0) {
      return errorResponse('Order harus berupa bilangan bulat >= 0', 400);
    }
    updates.order = body.order;
  }

  if (body.childCategoryIds !== undefined) {
    if (!Array.isArray(body.childCategoryIds)) {
      return errorResponse('childCategoryIds harus berupa array string', 400);
    }
    updates.childCategoryIds = body.childCategoryIds.map((cid) => String(cid).trim()).filter(Boolean);
  }

  if (body.label_en !== undefined) {
    if (typeof body.label_en !== 'string') {
      return errorResponse('label_en harus berupa teks', 400);
    }
    const val = body.label_en.trim();
    updates.label_en = val || updates.label || existing.label;
  }

  if (body.label_id !== undefined) {
    if (typeof body.label_id !== 'string') {
      return errorResponse('label_id harus berupa teks', 400);
    }
    const val = body.label_id.trim();
    updates.label_id = val || updates.label || existing.label;
  }

  if (body.gender !== undefined) {
    const rawGender = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : '';
    const validGenders = ['women', 'men', 'unisex'];
    if (rawGender && !validGenders.includes(rawGender)) {
      return errorResponse('gender harus salah satu dari: women, men, unisex', 400);
    }
    updates.gender = (rawGender as 'women' | 'men' | 'unisex') || undefined;
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || !body.slug.trim()) {
      return errorResponse('slug harus berupa teks', 400);
    }
    const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const dup = db.navigation.findAll().find((item) => item.id !== existing.id && item.slug.toLowerCase() === slug);
    if (dup) {
      return errorResponse('Slug menu navigasi sudah digunakan', 400);
    }
    updates.slug = slug;
  }

  if (body.productIds !== undefined) {
    if (!Array.isArray(body.productIds)) {
      return errorResponse('productIds harus berupa array string', 400);
    }
    const rawIds = body.productIds.map(String).map((s) => s.trim()).filter(Boolean);
    const uniqueIds = Array.from(new Set(rawIds));
    const allProducts = db.products.findAll();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    for (const pid of uniqueIds) {
      if (!productMap.has(pid)) {
        return errorResponse(`Produk dengan ID "${pid}" tidak ditemukan`, 400);
      }
    }
    updates.productIds = uniqueIds;
  }

  const updated = db.navigation.update(existing.id, updates);
  if (!updated) {
    return errorResponse('Gagal memperbarui item navigasi', 500);
  }

  const allProducts = db.products.findAll();
  const validProductIds = new Set(allProducts.map((p) => p.id));
  const productCount = (updated.productIds || []).filter((pid) => validProductIds.has(pid)).length;

  return successResponse({
    ...updated,
    productCount,
    label_en: updated.label_en || updated.label,
    label_id: updated.label_id || updated.label,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const existing = db.navigation.findById(id);
  if (!existing) {
    return errorResponse('Item navigasi tidak ditemukan', 404);
  }

  // Aturan: Tolak (400) jika system: true
  if (existing.system) {
    return errorResponse('Item navigasi sistem tidak boleh dihapus', 400);
  }

  db.navigation.delete(existing.id);
  return successResponse({ deleted: true });
}
