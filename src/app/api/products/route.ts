// GET /api/products — list all products with optional filters
// POST /api/products — create new product (admin only)
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { Product } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const featured = searchParams.get('featured');
  const search = searchParams.get('search') || undefined;
  const sort = searchParams.get('sort') || 'createdAt';

  let products = db.products.findAll({
    category,
    featured: featured !== null ? featured === 'true' : undefined,
    search,
  });

  // Sorting
  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
  else products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return successResponse({ products, total: products.length });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  try {
    const body = await request.json();
    if (body.description !== undefined && typeof body.description !== 'string') {
      return errorResponse('description harus berupa teks', 400);
    }
    if (body.shortDescription !== undefined && typeof body.shortDescription !== 'string') {
      return errorResponse('shortDescription harus berupa teks', 400);
    }
    const product: Product = {
      id: generateId('prd'),
      ...body,
      description: body.description ?? '',
      shortDescription: body.shortDescription ?? '',
      createdAt: new Date().toISOString(),
    };
    db.products.create(product);
    return successResponse(product, 201);
  } catch {
    return errorResponse('Data produk tidak valid', 400);
  }
}
