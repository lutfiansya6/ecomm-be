// POST /api/auth/login
import { db } from '@/lib/store';
import { signToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse('Email dan password wajib diisi', 400);
    }

    const user = db.users.findByEmail(email.toLowerCase().trim());
    if (!user) return errorResponse('Email atau password salah', 401);
    if (user.password !== password) return errorResponse('Email atau password salah', 401);

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const { password: _, ...safeUser } = user;

    return new Response(
      JSON.stringify({
        success: true,
        data: { token, user: safeUser },
        message: `Selamat datang, ${user.name}!`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `luxe_token=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax`,
        },
      }
    );
  } catch {
    return errorResponse('Terjadi kesalahan server', 500);
  }
}
