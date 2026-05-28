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

/**
 * Reads cached data for a given table from sessionStorage.
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
 * Saves table data into sessionStorage.
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
 * Clears cached data from sessionStorage for a specific table or all.
 */
export function clearClientCache(tableName?: string): void {
  try {
    if (tableName) {
      const sheetName = tableName.toUpperCase();
      const keysToClear = [sheetName, sheetName.endsWith('V2') ? sheetName : `${sheetName}V2`];
      keysToClear.forEach(k => {
        sessionStorage.removeItem(CACHE_PREFIX + k);
      });

      // Special dependency invalidation: PAROSV2, PRODUCCIONV2 and PAROS_BOQUILLASV2 are closely linked on calculations
      if (sheetName.includes("PARO") || sheetName.includes("PRODUC") || sheetName.includes("BOQUILLA")) {
        sessionStorage.removeItem(CACHE_PREFIX + "PAROSV2");
        sessionStorage.removeItem(CACHE_PREFIX + "PRODUCCIONV2");
        sessionStorage.removeItem(CACHE_PREFIX + "PAROS_BOQUILLASV2");
      }
    } else {
      // Clear all related prefix keys
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          sessionStorage.removeItem(key);
          i--; // offset index shift
        }
      }
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
        data: data
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
export async function fetchTableFromSheets(tableName: string, forceBypass = false): Promise<FetchResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  // Optimize: Try loading from browser / explorer sessionStorage cache first
  if (!forceBypass) {
    const cached = getCachedData(sheetName);
    if (cached) {
      console.log(`[Client Cache Hit] Loaded table ${sheetName} from sessionStorage`);
      return { success: true, data: cached };
    }
  }

  try {
    const url = `/api/sheets?table=${sheetName}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      // Warm browser cache
      setCachedData(sheetName, result.data);
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
