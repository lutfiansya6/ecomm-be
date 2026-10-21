// Next.js Middleware — CORS for FE (port 3000) and BO (port 3002)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1):(3000|3002)$/;

function getAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:3002' ||
    origin === 'http://127.0.0.1:3000' ||
    origin === 'http://127.0.0.1:3002' ||
    ALLOWED_ORIGIN_REGEX.test(origin)
  ) {
    return origin;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(origin);

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });

    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }

    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  // Handle standard API request
  const response = NextResponse.next();

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
