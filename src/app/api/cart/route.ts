// GET /api/cart — get cart for logged-in user
// POST /api/cart — add/update item in cart
// DELETE /api/cart — clear cart
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { Cart, CartItem } from '@/types';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const cart = db.carts.findByUser(authUser.userId) || {
    userId: authUser.userId,
    items: [],
    updatedAt: new Date().toISOString(),
  };

  return successResponse(cart);
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const body = await request.json();
  const { productId, quantity, size, color, action } = body;

  const product = db.products.findById(productId);
  if (!product) return errorResponse('Produk tidak ditemukan', 404);

  const existingCart = db.carts.findByUser(authUser.userId) || {
    userId: authUser.userId,
    items: [] as CartItem[],
    updatedAt: new Date().toISOString(),
  };

  const items = [...existingCart.items];
  const existingIdx = items.findIndex(
    (i) => i.productId === productId && i.size === size && i.color === color
  );

  if (action === 'remove') {
    if (existingIdx !== -1) items.splice(existingIdx, 1);
  } else {
    if (existingIdx !== -1) {
      if (quantity <= 0) {
        items.splice(existingIdx, 1);
      } else {
        items[existingIdx].quantity = quantity;
      }
    } else if (quantity > 0) {
      items.push({
        productId,
        product,
        quantity,
        size: size || product.sizes[0],
        color: color || product.colors[0],
      });
    }
  }

  const updatedCart: Cart = {
    userId: authUser.userId,
    items,
    updatedAt: new Date().toISOString(),
  };

  db.carts.upsert(updatedCart);
  return successResponse(updatedCart);
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);
  db.carts.clear(authUser.userId);
  return successResponse({ cleared: true });
}
