// GET /api/products/[id]
// PUT /api/products/[id] (admin)
// DELETE /api/products/[id] (admin)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.products.findById(id) || db.products.findBySlug(id);
  if (!product) return errorResponse('Produk tidak ditemukan', 404);
  return successResponse(product);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') return errorResponse('Unauthorized', 403);

  const { id } = await params;
  const body = await request.json();
  const updated = db.products.update(id, body);
  if (!updated) return errorResponse('Produk tidak ditemukan', 404);
  return successResponse(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') return errorResponse('Unauthorized', 403);

  const { id } = await params;
  const deleted = db.products.delete(id);
  if (!deleted) return errorResponse('Produk tidak ditemukan', 404);
  return successResponse({ deleted: true });
}
