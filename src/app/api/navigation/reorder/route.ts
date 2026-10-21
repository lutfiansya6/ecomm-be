// PUT /api/navigation/reorder (admin) — save new display order
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function PUT(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  let ids: string[] = [];
  if (Array.isArray(body)) {
    ids = body as string[];
  } else if (body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).ids)) {
    ids = (body as { ids: string[] }).ids;
  } else {
    return errorResponse('Array id urutan navigasi (ids) wajib disertakan', 400);
  }

  if (ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id.trim())) {
    return errorResponse('Daftar ID navigasi tidak valid', 400);
  }

  const updatedItems = db.navigation.reorder(ids.map((id) => id.trim()));
  return successResponse(updatedItems);
}
