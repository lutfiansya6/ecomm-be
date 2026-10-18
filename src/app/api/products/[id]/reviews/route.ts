// GET /api/products/[id]/reviews — published reviews + summary
import { db } from '@/lib/store';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.products.findById(id) || db.products.findBySlug(id);
  if (!product) return errorResponse('Produk tidak ditemukan', 404);

  const reviews = [...db.reviews.findPublishedByProduct(product.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? 0
      : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10;

  return successResponse({ reviews, summary: { averageRating, reviewCount } });
}
