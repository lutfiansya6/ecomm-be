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
const destinationRegistry = new Map<string, ShippingDestination>();

function isCacheValid(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL_MS;
}

// ─── Deterministic Hash for Mock Destination IDs ─────────────
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Indonesian Zone-Aware Shipping Calculator (Smart Fallback) 
export function detectIndonesianZone(target: string): {
  zoneName: string;
  multiplier: number;
  etdBase: string;
  etdExpress: string;
} {
  const s = target.toLowerCase();

  // Zone 5: Papua, Papua Barat Daya, Papua Selatan, Maluku
  if (
    s.includes('papua') ||
    s.includes('raja ampat') ||
    s.includes('sorong') ||
    s.includes('jayapura') ||
    s.includes('merauke') ||
    s.includes('manokwari') ||
    s.includes('maluku') ||
    s.includes('ambon') ||
    s.includes('ternate') ||
    s.includes('tiplol') ||
    s.includes('mayalibit') ||
    s.includes('warimak')
  ) {
    return { zoneName: 'Papua & Maluku', multiplier: 6.5, etdBase: '4-7 hari', etdExpress: '2-4 hari' };
  }

  // Zone 4: Kalimantan & Sulawesi
  if (
    s.includes('kalimantan') ||
    s.includes('sulawesi') ||
    s.includes('makassar') ||
    s.includes('balikpapan') ||
    s.includes('samarinda') ||
    s.includes('banjarmasin') ||
    s.includes('pontianak') ||
    s.includes('manado') ||
    s.includes('palu') ||
    s.includes('kendari') ||
    s.includes('gorontalo')
  ) {
    return { zoneName: 'Kalimantan & Sulawesi', multiplier: 2.8, etdBase: '3-5 hari', etdExpress: '2-3 hari' };
  }

  // Zone 3: Sumatera, Bali, NTB, NTT
  if (
    s.includes('sumatera') ||
    s.includes('aceh') ||
    s.includes('medan') ||
    s.includes('padang') ||
    s.includes('pekanbaru') ||
    s.includes('palembang') ||
    s.includes('lampung') ||
    s.includes('jambi') ||
    s.includes('bengkulu') ||
    s.includes('bali') ||
    s.includes('denpasar') ||
    s.includes('badung') ||
    s.includes('lombok') ||
    s.includes('mataram') ||
    s.includes('ntb') ||
    s.includes('ntt') ||
    s.includes('kupang')
  ) {
    return { zoneName: 'Sumatera & Bali/Nusa Tenggara', multiplier: 1.9, etdBase: '2-4 hari', etdExpress: '1-2 hari' };
  }

  // Zone 2: Jawa Barat, Jawa Tengah, Jawa Timur, DIY (Luar Jabodetabek)
  if (
    s.includes('jawa') ||
    s.includes('bandung') ||
    s.includes('semarang') ||
    s.includes('surabaya') ||
    s.includes('yogyakarta') ||
    s.includes('solo') ||
    s.includes('malang') ||
    s.includes('cirebon') ||
    s.includes('sukabumi') ||
    s.includes('tasikmalaya') ||
    s.includes('banyuwangi')
  ) {
    return { zoneName: 'Pulau Jawa (Luar Jabodetabek)', multiplier: 1.1, etdBase: '2-3 hari', etdExpress: '1 hari' };
  }

  // Zone 1: Jabodetabek (Jakarta, Tangerang, Bekasi, Depok, Bogor, Banten)
  return { zoneName: 'Jabodetabek & Banten', multiplier: 0.6, etdBase: '1-2 hari', etdExpress: '1 hari' };
}

