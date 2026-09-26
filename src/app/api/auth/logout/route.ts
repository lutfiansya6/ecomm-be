// POST /api/auth/logout
import { successResponse } from '@/lib/utils';

export async function POST() {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Berhasil logout',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'luxe_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
      },
    }
  );
}
