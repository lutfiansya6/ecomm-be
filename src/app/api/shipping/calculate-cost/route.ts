// POST /api/shipping/calculate-cost
import { calculateDomesticCost } from '@/lib/shipping';
import { successResponse, errorResponse } from '@/lib/utils';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const destination = body.destinationId || body.destination;
    const weight = Number(body.weight) || 500;
    const courier = body.courier;

    if (!destination) {
      return errorResponse('Parameter destination/destinationId diperlukan', 400);
    }

    const options = await calculateDomesticCost({
      destination,
      weight,
      courier,
    });

    return successResponse(options);
  } catch (err) {
    console.error('[shipping] calculate-cost error:', err);
    return errorResponse('Gagal menghitung ongkos kirim', 500);
  }
}