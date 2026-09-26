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
  if (!authUser || authUser.role !== 'admin') return errorResponse('Unauthorized', 403);

  const { id } = await params;
  const body = await request.json();
  const updated = db.orders.update(id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return errorResponse('Order tidak ditemukan', 404);
  return successResponse(updated);
}
