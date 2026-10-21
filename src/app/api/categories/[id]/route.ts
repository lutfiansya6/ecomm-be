// PUT /api/categories/[id] (admin) — update name, slug, active, order
// DELETE /api/categories/[id] (admin) — delete category with product protection / moveTo
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, isValidCategorySlug } from '@/lib/utils';
import type { Category } from '@/types';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const existing = db.categories.findById(id);
  if (!existing) {
    return errorResponse('Kategori tidak ditemukan', 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Data tidak valid', 400);
  }

  const updates: Partial<Category> = {};

  // Validasi nama jika diubah
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return errorResponse('Nama kategori harus berupa teks', 400);
    }
    const name = body.name.trim();
    if (name.length < 2 || name.length > 40) {
      return errorResponse('Nama kategori harus antara 2 hingga 40 karakter', 400);
    }
    const dup = db.categories.findAll().find(
      (c) => c.id !== existing.id && c.name.toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      return errorResponse('Nama kategori sudah digunakan', 400);
    }
    updates.name = name;
    // Catatan: Mengubah name TIDAK mengubah slug otomatis, supaya link lama tidak rusak
  }

  // Validasi slug jika diubah secara manual
  let slugChanged = false;
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      return errorResponse('Slug harus berupa teks', 400);
    }
    const slug = body.slug.trim().toLowerCase();
    if (!isValidCategorySlug(slug)) {
      return errorResponse(
        'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung',
        400
      );
    }
    const dup = db.categories.findAll().find((c) => c.id !== existing.id && c.slug === slug);
    if (dup) {
      return errorResponse('Slug sudah digunakan', 400);
    }
    if (slug !== existing.slug) {
      updates.slug = slug;
      slugChanged = true;
    }
  }

  // Validasi status active
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return errorResponse('Status active harus berupa boolean', 400);
    }
    updates.active = body.active;
  }

  // Validasi order
  if (body.order !== undefined) {
    if (typeof body.order !== 'number' || !Number.isInteger(body.order) || body.order < 0) {
      return errorResponse('Order harus berupa bilangan bulat >= 0', 400);
    }
    updates.order = body.order;
  }

  const updated = db.categories.update(existing.id, updates);
  if (!updated) {
    return errorResponse('Gagal memperbarui kategori', 500);
  }

  // Jika slug diubah secara manual, update field category (slug) di produk terkait
  if (slugChanged && updates.slug) {
    const products = db.products.findAll();
    products.forEach((p) => {
      if (p.categoryId === existing.id || p.category === existing.slug) {
        p.category = updates.slug!;
      }
    });
  }

  return successResponse(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin only', 403);
  }

  const { id } = await params;
  const existing = db.categories.findById(id);
  if (!existing) {
    return errorResponse('Kategori tidak ditemukan', 404);
  }

  // Aturan: Tolak penghapusan kategori terakhir
  const allCategories = db.categories.findAll();
  if (allCategories.length <= 1) {
    return errorResponse('Kategori terakhir tidak boleh dihapus', 400);
  }

  const productCount = db.categories.countProducts(existing.id);

  // Jika masih ada produk di kategori itu
  if (productCount > 0) {
    const { searchParams } = new URL(request.url);
    const moveTo = searchParams.get('moveTo');

    if (!moveTo) {
      // Tolak dengan status 409 dan kembalikan jumlah produknya
      return new Response(
        JSON.stringify({
          success: false,
          error: `Kategori tidak dapat dihapus karena masih memiliki ${productCount} produk`,
          productCount,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Jika dikirim ?moveTo=<id kategori tujuan>, pindahkan dulu semua produk
    const targetCategory = db.categories.findById(moveTo);
    if (!targetCategory || targetCategory.id === existing.id) {
      return errorResponse('Kategori tujuan pemindahan tidak valid', 400);
    }

    db.categories.moveProducts(existing.id, targetCategory.id);
    db.categories.delete(existing.id);

    return successResponse({
      deleted: true,
      movedProductCount: productCount,
      targetCategoryId: targetCategory.id,
    });
  }

  // Jika tidak ada produk, langsung hapus
  db.categories.delete(existing.id);
  return successResponse({ deleted: true });
}
