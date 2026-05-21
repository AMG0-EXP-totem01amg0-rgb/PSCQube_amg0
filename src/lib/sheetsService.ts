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

/**
 * Sync Table Data
 * Sends local data to Google Sheets via secure Express endpoint.
 * The sheets/tables end with V2 as requested (PALETIZADORAV2, ENSACADORAV2, etc.).
 */
export async function syncTableToSheets(tableName: string, data: any[]): Promise<boolean> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

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
      throw new Error(errorResponse.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error(`Error syncing table ${sheetName} to Google Sheets:`, error);
    return false;
  }
}

/**
 * Fetch Table Data from Google Sheets
 */
export async function fetchTableFromSheets(tableName: string): Promise<any[] | null> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) {
    sheetName = `${sheetName}V2`;
  }

  try {
    const url = `/api/sheets?table=${sheetName}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      throw new Error(errorResponse.error || `HTTP error ! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching table ${sheetName} from Google Sheets:`, error);
    return null;
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
