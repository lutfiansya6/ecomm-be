// GET /api/wilayah/villages/:districtId
import { getVillages } from '@/lib/wilayah-cache';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ districtId: string }> }
) {
  const { districtId } = await params;
  if (!districtId) {
    return NextResponse.json({ success: false, error: 'districtId diperlukan' }, { status: 400 });
  }
  try {
    const data = await getVillages(districtId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[wilayah] villages error:', err);
    return NextResponse.json(
      { success: false, error: 'Layanan data wilayah sedang tidak tersedia' },
      { status: 503 }
    );
  }
}
