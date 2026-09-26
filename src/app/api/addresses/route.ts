// GET /api/addresses - List addresses of current user
// POST /api/addresses - Create new address for current user
import { db, generateId } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { UserAddress } from '@/types';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const addresses = db.addresses.findByUser(authUser.userId);
  return successResponse({ addresses, total: addresses.length });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const {
      label,
      fullName,
      phone,
      street,
      province,
      city,
      district,
      village,
      postalCode,
      country = 'Indonesia',
      isDefault = false,
    } = body;

    if (!fullName || !phone || !street || !province || !city || !postalCode) {
      return errorResponse('Lengkapi semua kolom wajib alamat', 400);
    }

    const newAddress: UserAddress = {
      id: generateId('addr'),
      userId: authUser.userId,
      label: label?.trim() || 'Alamat',
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      province: province.trim(),
      city: city.trim(),
      district: district ? district.trim() : '',
      village: village ? village.trim() : '',
      postalCode: postalCode.trim(),
      country: country.trim() || 'Indonesia',
      isDefault: Boolean(isDefault),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.addresses.create(newAddress);
    return successResponse(created, 201);
  } catch {
    return errorResponse('Gagal menambahkan alamat', 400);
  }
}
