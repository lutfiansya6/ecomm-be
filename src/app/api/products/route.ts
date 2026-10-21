// GET /api/products — list all products with optional filters
// POST /api/products — create new product (admin only)
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  validateColorVariants,
  normalizeColorVariants,
  sumVariantStock,
  guessColorHex,
} from '@/lib/utils';
import type { Product, ColorVariant } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const audit = searchParams.get('audit');

  if (audit === 'price_pattern' || audit === 'true') {
    const all = db.products.findAll();
    const audited = all
      .filter((p) => {
        const priceMatch = p.price % 10000 === 1000;
        const compareMatch = Boolean(p.comparePrice && p.comparePrice % 10000 === 1000);
        return priceMatch || compareMatch;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        priceMatches: p.price % 10000 === 1000,
        comparePrice: p.comparePrice ?? null,
        comparePriceMatches: Boolean(p.comparePrice && p.comparePrice % 10000 === 1000),
      }));

    return successResponse({ total: audited.length, products: audited });
  }

  const category = searchParams.get('category') || undefined;
  const featured = searchParams.get('featured');
  const search = searchParams.get('search') || undefined;
  const sortParam = searchParams.get('sort');
  const saleParam = searchParams.get('sale');
  const sale = saleParam !== null ? (saleParam === '1' || saleParam === 'true') : undefined;
  const gender = searchParams.get('gender') || undefined;
  const collectionParam = searchParams.get('collection');
  const collection = collectionParam !== null ? (collectionParam === '1' || collectionParam === 'true') : undefined;
  const section = searchParams.get('section') || undefined;
  const menu = searchParams.get('menu') || undefined;

  const products = db.products.findAll({
    category,
    featured: featured !== null ? featured === 'true' : undefined,
    search,
    sale,
    gender,
    collection,
    section,
    menu,
  });

  // Sorting: jika sort tidak dikirim dan ada query menu, pertahankan urutan menu
  const sort = sortParam || (!menu ? 'createdAt' : undefined);
  if (sort) {
    if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
    else if (sort === 'newest' || sort === 'createdAt') {
      products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  return successResponse({ products, total: products.length });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data produk tidak valid', 400);
  }

  // Catatan: field stock di tingkat produk dan warna diabaikan jika dikirim dari client,
  // dan selalu dihitung ulang dari sizeStock sebelum disimpan.

  // Validasi harga jual: bilangan bulat rupiah > 0 tanpa pembulatan
  if (typeof body.price !== 'number' || !Number.isInteger(body.price) || body.price <= 0) {
    return errorResponse('Harga jual harus berupa bilangan bulat rupiah lebih dari 0', 400);
  }

  // Validasi harga coret jika diisi: bilangan bulat rupiah > 0 dan harus > harga jual
  let comparePrice: number | undefined;
  if (body.comparePrice !== undefined && body.comparePrice !== null && body.comparePrice !== '') {
    if (typeof body.comparePrice !== 'number' || !Number.isInteger(body.comparePrice) || body.comparePrice <= 0) {
      return errorResponse('Harga coret harus berupa bilangan bulat rupiah lebih dari 0', 400);
    }
    if (body.comparePrice <= body.price) {
      return errorResponse('Harga coret harus lebih besar dari harga jual', 400);
    }
    comparePrice = body.comparePrice;
  }

  if (body.description !== undefined && typeof body.description !== 'string') {
    return errorResponse('description harus berupa teks', 400);
  }
  if (body.shortDescription !== undefined && typeof body.shortDescription !== 'string') {
    return errorResponse('shortDescription harus berupa teks', 400);
  }

  // Resolusi daftar ukuran produk
  let sizes: string[] = [];
  if (Array.isArray(body.sizes) && body.sizes.length > 0) {
    sizes = (body.sizes as string[]).map((s) => String(s).trim()).filter(Boolean);
  }
  if (sizes.length === 0) {
    sizes = ['One Size'];
  }

  let colorVariants = body.colorVariants as ColorVariant[] | undefined;
  let colors = body.colors as string[] | undefined;
  let images = body.images as string[] | undefined;

  if (colorVariants !== undefined) {
    const validation = validateColorVariants(colorVariants, sizes);
    if (!validation.valid) {
      return errorResponse(validation.error || 'Data colorVariants tidak valid', 400);
    }
    colorVariants = normalizeColorVariants(colorVariants, sizes);
    if (!Array.isArray(colors) || colors.length === 0) {
      colors = colorVariants.map((v) => v.name);
    }
    if (!Array.isArray(images) || images.length === 0) {
      images = Array.from(new Set(colorVariants.flatMap((v) => v.images)));
    }
  } else if (Array.isArray(colors) && colors.length > 0) {
    const fallbackImages = Array.isArray(images) ? images : [];
    colorVariants = colors.map((c) => {
      const initialSizeStock: Record<string, number> = {};
      for (const sz of sizes) {
        initialSizeStock[sz] = 0;
      }
      return {
        name: c,
        hex: guessColorHex(c),
        images: [...fallbackImages],
        sizeStock: initialSizeStock,
        stock: 0,
      };
    });
  } else {
    colorVariants = [];
    colors = colors ?? [];
    images = images ?? [];
  }

  const categoryInput = String(body.categoryId || body.category || '').trim();
  if (!categoryInput) {
    return errorResponse('Kategori wajib diisi', 400);
  }
  const matchedCategory = db.categories.findById(categoryInput) || db.categories.findBySlug(categoryInput);
  if (!matchedCategory) {
    return errorResponse('Kategori tidak valid atau tidak ditemukan', 400);
  }

  const rawGender = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : '';
  const validGenders = ['women', 'men', 'unisex'];
  const gender = validGenders.includes(rawGender) ? (rawGender as 'women' | 'men' | 'unisex') : 'unisex';

  const tags = Array.isArray(body.tags) ? (body.tags as string[]) : [];
  let collection: boolean;
  if (typeof body.collection === 'boolean') {
    collection = body.collection;
  } else {
    const collectionTags = ['luxury', 'bestseller', 'evening', 'chain', 'wool', 'silk', 'logo'];
    collection = Boolean(body.featured) || tags.some((t) => collectionTags.includes(t));
  }

  // Derived stock from colorVariants
  const variantStockTotal = sumVariantStock(colorVariants) ?? 0;

  const product: Product = {
    id: generateId('prd'),
    name: String(body.name || ''),
    slug: String(body.slug || ''),
    description: typeof body.description === 'string' ? body.description : '',
    shortDescription: typeof body.shortDescription === 'string' ? body.shortDescription : '',
    price: body.price,
    comparePrice,
    categoryId: matchedCategory.id,
    category: matchedCategory.slug,
    gender,
    collection,
    featured: Boolean(body.featured),
    rating: typeof body.rating === 'number' ? body.rating : 0,
    reviewCount: typeof body.reviewCount === 'number' ? body.reviewCount : 0,
    tags,
    sizes,
    colors: colors ?? [],
    images: images ?? [],
    colorVariants,
    stock: variantStockTotal,
    createdAt: new Date().toISOString(),
  };

  const created = db.products.create(product);

  if (Array.isArray(body.menuIds) && body.menuIds.length > 0) {
    const validMenuIds = body.menuIds.map(String).filter((mid) => Boolean(db.navigation.findById(mid)));
    if (validMenuIds.length > 0) {
      db.navigation.setProductMenus(created.id, validMenuIds);
    }
  }

  return successResponse(created, 201);
}

