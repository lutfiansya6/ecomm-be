// GET /api/orders — get all orders (admin) or user's own orders
// POST /api/orders — create new order
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { Order } from '@/types';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const orders =
    authUser.role === 'admin'
      ? db.orders.findAll()
      : db.orders.findByUser(authUser.userId);

  return successResponse({ orders, total: orders.length });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const { items, address, paymentMethod, notes, courier, courierService, courierEtd } = body;

    if (!items?.length) return errorResponse('Keranjang kosong', 400);
    if (!address) return errorResponse('Alamat pengiriman wajib diisi', 400);
    if (!paymentMethod) return errorResponse('Metode pembayaran wajib dipilih', 400);

    const subtotal = items.reduce(
      (sum: number, item: { price?: number; product?: { price: number }; quantity: number }) =>
        sum + (item.price ?? item.product?.price ?? 0) * item.quantity,
      0
    );
    const shipping = typeof body.shipping === 'number' ? body.shipping : (subtotal >= 5000000 ? 0 : 50000);
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + shipping + tax;

    const order: Order = {
      id: generateId('ord'),
      userId: authUser.userId,
      items,
      address,
      courier: courier || undefined,
      courierService: courierService || undefined,
      courierEtd: courierEtd || undefined,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      orderStatus: 'pending',
      subtotal,
      shipping,
      tax,
      total,
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.orders.create(order);
    // Clear cart after ordering
    db.carts.clear(authUser.userId);

    return successResponse(order, 201);
  } catch {
    return errorResponse('Gagal membuat order', 400);
  }
}
