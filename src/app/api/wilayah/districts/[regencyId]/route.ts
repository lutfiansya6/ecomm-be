// GET /api/wilayah/districts/:regencyId
import { getDistricts } from '@/lib/wilayah-cache';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ regencyId: string }> }
) {
  const { regencyId } = await params;
  if (!regencyId) {
    return NextResponse.json({ success: false, error: 'regencyId diperlukan' }, { status: 400 });
  }
  try {
    const data = await getDistricts(regencyId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[wilayah] districts error:', err);
    return NextResponse.json(
      { success: false, error: 'Layanan data wilayah sedang tidak tersedia' },
      { status: 503 }
    );
  }
}
