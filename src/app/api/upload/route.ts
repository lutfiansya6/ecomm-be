// ============================================================
// POST /api/upload — Upload product image (Admin only)
// ============================================================
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Detect image type based on file magic bytes.
 * - JPEG / JPG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WEBP: RIFF....WEBP
 */
export function detectImageType(buffer: Buffer): { ext: 'jpg' | 'png' | 'webp'; mime: string } | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG / JPG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // WEBP (RIFF header + WEBP magic bytes)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

function getUploadDir(): string {
  const directPath = path.join(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(path.join(process.cwd(), 'public'))) return directPath;
  const bePath = path.join(process.cwd(), 'be', 'public', 'uploads');
  if (fs.existsSync(path.join(process.cwd(), 'be', 'public'))) return bePath;
  return directPath;
}

function getBaseUrl(request: Request): string {
  try {
    const url = new URL(request.url);
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protoHeader =
      request.headers.get('x-forwarded-proto') || (url.protocol ? url.protocol.replace(':', '') : 'http');
    if (hostHeader) {
      return `${protoHeader}://${hostHeader}`;
    }
    return url.origin;
  } catch {
    return 'http://localhost:3001';
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers':
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    },
  });
}

export async function POST(request: Request) {
  // 1. Validasi Autentikasi Admin
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse('Unauthorized: Silakan login terlebih dahulu', 401);
  }
  if (authUser.role !== 'admin') {
    return errorResponse('Forbidden: Khusus admin', 403);
  }

  try {
    // 2. Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('File tidak ditemukan. Gunakan field "file"', 400);
    }

    // 3. Validasi Ukuran File (Maksimal 5MB)
    if (file.size === 0) {
      return errorResponse('File tidak boleh kosong', 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('Ukuran file maksimal 5MB', 400);
    }

    // 4. Baca buffer dan validasi magic bytes (Hanya JPG, PNG, WEBP)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageType = detectImageType(buffer);

    if (!imageType) {
      return errorResponse(
        'Format file tidak didukung. Hanya file JPG, PNG, dan WEBP yang diizinkan',
        400
      );
    }

    // 5. Generate nama file unik: product_<timestamp>_<random>.<ext>
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const filename = `product_${timestamp}_${randomStr}.${imageType.ext}`;

    // 6. Simpan di folder public/uploads/
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const destinationPath = path.join(uploadDir, filename);
    await fs.promises.writeFile(destinationPath, buffer);

    // 7. Response dengan alamat lengkap file
    const baseUrl = getBaseUrl(request);
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    return successResponse({ url: fileUrl }, 201);
  } catch (error) {
    console.error('Error saat mengunggah file:', error);
    return errorResponse('Gagal mengunggah file', 500);
  }
}
