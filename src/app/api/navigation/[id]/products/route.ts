// GET /api/navigation/[id]/products — list products for navigation item in productIds order
// PUT /api/navigation/[id]/products — update productIds for navigation item (admin only)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = db.navigation.findById(id) || db.navigation.findBySlug(id);
  if (!item) {
    return errorResponse('Item navigasi tidak ditemukan', 404);
  }

  const allProducts = db.products.findAll();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const categories = db.categories.findAll();
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const products = (item.productIds || [])
    .map((pid) => productMap.get(pid))
    .filter(Boolean)
    .map((p) => {
      const prod = p!;
      const totalStock = prod.stock ?? 0;
      const status = totalStock > 0 ? 'active' : 'out_of_stock';
      const thumbnail = prod.images && prod.images.length > 0 ? prod.images[0] : '';
      const categoryName = categoryMap.get(prod.categoryId) || prod.category;

      return {
        id: prod.id,
        name: prod.name,
        nama: prod.name,
        slug: prod.slug,
        sku: prod.id,
        price: prod.price,
        harga: prod.price,
        comparePrice: prod.comparePrice ?? null,
        thumbnail,
        image: thumbnail,
        stock: totalStock,
        stok: totalStock,
        totalStock,
        status,
        gender: prod.gender,
        category: prod.category,
        categoryId: prod.categoryId,
        kategori: categoryName,
        categoryName,
      };
    });

  return successResponse({
    navigation: {
      id: item.id,
      label: item.label,
      slug: item.slug,
      productCount: products.length,
    },
    products,
    total: products.length,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const item = db.navigation.findById(id);
  if (!item) {
    return errorResponse('Item navigasi tidak ditemukan', 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  if (!Array.isArray(body.productIds)) {
    return errorResponse('productIds harus berupa array string', 400);
  }

  const rawIds = body.productIds.map(String).map((s) => s.trim()).filter(Boolean);
  const uniqueIds = Array.from(new Set(rawIds));

  // Validasi id produk ada di database
  const allProducts = db.products.findAll();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  for (const pid of uniqueIds) {
    if (!productMap.has(pid)) {
      return errorResponse(`Produk dengan ID "${pid}" tidak ditemukan`, 400);
    }
  }

  const updated = db.navigation.update(item.id, { productIds: uniqueIds });
  if (!updated) {
    return errorResponse('Gagal memperbarui item navigasi', 500);
  }

  return successResponse({
    ...updated,
    productCount: uniqueIds.length,
  });
}
