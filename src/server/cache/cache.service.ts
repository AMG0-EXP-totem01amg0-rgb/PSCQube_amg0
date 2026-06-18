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

export function getCachedData(table: string): any[] | null {
  const upperTable = table.toUpperCase();
  const cached = readCache[upperTable];
  if (cached) {
    const isMaster = MASTER_TABLES.includes(upperTable);
    const ttl = isMaster ? MASTER_TTL_MS : OPERATIONAL_TTL_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
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