function getMockShippingCosts(
  weight: number,
  destinationTarget: string,
  courier?: string
): ShippingCostOption[] {
  const kg = Math.max(1, Math.ceil(weight / 1000));
  const zone = detectIndonesianZone(destinationTarget);

  const baseJneReg = Math.round(18000 * zone.multiplier);
  const baseJneYes = Math.round(32000 * zone.multiplier);
  const baseSicepatReg = Math.round(16000 * zone.multiplier);
  const baseSicepatBest = Math.round(29000 * zone.multiplier);
  const baseJntEz = Math.round(17000 * zone.multiplier);

  const all: ShippingCostOption[] = [
    {
      name: 'JNE',
      code: 'jne',
      service: 'REG',
      description: `Layanan Reguler (${zone.zoneName})`,
      cost: baseJneReg * kg,
      etd: zone.etdBase,
    },
    {
      name: 'JNE',
      code: 'jne',
      service: 'YES',
      description: `Yakin Esok Sampai (${zone.zoneName})`,
      cost: baseJneYes * kg,
      etd: zone.etdExpress,
    },
    {
      name: 'SiCepat',
      code: 'sicepat',
      service: 'REG',
      description: `Reguler Service (${zone.zoneName})`,
      cost: baseSicepatReg * kg,
      etd: zone.etdBase,
    },
    {
      name: 'SiCepat',
      code: 'sicepat',
      service: 'BEST',
      description: `Besok Sampai Tujuan (${zone.zoneName})`,
      cost: baseSicepatBest * kg,
      etd: zone.etdExpress,
    },
    {
      name: 'J&T',
      code: 'jnt',
      service: 'EZ',
      description: `Reguler Service (${zone.zoneName})`,
      cost: baseJntEz * kg,
      etd: zone.etdBase,
    },
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

  // If no API Key configured, fallback to smart zone-aware mock search
  if (!API_KEY) {
    const destId = 70000 + (hashString(q) % 25000);
    const result: ShippingDestination[] = [
      {
        id: destId,
        label: `${keyword}, Lokasi Terpilih (Komerce RajaOngkir)`,
        district_name: keyword,
        city_name: keyword,
        province_name: keyword,
      },
    ];
    destinationRegistry.set(String(destId), result[0]);
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
        label:
          item.label ||
          `${item.subdistrict_name || item.district_name || ''}, ${item.city_name || ''}, ${item.province_name || ''}`.trim(),
        subdistrict_name: item.subdistrict_name,
        district_name: item.district_name,
        city_name: item.city_name,
        province_name: item.province_name,
        zip_code: item.zip_code,
      }));

      // Register into lookup
      list.forEach((d) => {
        destinationRegistry.set(String(d.id), d);
      });
    }

    destinationCache.set(q, { data: list, ts: Date.now() });
    return list;
  } catch (err) {
    console.error('[RajaOngkir] Search destination error:', err);
    const destId = 70000 + (hashString(q) % 25000);
    const fallbackList = [
      {
        id: destId,
        label: `${keyword}, Lokasi Terpilih (Fallback RajaOngkir)`,
        district_name: keyword,
        city_name: 'Tujuan',
        province_name: 'Indonesia',
      },
    ];
    destinationRegistry.set(String(destId), fallbackList[0]);
    return fallbackList;
  }
}

// ─── Calculate Domestic Cost ────────────────────────────────
export async function calculateDomesticCost(params: {
  destination: number | string;
  weight: number;
  courier?: string;
  destinationLabel?: string;
  province?: string;
  city?: string;
}): Promise<ShippingCostOption[]> {
  const origin = ORIGIN_ID;
  const destination = String(params.destination);
  const weight = Math.max(1, Number(params.weight) || 500);
  const requestedCourier = params.courier || 'all';

  // Find destination details from registry or params for zone detection
  const registeredDest = destinationRegistry.get(destination);
  const contextString = [
    params.province,
    params.city,
    params.destinationLabel,
    registeredDest?.province_name,
    registeredDest?.city_name,
    registeredDest?.district_name,
    registeredDest?.label,
    destination,
  ]
    .filter(Boolean)
    .join(' ');

  // If no API Key configured, return smart zone-aware mock shipping options
  if (!API_KEY) {
    return getMockShippingCosts(weight, contextString, requestedCourier);
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
          if (Array.isArray(item.costs)) {
            const courierName = item.name || item.code || c.toUpperCase();
            const courierCode = (item.code || c).toLowerCase();
            for (const costItem of item.costs) {
              const costVal =
                Array.isArray(costItem.cost) && costItem.cost[0]
                  ? Number(costItem.cost[0].value)
                  : Number(costItem.cost || 0);
              const etdVal =
                Array.isArray(costItem.cost) && costItem.cost[0]?.etd
                  ? String(costItem.cost[0].etd)
                  : String(costItem.etd || '2-3');
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

  // If external call returned options, return them; otherwise fallback to smart zone-aware mock
  if (allResults.length > 0) {
    return allResults;
  }

  return getMockShippingCosts(weight, contextString, requestedCourier);
}