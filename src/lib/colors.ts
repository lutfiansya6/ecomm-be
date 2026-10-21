// ============================================================
// LUXE — Color Variant Helpers & Validation
// ============================================================
import type { ColorVariant } from '@/types';

export const COLOR_HEX_MAP: Record<string, string> = {
  navy: '#1F2A44',
  'midnight navy': '#151E3D',
  black: '#000000',
  ivory: '#FFFFF0',
  charcoal: '#36454F',
  cognac: '#9E471A',
  camel: '#C19A6B',
  ecru: '#C2B280',
  stone: '#928E85',
  'deep burgundy': '#800020',
  burgundy: '#800020',
  sapphire: '#0F52BA',
  emerald: '#50C878',
  taupe: '#87796F',
  white: '#FFFFFF',
  gold: '#D4AF37',
  silver: '#C0C0C0',
  tan: '#D2B48C',
  beige: '#F5F5DC',
  brown: '#8B4513',
  red: '#FF0000',
  blue: '#0000FF',
  green: '#008000',
  yellow: '#FFFF00',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  grey: '#808080',
  gray: '#808080',
  olive: '#808000',
  maroon: '#800000',
  cream: '#FFFDD0',
  khaki: '#F0E68C',
  teal: '#008080',
  coral: '#FF7F50',
  indigo: '#4B0082',
  violet: '#EE82EE',
  turquoise: '#40E0D0',
  // Combinations
  'black/gold': '#1A1A1A',
  'ivory/silver': '#F5F5F0',
  'gold/navy': '#1F2A44',
  'ivory/gold': '#FFFFF0',
  'tan/gold': '#D2B48C',
  'white/silver': '#FFFFFF',
};

/**
 * Guess hex color string in #RRGGBB format from a color name.
 */
export function guessColorHex(colorName: string): string {
  if (!colorName || typeof colorName !== 'string') return '#000000';
  const normalized = colorName.trim().toLowerCase();

  // 1. Direct match
  if (COLOR_HEX_MAP[normalized]) {
    return COLOR_HEX_MAP[normalized];
  }

  // 2. Check if normalized contains slash (e.g. "black/gold")
  if (normalized.includes('/')) {
    const parts = normalized.split('/').map((p) => p.trim());
    for (const part of parts) {
      if (COLOR_HEX_MAP[part]) return COLOR_HEX_MAP[part];
    }
  }

  // 3. Multi-word match in map keys
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (normalized.includes(key)) {
      return hex;
    }
  }

  // 4. Word-by-word match
  const words = normalized.split(/[\s-]+/);
  for (const word of words) {
    if (COLOR_HEX_MAP[word]) return COLOR_HEX_MAP[word];
  }

  // 5. Fallback default to #000000
  return '#000000';
}

export interface ColorVariantValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates colorVariants array:
 * - Must be an array
 * - Each item:
 *   - name: required non-empty string
 *   - hex: required string matching #RRGGBB
 *   - images: required array of strings
 *   - price: optional integer > 0 (null / '' dianggap kosong)
 *   - stock: field turunan yang diabaikan dari client (selalu dihitung ulang dari sizeStock)
 *   - sizeStock: required object with non-negative integer for all product sizes
 */
