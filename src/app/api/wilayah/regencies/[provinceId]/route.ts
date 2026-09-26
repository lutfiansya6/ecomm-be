// GET /api/wilayah/regencies/:provinceId
import { getRegencies } from '@/lib/wilayah-cache';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provinceId: string }> }
) {
  const { provinceId } = await params;
  if (!provinceId) {
    return NextResponse.json({ success: false, error: 'provinceId diperlukan' }, { status: 400 });
  }
  try {
    const data = await getRegencies(provinceId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[wilayah] regencies error:', err);
    return NextResponse.json(
      { success: false, error: 'Layanan data wilayah sedang tidak tersedia' },
      { status: 503 }
    );
  }
}
