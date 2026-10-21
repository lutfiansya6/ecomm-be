// GET /api/orders/[id]
// PUT /api/orders/[id] — update status (admin only)
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
  const order = db.orders.findById(id);
  if (!order) return errorResponse('Order tidak ditemukan', 404);

  // Customer can only see their own orders
  if (authUser.role !== 'admin' && order.userId !== authUser.userId) {
    return errorResponse('Forbidden', 403);
  }

  return successResponse(order);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const existingOrder = db.orders.findById(id);
  if (!existingOrder) return errorResponse('Order tidak ditemukan', 404);

  const isAdmin = authUser.role === 'admin';
  const isOwner = existingOrder.userId === authUser.userId;
  if (!isAdmin && !isOwner) {
    return errorResponse('Forbidden', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  // Non-admin can only cancel their own order
  if (!isAdmin && body.orderStatus !== 'cancelled') {
    return errorResponse('Forbidden: hanya admin yang dapat mengubah status selain pembatalan', 403);
  }

  const updated = db.orders.update(id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return errorResponse('Order tidak ditemukan', 404);
  return successResponse(updated);
}