export function validateColorVariants(
  colorVariants: unknown,
  productSizes: string[] = []
): ColorVariantValidationResult {
  if (!Array.isArray(colorVariants)) {
    return { valid: false, error: 'colorVariants harus berupa array' };
  }

  for (let i = 0; i < colorVariants.length; i++) {
    const item = colorVariants[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Item colorVariants ke-${i + 1} harus berupa objek` };
    }

    const candidate = item as Partial<ColorVariant> & Record<string, unknown>;

    if (!candidate.name || typeof candidate.name !== 'string' || candidate.name.trim() === '') {
      return { valid: false, error: 'Nama varian warna wajib diisi' };
    }

    if (!candidate.hex || typeof candidate.hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(candidate.hex)) {
      return { valid: false, error: 'Format hex varian warna harus berupa #RRGGBB (contoh: #1F2A44)' };
    }

    if (!Array.isArray(candidate.images) || !candidate.images.every((img) => typeof img === 'string')) {
      return { valid: false, error: 'images varian warna harus berupa array string' };
    }

    // Catatan: field candidate.stock (stok turunan di level warna) diabaikan dari client dan dihitung ulang dari sizeStock

    if (!isEmptyValue(candidate.price)) {
      if (typeof candidate.price !== 'number' || !Number.isInteger(candidate.price) || candidate.price <= 0) {
        return {
          valid: false,
          error: `Harga varian warna "${candidate.name}" harus berupa bilangan bulat lebih dari 0`,
        };
      }
    }

    if (!candidate.sizeStock || typeof candidate.sizeStock !== 'object' || Array.isArray(candidate.sizeStock)) {
      return {
        valid: false,
        error: `sizeStock untuk varian warna "${candidate.name}" wajib berupa objek stok per ukuran`,
      };
    }

    const sizeStockMap = candidate.sizeStock as Record<string, unknown>;

    // 1. Validasi kelengkapan entri: setiap ukuran produk wajib memiliki entri di sizeStock
    const sizesToCheck = productSizes.length > 0 ? productSizes : Object.keys(sizeStockMap);
    if (sizesToCheck.length === 0) {
      return {
        valid: false,
        error: `sizeStock untuk varian warna "${candidate.name}" wajib memiliki entri ukuran`,
      };
    }

    for (const size of sizesToCheck) {
      if (
        !(size in sizeStockMap) ||
        sizeStockMap[size] === undefined ||
        sizeStockMap[size] === null ||
        sizeStockMap[size] === ''
      ) {
        return {
          valid: false,
          error: `Stok untuk ukuran "${size}" pada varian warna "${candidate.name}" wajib diisi`,
        };
      }
    }

    // 2. Validasi nilai entri: harus berupa bilangan bulat dan tidak boleh negatif
    for (const [size, qty] of Object.entries(sizeStockMap)) {
      if (typeof qty !== 'number' || Number.isNaN(qty) || !Number.isInteger(qty)) {
        return {
          valid: false,
          error: `Stok ukuran "${size}" pada varian warna "${candidate.name}" harus berupa bilangan bulat`,
        };
      }
      if (qty < 0) {
        return {
          valid: false,
          error: `Stok ukuran "${size}" pada varian warna "${candidate.name}" tidak boleh negatif`,
        };
      }
    }
  }

  return { valid: true };
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Synchronizes variants with the product size list:
 * - Newly added sizes get 0
 * - Removed sizes are pruned
 * - Variant stock is recalculated
 */
export function syncVariantsWithSizes(variants: ColorVariant[], newSizes: string[]): ColorVariant[] {
  return variants.map((v) => {
    const rawStock = v.sizeStock || {};
    const newSizeStock: Record<string, number> = {};
    for (const sz of newSizes) {
      if (typeof rawStock[sz] === 'number' && rawStock[sz] >= 0) {
        newSizeStock[sz] = rawStock[sz];
      } else {
        newSizeStock[sz] = 0;
      }
    }
    const derivedStock = Object.values(newSizeStock).reduce((sum, n) => sum + n, 0);
    return {
      ...v,
      sizeStock: newSizeStock,
      stock: derivedStock,
    };
  });
}

/**
 * Normalizes (already validated) colorVariants:
 * - sizeStock is pruned to productSizes (or existing keys)
 * - stock is derived from sum of sizeStock
 * - empty price is omitted so product price is used as fallback
 */
export function normalizeColorVariants(
  colorVariants: ColorVariant[],
  productSizes: string[] = []
): ColorVariant[] {
  return colorVariants.map((v) => {
    const { price, ...rest } = v;
    const rawStock = v.sizeStock || {};
    const normalizedSizeStock: Record<string, number> = {};
    const targetSizes = productSizes.length > 0 ? productSizes : Object.keys(rawStock);

    for (const sz of targetSizes) {
      normalizedSizeStock[sz] = typeof rawStock[sz] === 'number' && rawStock[sz] >= 0 ? rawStock[sz] : 0;
    }

    const derivedStock = Object.values(normalizedSizeStock).reduce((sum, n) => sum + n, 0);
    const normalized: ColorVariant = {
      ...rest,
      name: v.name.trim(),
      hex: v.hex,
      images: Array.isArray(v.images) ? v.images : [],
      sizeStock: normalizedSizeStock,
      stock: derivedStock,
    };

    if (!isEmptyValue(price)) normalized.price = price;
    return normalized;
  });
}

/** True if every variant defines its own sizeStock and has valid numbers. */
export function allVariantsHaveStock(colorVariants?: ColorVariant[]): boolean {
  return (
    !!colorVariants &&
    colorVariants.length > 0 &&
    colorVariants.every(
      (v) =>
        v.sizeStock &&
        typeof v.sizeStock === 'object' &&
        Object.values(v.sizeStock).every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
    )
  );
}

/** Sum of variant stocks derived from sizeStock, or null if colorVariants is empty/undefined. */
export function sumVariantStock(colorVariants?: ColorVariant[]): number | null {
  if (!colorVariants || colorVariants.length === 0) return null;
  return colorVariants.reduce((sum: number, v) => {
    if (v.sizeStock && typeof v.sizeStock === 'object') {
      return sum + Object.values(v.sizeStock).reduce((s: number, n: unknown) => s + (typeof n === 'number' ? n : 0), 0);
    }
    return sum + (typeof v.stock === 'number' ? v.stock : 0);
  }, 0);
}

/** Finds a variant by color name (case-insensitive). */
export function findColorVariant(
  colorVariants: ColorVariant[] | undefined,
  color: string
): ColorVariant | undefined {
  if (!colorVariants || !color) return undefined;
  const target = color.trim().toLowerCase();
  return colorVariants.find((v) => v.name.trim().toLowerCase() === target);
}

/** Effective selling price: variant price if set, otherwise product price. */
export function resolveVariantPrice(productPrice: number, variant?: ColorVariant): number {
  return typeof variant?.price === 'number' ? variant.price : productPrice;
}

