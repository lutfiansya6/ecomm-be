// GET /api/products/[id]
// PUT /api/products/[id] (admin)
// DELETE /api/products/[id] (admin)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  validateColorVariants,
  normalizeColorVariants,
  syncVariantsWithSizes,
  sumVariantStock,
  findColorVariant,
  guessColorHex,
} from '@/lib/utils';
import type { ColorVariant, Product } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.products.findById(id) || db.products.findBySlug(id);
  if (!product) return errorResponse('Produk tidak ditemukan', 404);
  return successResponse(product);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') return errorResponse('Unauthorized', 403);

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data produk tidak valid', 400);
  }

  const existing = db.products.findById(id) || db.products.findBySlug(id);
  if (!existing) return errorResponse('Produk tidak ditemukan', 404);

  // Catatan: field stock di tingkat produk dan warna diabaikan jika dikirim dari client,
  // dan selalu dihitung ulang dari sizeStock sebelum disimpan.

  // Validasi harga jual jika diupdate
  if (body.price !== undefined) {
    if (typeof body.price !== 'number' || !Number.isInteger(body.price) || body.price <= 0) {
      return errorResponse('Harga jual harus berupa bilangan bulat rupiah lebih dari 0', 400);
    }
  }

  // Validasi harga coret jika diupdate atau dibersihkan
  const effectivePrice = body.price !== undefined ? (body.price as number) : existing.price;
  if (body.comparePrice !== undefined && body.comparePrice !== null && body.comparePrice !== '') {
    if (typeof body.comparePrice !== 'number' || !Number.isInteger(body.comparePrice) || body.comparePrice <= 0) {
      return errorResponse('Harga coret harus berupa bilangan bulat rupiah lebih dari 0', 400);
    }
    if (body.comparePrice <= effectivePrice) {
      return errorResponse('Harga coret harus lebih besar dari harga jual', 400);
    }
  } else if (body.comparePrice === null || body.comparePrice === '') {
    body.comparePrice = undefined;
  } else if (body.price !== undefined && existing.comparePrice) {
    if (existing.comparePrice <= (body.price as number)) {
      return errorResponse('Harga coret yang sudah ada tidak boleh kurang dari atau sama dengan harga jual baru', 400);
    }
  }

  if (body.description !== undefined && typeof body.description !== 'string') {
    return errorResponse('description harus berupa teks', 400);
  }
  if (body.shortDescription !== undefined && typeof body.shortDescription !== 'string') {
    return errorResponse('shortDescription harus berupa teks', 400);
  }

  // Validasi kategori jika diupdate
  if (body.category !== undefined || body.categoryId !== undefined) {
    const categoryInput = String(body.categoryId || body.category || '').trim();
    if (!categoryInput) {
      return errorResponse('Kategori tidak boleh kosong', 400);
    }
    const matchedCategory = db.categories.findById(categoryInput) || db.categories.findBySlug(categoryInput);
    if (!matchedCategory) {
      return errorResponse('Kategori tidak valid atau tidak ditemukan', 400);
    }
    body.categoryId = matchedCategory.id;
    body.category = matchedCategory.slug;
  }

  // Validasi gender jika diupdate
  if (body.gender !== undefined) {
    const rawGender = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : '';
    const validGenders = ['women', 'men', 'unisex'];
    if (!validGenders.includes(rawGender)) {
      return errorResponse('gender harus salah satu dari: women, men, unisex', 400);
    }
    body.gender = rawGender as 'women' | 'men' | 'unisex';
  }

  // Validasi collection jika diupdate
  if (body.collection !== undefined) {
    if (typeof body.collection !== 'boolean') {
      return errorResponse('collection harus berupa boolean', 400);
    }
  }

  // Resolusi daftar ukuran
  const oldSizes = existing.sizes && existing.sizes.length > 0 ? existing.sizes : ['One Size'];
  let targetSizes = oldSizes;
  let sizesChanged = false;

  if (body.sizes !== undefined) {
    if (Array.isArray(body.sizes) && body.sizes.length > 0) {
      targetSizes = (body.sizes as string[]).map((s) => String(s).trim()).filter(Boolean);
    } else {
      targetSizes = ['One Size'];
    }
    body.sizes = targetSizes;
    sizesChanged = JSON.stringify(targetSizes) !== JSON.stringify(oldSizes);
  }

  if (body.colorVariants !== undefined) {
    const variants = body.colorVariants as ColorVariant[];

    const validation = validateColorVariants(variants, targetSizes);
    if (!validation.valid) {
      return errorResponse(validation.error || 'Data colorVariants tidak valid', 400);
    }
    body.colorVariants = normalizeColorVariants(variants, targetSizes);

    // Sinkronisasi fallback colors dan images
    if (body.colors === undefined && Array.isArray(body.colorVariants)) {
      body.colors = (body.colorVariants as ColorVariant[]).map((v: ColorVariant) => v.name);
    }
    if (body.images === undefined && Array.isArray(body.colorVariants)) {
      const allImages = Array.from(new Set((body.colorVariants as ColorVariant[]).flatMap((v: ColorVariant) => v.images)));
      if (allImages.length > 0) {
        body.images = allImages;
      }
    }
  } else if (sizesChanged) {
    // Jika daftar ukuran berubah dan colorVariants tidak dikirim langsung:
    // Ukuran baru diisi 0 di semua warna, ukuran yang dihapus dibuang dari semua warna
    const updatedVariants = syncVariantsWithSizes(existing.colorVariants || [], targetSizes);
    body.colorVariants = updatedVariants;
  } else if (body.colors !== undefined && Array.isArray(body.colors)) {
    // Jika colors diupdate tanpa colorVariants
    const fallbackImages = Array.isArray(body.images) ? (body.images as string[]) : (existing.images || []);
    body.colorVariants = (body.colors as string[]).map((c: string) => {
      const prev = findColorVariant(existing.colorVariants, c);
      const rawStock = prev?.sizeStock || {};
      const sizeStock: Record<string, number> = {};
      for (const sz of targetSizes) {
        sizeStock[sz] = typeof rawStock[sz] === 'number' && rawStock[sz] >= 0 ? rawStock[sz] : 0;
      }
      const stock = Object.values(sizeStock).reduce((sum, n) => sum + n, 0);
      return {
        name: c,
        hex: prev?.hex ?? guessColorHex(c),
        images: [...fallbackImages],
        sizeStock,
        stock,
        ...(prev?.price !== undefined ? { price: prev.price } : {}),
      };
    });
  }

  // Update stok total produk turunan dari varian warna (abaikan field stock yang dikirim langsung dari client)
  const activeVariants = (body.colorVariants as ColorVariant[] | undefined) ?? existing.colorVariants;
  const variantStockTotal = sumVariantStock(activeVariants);
  if (variantStockTotal !== null) {
    body.stock = variantStockTotal;
  } else {
    body.stock = existing.stock ?? 0;
  }

  const updated = db.products.update(existing.id, body as Partial<Product>);
  if (!updated) return errorResponse('Produk tidak ditemukan', 404);

  if (Array.isArray(body.menuIds)) {
    const validMenuIds = body.menuIds.map(String).filter((mid) => Boolean(db.navigation.findById(mid)));
    db.navigation.setProductMenus(existing.id, validMenuIds);
  }

  return successResponse(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') return errorResponse('Unauthorized', 403);

  const { id } = await params;
  const deleted = db.products.delete(id);
  if (!deleted) return errorResponse('Produk tidak ditemukan', 404);
  return successResponse({ deleted: true });
}
