// GET /api/products/[id]/menus — list menus that contain this product
// PUT /api/products/[id]/menus — set menus for this product (admin only)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.products.findById(id);
  if (!product) {
    return errorResponse('Produk tidak ditemukan', 404);
  }

  const allNav = db.navigation.findAll();
  const containingMenus = allNav
    .filter((nav) => (nav.productIds || []).includes(id))
    .map((nav) => ({
      id: nav.id,
      label: nav.label,
      slug: nav.slug,
      order: nav.order,
    }));

  return successResponse({
    productId: id,
    menuIds: containingMenus.map((m) => m.id),
    menus: containingMenus,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const product = db.products.findById(id);
  if (!product) {
    return errorResponse('Produk tidak ditemukan', 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  if (!Array.isArray(body.menuIds)) {
    return errorResponse('menuIds harus berupa array string', 400);
  }

  const menuIds = Array.from(
    new Set(body.menuIds.map(String).map((s) => s.trim()).filter(Boolean))
  );

  const allNav = db.navigation.findAll();
  const navMap = new Map(allNav.map((n) => [n.id, n]));

  for (const mid of menuIds) {
    if (!navMap.has(mid)) {
      return errorResponse(`Item navigasi dengan ID "${mid}" tidak ditemukan`, 400);
    }
  }

  db.navigation.setProductMenus(id, menuIds);

  const updatedMenus = db.navigation
    .findAll()
    .filter((nav) => (nav.productIds || []).includes(id))
    .map((nav) => ({
      id: nav.id,
      label: nav.label,
      slug: nav.slug,
      order: nav.order,
    }));

  return successResponse({
    productId: id,
    menuIds: updatedMenus.map((m) => m.id),
    menus: updatedMenus,
  });
}
