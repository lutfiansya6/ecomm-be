// ============================================================
// LUXE — Auth helpers using jose (Edge-compatible JWT)
// ============================================================
import { SignJWT, jwtVerify } from 'jose';
import { AuthToken } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'luxe-super-secret-key-2024-prototype'
);
const EXPIRES_IN = '7d';

export async function signToken(payload: Omit<AuthToken, 'iat' | 'exp'>): Promise<string> {
  return await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthToken | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthToken;
  } catch {
    return null;
  }
}

export function getTokenFromHeader(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Also try cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/luxe_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export async function getAuthUser(request: Request): Promise<AuthToken | null> {
  const token = getTokenFromHeader(request);
  if (!token) return null;
  return await verifyToken(token);
}
