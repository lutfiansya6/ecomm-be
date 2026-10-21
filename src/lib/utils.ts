// ============================================================
// LUXE — Utility helpers
// ============================================================
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format IDR currency */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Discount percentage */
export function discountPercent(price: number, comparePrice: number): number {
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

/** Slugify a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

/** API JSON success response */
export function successResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** API JSON error response */
export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Strip HTML tags and angle brackets from user text (XSS prevention) */
export function sanitizeText(input: string): string {
  let prev: string;
  let out = input;
  do {
    prev = out;
    out = out
      .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out.replace(/[<>]/g, '').trim();
}

/** Generate dummy transaction ID */
export function generateTxId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Star rating array helper */
export function getStars(rating: number): ('full' | 'half' | 'empty')[] {
  const stars: ('full' | 'half' | 'empty')[] = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) stars.push('full');
    else if (rating >= i - 0.5) stars.push('half');
    else stars.push('empty');
  }
  return stars;
}

/** Generate URL-friendly category slug (lowercase, numbers, and hyphens only) */
export function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Validate category slug format (only lowercase letters, numbers, and single hyphens) */
export function isValidCategorySlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Generate a unique slug by appending counter if needed */
export function getUniqueCategorySlug(name: string, existingSlugs: string[]): string {
  const base = generateCategorySlug(name) || 'category';
  let slug = base;
  let counter = 1;
  const set = new Set(existingSlugs.map((s) => s.toLowerCase()));
  while (set.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

export * from './colors';


