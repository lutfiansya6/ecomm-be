// GET /api/shipping/search-destination?keyword=xxx
import { searchDestination } from '@/lib/shipping';
import { successResponse, errorResponse } from '@/lib/utils';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || searchParams.get('search') || searchParams.get('q');

  if (!keyword || !keyword.trim()) {
    return errorResponse('Parameter keyword/search diperlukan', 400);
  }

  try {
    const destinations = await searchDestination(keyword.trim());
    return successResponse(destinations);
  } catch (err) {
    console.error('[shipping] search-destination error:', err);
    return errorResponse('Gagal mencari lokasi tujuan pengiriman', 500);
  }
}