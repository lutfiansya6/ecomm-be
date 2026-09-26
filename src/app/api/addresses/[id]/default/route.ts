// PATCH /api/addresses/[id]/default
// POST /api/addresses/[id]/default
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

async function handleSetDefault(
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

  const updated = db.addresses.setDefault(authUser.userId, id);
  if (!updated) return errorResponse('Gagal mengubah alamat utama', 400);

  return successResponse(updated, 200);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleSetDefault(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleSetDefault(request, context);
}