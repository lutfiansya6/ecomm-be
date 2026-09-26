// ============================================================
// LUXE — RajaOngkir (Komerce) Shipping Service
// Search destination with in-memory caching & calculate costs
// ============================================================
import type { ShippingDestination, ShippingCostOption } from '@/types';

const BASE_URL = process.env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1';
const API_KEY = process.env.RAJAONGKIR_API_KEY || '';
const ORIGIN_ID = process.env.RAJAONGKIR_ORIGIN_ID || '73295';

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour TTL
const destinationCache = new Map<string, { data: ShippingDestination[]; ts: number }>();

function isCacheValid(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL_MS;
}

// ─── Mock Fallback Data (When API Key is not yet configured) ──
const MOCK_DESTINATIONS: ShippingDestination[] = [
  { id: 73295, label: 'Tanah Abang, Kota Jakarta Pusat, DKI Jakarta', district_name: 'Tanah Abang', city_name: 'Kota Jakarta Pusat', province_name: 'DKI Jakarta', zip_code: '10270' },
  { id: 73296, label: 'Kebayoran Baru, Kota Jakarta Selatan, DKI Jakarta', district_name: 'Kebayoran Baru', city_name: 'Kota Jakarta Selatan', province_name: 'DKI Jakarta', zip_code: '12110' },
  { id: 73297, label: 'Setiabudi, Kota Jakarta Selatan, DKI Jakarta', district_name: 'Setiabudi', city_name: 'Kota Jakarta Selatan', province_name: 'DKI Jakarta', zip_code: '12920' },
  { id: 73298, label: 'Coblong, Kota Bandung, Jawa Barat', district_name: 'Coblong', city_name: 'Kota Bandung', province_name: 'Jawa Barat', zip_code: '40132' },
  { id: 73299, label: 'Wonokromo, Kota Surabaya, Jawa Timur', district_name: 'Wonokromo', city_name: 'Kota Surabaya', province_name: 'Jawa Timur', zip_code: '60241' },
  { id: 73300, label: 'Kuta, Kabupaten Badung, Bali', district_name: 'Kuta', city_name: 'Kabupaten Badung', province_name: 'Bali', zip_code: '80361' },
  { id: 73301, label: 'Medan Baru, Kota Medan, Sumatera Utara', district_name: 'Medan Baru', city_name: 'Kota Medan', province_name: 'Sumatera Utara', zip_code: '20153' },
  { id: 73302, label: 'Panakkukang, Kota Makassar, Sulawesi Selatan', district_name: 'Panakkukang', city_name: 'Kota Makassar', province_name: 'Sulawesi Selatan', zip_code: '90231' },
];

function getMockShippingCosts(weight: number, courier?: string): ShippingCostOption[] {
  const kg = Math.max(1, Math.ceil(weight / 1000));
  const all: ShippingCostOption[] = [
    { name: 'JNE', code: 'jne', service: 'REG', description: 'Layanan Reguler', cost: 18000 * kg, etd: '2-3 hari' },
    { name: 'JNE', code: 'jne', service: 'YES', description: 'Yakin Esok Sampai', cost: 34000 * kg, etd: '1 hari' },
    { name: 'SiCepat', code: 'sicepat', service: 'REG', description: 'Reguler Service', cost: 16000 * kg, etd: '2-3 hari' },
    { name: 'SiCepat', code: 'sicepat', service: 'BEST', description: 'Besok Sampai Tujuan', cost: 30000 * kg, etd: '1 hari' },
    { name: 'J&T', code: 'jnt', service: 'EZ', description: 'Reguler Service', cost: 17000 * kg, etd: '2-3 hari' },
  ];
  if (!courier || courier === 'all') return all;
  return all.filter((c) => c.code.toLowerCase() === courier.toLowerCase());
}

