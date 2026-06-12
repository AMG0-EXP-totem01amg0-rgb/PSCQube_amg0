const readCache: Record<string, { timestamp: number; data: any[] }> = {};
export const CACHE_TTL_MS = 6000;

export function getCachedData(table: string): any[] | null {
  const upperTable = table.toUpperCase();
  const cached = readCache[upperTable];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedData(table: string, data: any[]): void {
  const upperTable = table.toUpperCase();
  readCache[upperTable] = {
    timestamp: Date.now(),
    data
  };
}

export function invalidateCache(table: string): void {
  const upper = table.toUpperCase();
  delete readCache[upper];
  if (upper === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
    delete readCache["DETALLES_PRODUCCIONV2"];
  } else if (upper === "PAROS_BOQUILLASV2" || upper === "DETALLES_PRODUCCIONV2") {
    delete readCache["PRODUCCIONV2"];
  }
}

export function clearAllCache(): void {
  for (const key of Object.keys(readCache)) {
    delete readCache[key];
  }
}
