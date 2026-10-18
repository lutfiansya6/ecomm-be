// PATCH /api/reviews/[id] — set status published/hidden (admin only)
// DELETE /api/reviews/[id] — delete review (admin only)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);
  if (authUser.role !== 'admin') return errorResponse('Forbidden: Admin only', 403);

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Data tidak valid', 400);
  }
  if (body.status !== 'published' && body.status !== 'hidden') {
    return errorResponse('Status harus "published" atau "hidden"', 400);
  }

  const { id } = await params;
  const updated = db.reviews.update(id, { status: body.status });
  if (!updated) return errorResponse('Ulasan tidak ditemukan', 404);
  return successResponse(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);
  if (authUser.role !== 'admin') return errorResponse('Forbidden: Admin only', 403);

  const { id } = await params;
  if (!db.reviews.delete(id)) return errorResponse('Ulasan tidak ditemukan', 404);
  return successResponse({ deleted: true });
}
