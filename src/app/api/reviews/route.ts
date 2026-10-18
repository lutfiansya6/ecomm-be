// GET /api/reviews — all reviews incl. hidden (admin only)
// POST /api/reviews — create review (login required)
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, sanitizeText } from '@/lib/utils';
import type { Review } from '@/types';

const MAX_COMMENT_LENGTH = 500;

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);
  if (authUser.role !== 'admin') return errorResponse('Forbidden: Admin only', 403);

  const reviews = [...db.reviews.findAll()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return successResponse(reviews);
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Data ulasan tidak valid', 400);
  }

  const { productId, orderId, rating, comment } = body;

  if (typeof productId !== 'string' || !productId || typeof orderId !== 'string' || !orderId) {
    return errorResponse('productId dan orderId wajib diisi', 400);
  }
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse('Rating wajib berupa angka bulat 1-5', 400);
  }
  if (comment !== undefined && typeof comment !== 'string') {
    return errorResponse('Komentar harus berupa teks', 400);
  }
  const rawComment = (comment as string | undefined) ?? '';
  if (rawComment.length > MAX_COMMENT_LENGTH) {
    return errorResponse(`Komentar maksimal ${MAX_COMMENT_LENGTH} karakter`, 400);
  }

  const order = db.orders.findById(orderId);
  if (!order || order.userId !== authUser.userId) {
    return errorResponse('Order tidak ditemukan', 404);
  }
  if (order.orderStatus !== 'delivered') {
    return errorResponse('Ulasan hanya dapat diberikan untuk order yang sudah diterima', 400);
  }
  if (!order.items.some((item) => item.productId === productId)) {
    return errorResponse('Produk tidak ada dalam order ini', 400);
  }
  if (db.reviews.exists(authUser.userId, orderId, productId)) {
    return errorResponse('Anda sudah mengulas produk ini pada order ini', 409);
  }

  const review: Review = {
    id: generateId('rev'),
    productId,
    orderId,
    userId: authUser.userId,
    userName: authUser.name,
    rating,
    comment: sanitizeText(rawComment),
    status: 'published',
    createdAt: new Date().toISOString(),
  };
  db.reviews.create(review);
  return successResponse(review, 201);
}
