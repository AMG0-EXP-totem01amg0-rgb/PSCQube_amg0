/**
 * Google Sheets Service (V2)
 * Handles reading and writing data to/from Google Sheets securely via the full-stack server.
 * This ensures credentials (private key, email, etc.) are hidden safely on the backend.
 */

export const getSheetsApiUrl = (): string => {
  return '/api/sheets';
};

/**
 * Connected state check.
 * Since the frontend proxies requests to the Express server, connection capabilities are always live
 * and will secure credentials through environment variables on Vercel.
 */
export const isSheetsConnected = (): boolean => {
  return true;
};

/**
 * Read the current Google Sheets credentials configuration status from the backend.
 */
export async function getBackendSheetsStatus(): Promise<{
  configured: boolean;
  email: string | null;
  sheetId: string | null;
  hasKey: boolean;
}> {
  try {
    const response = await fetch('/api/sheets/status');
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.error("Error reading sheets status from server:", e);
  }
  return { configured: false, email: null, sheetId: null, hasKey: false };
}

export interface SyncResult {
  success: boolean;
  error?: string;
}

export interface FetchResult {
  success: boolean;
  data?: any[];
  error?: string;
}

const CACHE_PREFIX = "app_table_cache_v2_";

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

/**
 * Reads cached data for a given table from browser localStorage or sessionStorage.
 */
function getBrowserCache(tableName: string, filters?: { date?: string; shiftId?: string; palletizerId?: string }): any[] | null {
  try {
    let key = `app_cache_v2_${tableName.toUpperCase()}`;
    if (filters && filters.date) {
      key += `_${filters.date}`;
    }
    const value = localStorage.getItem(key);
    if (!value) return null;
    
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.data)) return null;

    const isMaster = MASTER_TABLES.includes(tableName.toUpperCase());
    // 30 minutes for master tables, 12 hours for operational tables to eliminate automatic background refetches
    const ttl = isMaster ? 30 * 60 * 1000 : 12 * 60 * 60 * 1000;
    
    if (Date.now() - parsed.timestamp < ttl) {
      return parsed.data;
    }
  } catch (err) {
    console.warn("Error reading cache for " + tableName, err);
  }
  return null;
}

/**
 * Saves table data into local browser cache.
 */
function setBrowserCache(tableName: string, data: any[], filters?: { date?: string; shiftId?: string; palletizerId?: string }): void {
  try {
    let key = `app_cache_v2_${tableName.toUpperCase()}`;
    if (filters && filters.date) {
      key += `_${filters.date}`;
    }
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (err) {
    console.warn("Error writing cache for " + tableName, err);
  }
}

/**
 * Reads cached data for a given table from sessionStorage (temporary legacy support).
 */
function getCachedData(tableName: string): any[] | null {
  try {
    const key = CACHE_PREFIX + tableName.toUpperCase();
    const item = sessionStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (err) {
    console.warn("[Client Cache Read Error]", err);
  }
  return null;
}

/**
 * Saves table data into sessionStorage (temporary legacy support).
 */
function setCachedData(tableName: string, data: any[]): void {
  try {
    const key = CACHE_PREFIX + tableName.toUpperCase();
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn("[Client Cache Write Error]", err);
  }
}

/**
 * Clears cached data from sessionStorage and localStorage.
 */
export function clearClientCache(tableName?: string): void {
  try {
    if (tableName) {
      const sheetName = tableName.toUpperCase();
      const keysToClear = [sheetName, sheetName.endsWith('V2') ? sheetName : `${sheetName}V2`];
      keysToClear.forEach(k => {
        localStorage.removeItem(`app_cache_v2_${k}`);
        sessionStorage.removeItem(CACHE_PREFIX + k);
        if (k === "CAUSASV2") {
          localStorage.removeItem("app_causas_v2_local_cache");
          localStorage.removeItem("app_causas_v2_local_cache_time");
        }
      });

      // Special dependency invalidation: PAROSV2, PRODUCCIONV2 and PAROS_BOQUILLASV2 are closely linked on calculations
      if (sheetName.includes("PARO") || sheetName.includes("PRODUC") || sheetName.includes("BOQUILLA")) {
        localStorage.removeItem(`app_cache_v2_PAROSV2`);
        localStorage.removeItem(`app_cache_v2_PRODUCCIONV2`);
        localStorage.removeItem(`app_cache_v2_PAROS_BOQUILLASV2`);
        sessionStorage.removeItem(CACHE_PREFIX + "PAROSV2");
        sessionStorage.removeItem(CACHE_PREFIX + "PRODUCCIONV2");
        sessionStorage.removeItem(CACHE_PREFIX + "PAROS_BOQUILLASV2");
      }
    } else {
      // Clear all related prefix keys
      const keysToClearL: string[] = [];
      const keysToClearS: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("app_cache_v2_") || key.startsWith("app_causas_v2"))) {
          keysToClearL.push(key);
        }
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToClearS.push(key);
        }
      }

      keysToClearL.forEach(k => localStorage.removeItem(k));
      keysToClearS.forEach(k => sessionStorage.removeItem(k));
    }
  } catch (err) {
    console.warn("[Client Cache Clear Error]", err);
  }
}

/**
 * Sync Table Data
 * Sends local data to Google Sheets via secure Express endpoint.
 * The sheets/tables end with V2 as requested (PALETIZADORAV2, ENSACADORAV2, etc.).
 */
