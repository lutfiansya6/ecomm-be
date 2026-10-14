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
    const destinationLabel = body.destinationLabel;
    const province = body.province;
    const city = body.city;

    if (!destination && !destinationLabel && !city && !province) {
      return errorResponse('Parameter destination/destinationId diperlukan', 400);
    }

    const options = await calculateDomesticCost({
      destination: destination || destinationLabel || `${city} ${province}`,
      weight,
      courier,
      destinationLabel,
      province,
      city,
    });

    return successResponse(options);
  } catch (err) {
    console.error('[shipping] calculate-cost error:', err);
    return errorResponse('Gagal menghitung ongkos kirim', 500);
  }
}