// POST /api/auth/logout
export async function POST() {
  return new Response(
    JSON.stringify({ success: true, message: 'Logout berhasil' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'luxe_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
      },
    }
  );
}

// GET /api/auth/me - verify token
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  const user = db.users.findById(authUser.userId);
  if (!user) return errorResponse('User tidak ditemukan', 404);

  const { password: _, ...safeUser } = user;
  return successResponse(safeUser);
}