export async function syncTableToSheets(tableName: string, data: any[]): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Invalidate cache immediately on change
  clearClientCache(sheetName);

  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'write',
        table: sheetName,
        data: data,
        allowDeleteMissing: true
      })
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    console.error(`Error syncing table ${sheetName} to Google Sheets:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Fetch Table Data from Google Sheets
 */
export async function fetchTableFromSheets(
  tableName: string, 
  forceBypass = false,
  filters?: { date?: string; shiftId?: string; palletizerId?: string },
  source = "unspecified"
): Promise<FetchResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Guard visibility for operational queries: Do not call remote endpoints if tab is inactive/hidden in browser background
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    console.log(`[Visibility Guard Check] Thread blocked network fetch for ${sheetName} since user tab is hidden/backgrounded.`);
    const cachedCombined = getBrowserCache(sheetName, filters);
    if (cachedCombined) {
      return { success: true, data: cachedCombined };
    }
    return { success: true, data: [] };
  }

  const isMaster = MASTER_TABLES.includes(sheetName);
  const isForcedManual = (window as any).forceRefreshMasters === true;

  // Optimize: Check local cached data first. Under normal flows or intervals, 
  // we do not fetch master tables if their browser cache is still active (30 mins).
  if (!isForcedManual && !forceBypass) {
    const cached = getBrowserCache(sheetName, filters);
    if (cached) {
      console.log(`[Browser Cache Hit] Loaded table ${sheetName} (isMaster: ${isMaster})`);
      return { success: true, data: cached };
    }
  }

  try {
    let queryParams = "";
    if (forceBypass || isForcedManual) {
      queryParams += "bypassCache=true&";
    }
    if (filters) {
      if (filters.date) queryParams += `date=${encodeURIComponent(filters.date)}&`;
    }
    queryParams += `source=${encodeURIComponent(source)}&`;
    if (queryParams.endsWith("&")) {
      queryParams = queryParams.slice(0, -1);
    }

    // If it's a specialized endpoint (produccion / paros), we can hit that instead for performance!
    let url = `/api/sheets?table=${sheetName}${queryParams ? '&' + queryParams : ''}`;
    if (sheetName === "PRODUCCIONV2") {
      url = `/api/produccion${queryParams ? '?' + queryParams : ''}`;
    } else if (sheetName === "PAROSV2") {
      url = `/api/paros${queryParams ? '?' + queryParams : ''}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      setBrowserCache(sheetName, result.data, filters);
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error || "Formato de respuesta inválido" };
  } catch (error: any) {
    console.error(`Error fetching table ${sheetName} from Google Sheets:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Insert a single record into Google Sheets precisely (using append on Row 2 onward)
 */
export async function createRecordInSheets(tableName: string, item: any): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Invalidate cache immediately on change
  clearClientCache(sheetName);

  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        table: sheetName,
        item: item
      })
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    console.error(`Error creating record in ${sheetName}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Update a single record in Google Sheets precisely by finding its ID row
 */
export async function updateRecordInSheets(tableName: string, id: string, item: any): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Invalidate cache immediately on change
  clearClientCache(sheetName);

  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        table: sheetName,
        id: id,
        item: item
      })
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    console.error(`Error updating record in ${sheetName}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Delete a single record in Google Sheets precisely from its matching row
 */
export async function deleteRecordInSheets(tableName: string, id: string): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Invalidate cache immediately on change
  clearClientCache(sheetName);

  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        table: sheetName,
        id: id
      })
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    console.error(`Error deleting record in ${sheetName}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Help text with environment variables explanation for Vercel.
 */
export const VERCEL_SETUP_GUIDE = `### CONFIGURACIÓN DE VARIABLES DE ENTORNO EN VERCEL

Para que la aplicación funcione en tiempo real con Google Sheets, debes agregar las siguientes variables de entorno en el panel de control de Vercel (Settings > Environment Variables):

1. **GOOGLE_SERVICE_ACCOUNT_EMAIL**
   - El correo electrónico de la cuenta de servicio que creaste en Google Cloud Console.
   - Ejemplo: \`mi-servicio@nombre-proyecto.iam.gserviceaccount.com\`

2. **GOOGLE_SERVICE_ACCOUNT_KEY**
   - La clave privada JWT completa de la cuenta de servicio (formato JSON creado en GCP).
   - Debe incluir desde \`-----BEGIN PRIVATE KEY-----\\n\` hasta \`\\n-----END PRIVATE KEY-----\\n\`.
   - Consejo: Al pegarla en Vercel, puedes copiar el valor exacto de la clave del JSON descargado de Google.

3. **GOOGLE_SHEET_ID**
   - El identificador único de tu documento de Google Sheets (se encuentra en la URL del navegador).
   - Ejemplo: Si la URL es \`https://docs.google.com/spreadsheets/d/1aBC_deFGhiJKlmNoPQRSt/edit#gid=0\`, el ID es \`1aBC_deFGhiJKlmNoPQRSt\`.

⚠️ **IMPORTANTE:** Recuerda compartir tu documento de Google Sheet con el correo de la cuenta de servicio (\`GOOGLE_SERVICE_ACCOUNT_EMAIL\`) con permisos de **Editor** para que el sistema pueda leer y escribir.
`;

/**
 * Preloads all master catalogs from the backend in a single efficient HTTP request,
 * storing them directly into the new browser-side cache.
 */
export async function preloadMasterCatalogs(bypassCache = false, source = "unspecified"): Promise<FetchResult> {
  try {
    const url = `/api/catalogos?bypassCache=${bypassCache ? 'true' : 'false'}&source=${encodeURIComponent(source)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    if (result.success && result.data) {
      Object.entries(result.data).forEach(([tableName, rows]) => {
        setBrowserCache(tableName, rows as any[]);
      });
      return { success: true, data: [] };
    }
    return { success: false, error: result.error || "Formato inválido en precarga" };
  } catch (err: any) {
    console.error("Error preloading master catalogs:", err);
    return { success: false, error: err.message || String(err) };
  }
}
