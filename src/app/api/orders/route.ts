// GET /api/orders — get all orders (admin) or user's own orders
// POST /api/orders — create new order
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, findColorVariant, resolveVariantPrice } from '@/lib/utils';
import type { Order, CartItem } from '@/types';

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

    // Resolve items against current product data: price = variant price, fallback product price
    const orderItems: CartItem[] = [];
    for (const raw of items as Partial<CartItem>[]) {
      const productId = raw.productId ?? raw.product?.id;
      const quantity = Number(raw.quantity);
      if (!productId) return errorResponse('Item order tidak valid', 400);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return errorResponse('Jumlah item harus berupa bilangan bulat lebih dari 0', 400);
      }
      const product = db.products.findById(productId);
      if (!product) return errorResponse('Produk tidak ditemukan', 404);
      const color = typeof raw.color === 'string' ? raw.color : '';
      const variant = findColorVariant(product.colorVariants, color);
      if (!variant) {
        return errorResponse(`Warna "${color || '-'}" tidak tersedia untuk produk ${product.name}`, 400);
      }
      let size = typeof raw.size === 'string' ? raw.size.trim() : '';
      if (!size && product.sizes?.length === 1) {
        size = product.sizes[0];
      }
      if (!size) {
        return errorResponse(`Ukuran wajib dipilih untuk produk "${product.name}"`, 400);
      }
      if (variant.sizeStock?.[size] === undefined) {
        return errorResponse(`Ukuran "${size}" tidak tersedia untuk produk "${product.name}" warna "${variant.name}"`, 400);
      }
      orderItems.push({
        productId: product.id,
        product,
        quantity,
        size,
        color: variant.name,
        price: resolveVariantPrice(product.price, variant),
      });
    }

    // Deduct stock per color and size combination (all-or-nothing); rejects the order if stock is insufficient
    const stockResult = db.products.deductStock(
      orderItems.map((i) => ({
        productId: i.productId,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
      }))
    );
    if (!stockResult.ok) return errorResponse(stockResult.error, 400);

    const subtotal = orderItems.reduce((sum, item) => sum + (item.price ?? item.product.price) * item.quantity, 0);
    const shipping = typeof body.shipping === 'number' ? body.shipping : (subtotal >= 5000000 ? 0 : 50000);
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + shipping + tax;

    const order: Order = {
      id: generateId('ord'),
      userId: authUser.userId,
      items: orderItems,
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
