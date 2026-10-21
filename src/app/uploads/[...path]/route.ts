import fs from 'fs';
import path from 'path';

function getUploadDir(): string {
  const directPath = path.join(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(path.join(process.cwd(), 'public'))) return directPath;
  const bePath = path.join(process.cwd(), 'be', 'public', 'uploads');
  if (fs.existsSync(path.join(process.cwd(), 'be', 'public'))) return bePath;
  return directPath;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filename = pathSegments.join('/');
  const filePath = path.join(getUploadDir(), filename);

  if (!fs.existsSync(filePath)) {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const fileBuffer = await fs.promises.readFile(filePath);

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
