const readCache: Record<string, { timestamp: number; data: any[] }> = {};

export const MASTER_TABLES = [
  "TURNOSV2",
  "PALETIZADORAV2",
  "ENSACADORAV2",
  "HACSV2",
  "CAUSASV2",
  "MATERIALESV2",
  "CAPACIDADESV2",
  "USUARIOSV2",
  "EMPRESASV2",
  "PUNTOS_CARGAV2",
  "PROVEEDORES_BOLSAV2",
  "VEHICULOSV2"
];

export const MASTER_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const OPERATIONAL_TTL_MS = 10000; // 10 seconds (optimized from 6s)

export function getCachedData(table: string, customCacheKey?: string): any[] | null {
  const upperTable = table.toUpperCase();
  const keyToUse = customCacheKey ? customCacheKey.toUpperCase() : upperTable;
  
  const cached = readCache[keyToUse];
  if (cached) {
    const isMaster = MASTER_TABLES.includes(upperTable);
    const ttl = isMaster ? MASTER_TTL_MS : OPERATIONAL_TTL_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }
  return null;
}

export function setCachedData(table: string, data: any[], customCacheKey?: string): void {
  const upperTable = table.toUpperCase();
  const keyToUse = customCacheKey ? customCacheKey.toUpperCase() : upperTable;
  
  readCache[keyToUse] = {
    timestamp: Date.now(),
    data
  };
}

export function invalidateCache(table: string): void {
  const upper = table.toUpperCase();
  
  // Borrar todas las entradas cuyo prefijo sea el nombre de la tabla
  // Esto limpia cachés como PAROSV2 y PAROSV2_{"date":"2026-09-09"}
  for (const key of Object.keys(readCache)) {
    if (key.startsWith(upper)) {
      delete readCache[key];
    }
  }
  
  if (upper === "PRODUCCIONV2") {
    for (const key of Object.keys(readCache)) {
      if (key.startsWith("PAROS_BOQUILLASV2") || key.startsWith("DETALLES_PRODUCCIONV2")) {
        delete readCache[key];
      }
    }
  } else if (upper === "PAROS_BOQUILLASV2" || upper === "DETALLES_PRODUCCIONV2") {
    for (const key of Object.keys(readCache)) {
      if (key.startsWith("PRODUCCIONV2")) {
        delete readCache[key];
      }
    }
  }
}

export function clearAllCache(): void {
  for (const key of Object.keys(readCache)) {
    delete readCache[key];
  }
}