// ─── Search Destination ─────────────────────────────────────
export async function searchDestination(keyword: string): Promise<ShippingDestination[]> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];

  // Check cache
  const cached = destinationCache.get(q);
  if (cached && isCacheValid(cached.ts)) {
    return cached.data;
  }

  // If no API Key configured, fallback to smart mock search
  if (!API_KEY) {
    console.log('[RajaOngkir] RAJAONGKIR_API_KEY is empty. Using mock destination search.');
    const filtered = MOCK_DESTINATIONS.filter((d) =>
      d.label.toLowerCase().includes(q) ||
      (d.district_name && d.district_name.toLowerCase().includes(q)) ||
      (d.city_name && d.city_name.toLowerCase().includes(q))
    );
    const result = filtered.length > 0 ? filtered : [
      { id: 73295, label: `${keyword}, Lokasi Tujuan Terpilih (Mock RajaOngkir)`, district_name: keyword, city_name: 'Kota Tujuan', province_name: 'Indonesia' }
    ];
    destinationCache.set(q, { data: result, ts: Date.now() });
    return result;
  }

  try {
    const url = `${BASE_URL}/destination/domestic-destination?search=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        key: API_KEY,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from RajaOngkir search destination`);
    }

    const json = await res.json();
    let list: ShippingDestination[] = [];

    if (json && Array.isArray(json.data)) {
      list = json.data.map((item: any) => ({
        id: Number(item.id),
        label: item.label || `${item.subdistrict_name || item.district_name || ''}, ${item.city_name || ''}, ${item.province_name || ''}`.trim(),
        subdistrict_name: item.subdistrict_name,
        district_name: item.district_name,
        city_name: item.city_name,
        province_name: item.province_name,
        zip_code: item.zip_code,
      }));
    }

    destinationCache.set(q, { data: list, ts: Date.now() });
    return list;
  } catch (err) {
    console.error('[RajaOngkir] Search destination error:', err);
    // Fallback on error
    return getMockShippingFallbackDestinations(keyword);
  }
}

function getMockShippingFallbackDestinations(keyword: string): ShippingDestination[] {
  return [
    { id: 73295, label: `${keyword}, Lokasi Terpilih (Fallback RajaOngkir)`, district_name: keyword, city_name: 'Tujuan', province_name: 'Indonesia' }
  ];
}

// ─── Calculate Domestic Cost ────────────────────────────────
export async function calculateDomesticCost(params: {
  destination: number | string;
  weight: number;
  courier?: string;
}): Promise<ShippingCostOption[]> {
  const origin = ORIGIN_ID;
  const destination = String(params.destination);
  const weight = Math.max(1, Number(params.weight) || 500);
  const requestedCourier = params.courier || 'all';

  // If no API Key configured, return mock shipping options
  if (!API_KEY) {
    console.log('[RajaOngkir] RAJAONGKIR_API_KEY is empty. Using mock shipping calculate.');
    return getMockShippingCosts(weight, requestedCourier);
  }

  const couriersToQuery = requestedCourier === 'all' ? ['jne', 'sicepat', 'jnt'] : [requestedCourier];
  const allResults: ShippingCostOption[] = [];

  for (const c of couriersToQuery) {
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('origin', String(origin));
      bodyParams.append('destination', String(destination));
      bodyParams.append('weight', String(weight));
      bodyParams.append('courier', c.toLowerCase());

      const res = await fetch(`${BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          key: API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (!res.ok) {
        console.warn(`[RajaOngkir] Calculate cost failed for courier ${c} (HTTP ${res.status})`);
        continue;
      }

      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        for (const item of json.data) {
          // Normalize various possible RajaOngkir response shapes
          if (Array.isArray(item.costs)) {
            // Nested costs format: { code: 'jne', name: 'JNE', costs: [...] }
            const courierName = item.name || item.code || c.toUpperCase();
            const courierCode = (item.code || c).toLowerCase();
            for (const costItem of item.costs) {
              const costVal = Array.isArray(costItem.cost) && costItem.cost[0] ? Number(costItem.cost[0].value) : Number(costItem.cost || 0);
              const etdVal = Array.isArray(costItem.cost) && costItem.cost[0]?.etd ? String(costItem.cost[0].etd) : String(costItem.etd || '2-3');
              allResults.push({
                name: courierName,
                code: courierCode,
                service: costItem.service || 'REG',
                description: costItem.description || costItem.service || 'Layanan Reguler',
                cost: costVal,
                etd: etdVal.toLowerCase().includes('hari') ? etdVal : `${etdVal} hari`,
              });
            }
          } else {
            // Flat format: { name: 'JNE', code: 'jne', service: 'REG', cost: 18000, etd: '2-3' }
            const courierName = item.name || c.toUpperCase();
            const courierCode = (item.code || c).toLowerCase();
            const costVal = Number(item.cost || item.price || item.value || 0);
            const etdVal = String(item.etd || item.estimate || '2-3');
            allResults.push({
              name: courierName,
              code: courierCode,
              service: item.service || 'REG',
              description: item.description || item.service || 'Layanan Pengiriman',
              cost: costVal,
              etd: etdVal.toLowerCase().includes('hari') ? etdVal : `${etdVal} hari`,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[RajaOngkir] Calculate cost error for courier ${c}:`, err);
    }
  }

  // If external call returned options, return them; otherwise fallback to mock
  if (allResults.length > 0) {
    return allResults;
  }

  console.log('[RajaOngkir] No options from API or rate limit hit. Returning fallback rates.');
  return getMockShippingCosts(weight, requestedCourier);
}