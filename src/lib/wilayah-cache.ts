// ============================================================
// LUXE — Wilayah Indonesia in-memory cache
// Caches static data from emsifa.com to avoid repeated fetches
// ============================================================

const EMSIFA_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/v2';
const FETCH_TIMEOUT_MS = 8000;

// ─── Types ────────────────────────────────────────────────
export interface Province {
  id: string;
  name: string;
}

export interface Regency {
  id: string;
  province_id: string;
  name: string;
}

export interface District {
  id: string;
  regency_id: string;
  name: string;
}

export interface Village {
  id: string;
  district_id: string;
  name: string;
  postal_code: string;
}

// ─── In-memory cache store ─────────────────────────────────
// Provinces are static (38) — cache permanently per process
let provincesCache: Province[] | null = null;

// Regencies/districts/villages change less often; cache with TTL
const regenciesCache = new Map<string, { data: Regency[]; ts: number }>();
const districtsCache = new Map<string, { data: District[]; ts: number }>();
const villagesCache = new Map<string, { data: Village[]; ts: number }>();

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function isFresh(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL_MS;
}

// ─── Fetch helper with timeout + error ────────────────────
async function fetchWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from emsifa.com`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout ke emsifa.com');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extract helper ───────────────────────────────────────
function extractDataArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && 'data' in res) {
    const inner = (res as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

// ─── Public API ───────────────────────────────────────────

/** Get all provinces (cached permanently per process). */
export async function getProvinces(): Promise<Province[]> {
  if (provincesCache && provincesCache.length > 0) return provincesCache;
  const raw = await fetchWithTimeout<unknown>(`${EMSIFA_BASE}/provinces.json`);
  const data = extractDataArray<Province>(raw);
  provincesCache = data;
  return data;
}

/** Get regencies for a province (cached with TTL). */
export async function getRegencies(provinceId: string): Promise<Regency[]> {
  const cached = regenciesCache.get(provinceId);
  if (cached && isFresh(cached.ts)) return cached.data;
  const raw = await fetchWithTimeout<unknown>(`${EMSIFA_BASE}/regencies/${provinceId}.json`);
  const data = extractDataArray<Regency>(raw);
  regenciesCache.set(provinceId, { data, ts: Date.now() });
  return data;
}

/** Get districts for a regency (cached with TTL). */
export async function getDistricts(regencyId: string): Promise<District[]> {
  const cached = districtsCache.get(regencyId);
  if (cached && isFresh(cached.ts)) return cached.data;
  const raw = await fetchWithTimeout<unknown>(`${EMSIFA_BASE}/districts/${regencyId}.json`);
  const data = extractDataArray<District>(raw);
  districtsCache.set(regencyId, { data, ts: Date.now() });
  return data;
}

/** Get villages for a district (cached with TTL). */
export async function getVillages(districtId: string): Promise<Village[]> {
  const cached = villagesCache.get(districtId);
  if (cached && isFresh(cached.ts)) return cached.data;
  const raw = await fetchWithTimeout<unknown>(`${EMSIFA_BASE}/villages/${districtId}.json`);
  const data = extractDataArray<Village>(raw);
  villagesCache.set(districtId, { data, ts: Date.now() });
  return data;
}
