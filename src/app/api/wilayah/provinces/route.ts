// GET /api/wilayah/provinces — proxy ke emsifa.com dengan in-memory cache
import { getProvinces } from '@/lib/wilayah-cache';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await getProvinces();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[wilayah] provinces error:', err);
    return NextResponse.json(
      { success: false, error: 'Layanan data wilayah sedang tidak tersedia' },
      { status: 503 }
    );
  }
}
