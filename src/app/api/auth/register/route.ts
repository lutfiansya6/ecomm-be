// POST /api/auth/register
import { db, generateId } from '@/lib/store';
import { signToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import type { User } from '@/types';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return errorResponse('Nama, email, dan password wajib diisi', 400);
    }
    if (password.length < 6) {
      return errorResponse('Password minimal 6 karakter', 400);
    }

    const existing = db.users.findByEmail(email.toLowerCase().trim());
    if (existing) return errorResponse('Email sudah terdaftar', 409);

    const newUser: User = {
      id: generateId('usr'),
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    db.users.create(newUser);

    const token = await signToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    });

    const { password: _, ...safeUser } = newUser;

    return new Response(
      JSON.stringify({
        success: true,
        data: { token, user: safeUser },
        message: 'Akun berhasil dibuat!',
      }),
      {
        status: 201,
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
