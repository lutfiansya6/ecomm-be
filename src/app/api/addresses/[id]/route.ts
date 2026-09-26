// GET /api/addresses/[id]
// PUT /api/addresses/[id]
// DELETE /api/addresses/[id]
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const address = db.addresses.findById(id);
  if (!address) return errorResponse('Alamat tidak ditemukan', 404);

  if (address.userId !== authUser.userId && authUser.role !== 'admin') {
    return errorResponse('Akses ditolak', 403);
  }

  return successResponse(address);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const existing = db.addresses.findById(id);
  if (!existing) return errorResponse('Alamat tidak ditemukan', 404);

  if (existing.userId !== authUser.userId && authUser.role !== 'admin') {
    return errorResponse('Akses ditolak', 403);
  }

  try {
    const body = await request.json();
    const updated = db.addresses.update(id, body);
    if (!updated) return errorResponse('Gagal memperbarui alamat', 400);

    return successResponse(updated);
  } catch {
    return errorResponse('Gagal memperbarui alamat', 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const existing = db.addresses.findById(id);
  if (!existing) return errorResponse('Alamat tidak ditemukan', 404);

  if (existing.userId !== authUser.userId && authUser.role !== 'admin') {
    return errorResponse('Akses ditolak', 403);
  }

  const success = db.addresses.delete(id);
  if (!success) return errorResponse('Gagal menghapus alamat', 400);

  return successResponse({ deleted: true, message: 'Alamat berhasil dihapus' });
}