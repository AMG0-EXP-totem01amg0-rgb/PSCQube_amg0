import express from "express";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

// Load environment variables in development
dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with generous limit
app.use(express.json({ limit: "50mb" }));

// Robust helper to sanitize and parse the service account private key
function cleanPrivateKey(key: string): string {
  if (!key) return "";
  let cleaned = key.trim();
  
  // Try parsing as JSON first, in case the user pasted the entire Service Account JSON credentials
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      if (parsed.private_key) {
        cleaned = parsed.private_key.trim();
      }
    }
  } catch (e) {
    // If it's not a JSON string, continue with raw PEM string processing
  }

  // Strip surrounding quotes and spaces repeatedly if nested
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // Replace literal string "\n" (backslash + n) with actual newline character
  // and handle double-escaped or other common formatting artifacts
  cleaned = cleaned.replace(/\\n/g, "\n");
  cleaned = cleaned.replace(/\\r/g, "\r");
  
  return cleaned;
}

// Helper to initialize Google Sheets Client
function getSheetsClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Try extracting from full JSON credentials if pasted inside GOOGLE_SERVICE_ACCOUNT_KEY
  try {
    const parsed = JSON.parse(rawKey.trim());
    if (parsed && typeof parsed === "object") {
      if (parsed.private_key) {
        rawKey = parsed.private_key;
      }
      if (parsed.client_email && !email) {
        email = parsed.client_email;
      }
    }
  } catch (e) {
    // Treat as raw PEM string or key
  }

  const privateKey = cleanPrivateKey(rawKey);

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error(
      "Configuración de Google Sheets incompleta o inválida. " +
      "Por favor defina GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY y GOOGLE_SHEET_ID en las variables de entorno de Vercel."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

// Ensure sheet exists; if not, create it
async function ensureSheetExists(sheets: any, spreadsheetId: string, tableName: string): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = response.data.sheets?.map((s: any) => s.properties?.title) || [];
    
    if (sheetNames.includes(tableName)) {
      return true;
    }

    // Create the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tableName,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error(`Error ensuring sheet existence for ${tableName}:`, error);
    return false;
  }
}

// API Routes
app.get("/api/sheets/status", async (req, res) => {
  try {
    let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // Support JSON parsing of the service account credential file for full backward compatibility
    let isJsonConfigured = false;
    try {
      if (rawKey.trim().startsWith("{")) {
        const parsed = JSON.parse(rawKey.trim());
        if (parsed && typeof parsed === "object") {
          isJsonConfigured = true;
          if (parsed.private_key) {
            rawKey = parsed.private_key;
          }
          if (parsed.client_email && !email) {
            email = parsed.client_email;
          }
        }
      }
    } catch (e) {
      // Treat as raw key
    }

    const key = rawKey;

    const diagnostics: any = {
      envVariables: {
        hasEmail: !!email,
        hasKey: !!key,
        hasSheetId: !!sheetId,
        isJsonConfigured,
      },
      keyDetails: null,
      connectionTest: null,
    };

    if (email) {
      diagnostics.emailPreview = email;
    }
    if (sheetId) {
      diagnostics.sheetIdPreview = sheetId;
    }

    if (key) {
      const rawLength = key.length;
      const cleaned = cleanPrivateKey(key);
      const cleanedLength = cleaned.length;
      const hasBegin = cleaned.includes("-----BEGIN PRIVATE KEY-----");
      const hasEnd = cleaned.includes("-----END PRIVATE KEY-----");
      const newlineCount = (cleaned.match(/\n/g) || []).length;
      
      diagnostics.keyDetails = {
        rawLength,
        cleanedLength,
        hasBeginHeader: hasBegin,
        hasEndFooter: hasEnd,
        newlineCountInCleaned: newlineCount,
        advice: "",
      };

      if (!hasBegin || !hasEnd) {
        diagnostics.keyDetails.advice = "La clave privada cargada en las variables de entorno de Vercel no tiene las cabeceras PEM estándar de Google. Debe comenzar con '-----BEGIN PRIVATE KEY-----' y terminar con '-----END PRIVATE KEY-----'. Asegúrate de que no haya faltado copiar ninguna sección.";
      } else if (newlineCount < 5) {
        diagnostics.keyDetails.advice = "La clave contiene muy pocos saltos de línea (" + newlineCount + ") en total. Generalmente, una clave JWT PEM válida de Google tiene más de 20 líneas con saltos de línea reales o representados por '\\n'. Intenta copiar la clave directa del JSON original descargado de Google";
      }
    }

    // Live Connection Dry-Run using Sheets SDK
    if (email && key && sheetId) {
      try {
        const { sheets, spreadsheetId } = getSheetsClient();
        const testRes = await sheets.spreadsheets.get({
          spreadsheetId,
          fields: "properties.title,sheets.properties.title",
        });
        diagnostics.connectionTest = {
          success: true,
          title: testRes.data.properties?.title || "Sin título",
          sheetsFound: testRes.data.sheets?.map((s: any) => s.properties?.title) || [],
        };
      } catch (testErr: any) {
        const errMsg = testErr.message || testErr.toString();
        let hint = "Error de conexión o autenticación con Google API.";

        if (errMsg.includes("PEM_read_bio_PrivateKey") || errMsg.includes("private key") || errMsg.includes("FormatError") || errMsg.includes("key is too short")) {
          hint = "La clave privada tiene un formato criptográfico incorrecto. Verifica que no hayas introducido espacios adicionales y que no estén duplicados los escapes. En Vercel, pega la clave completa con sus '\\n' originales.";
        } else if (errMsg.includes("invalid_grant") || errMsg.includes("signature") || errMsg.includes("JWT")) {
          hint = "Error de firma JWT (invalid_grant). El correo del Service Account y la clave privada no coinciden, o estás usando una clave de otro proyecto de Google Cloud.";
        } else if (errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("Requested entity was not found")) {
          hint = "No se encuentra el Documento de Google Sheets. El GOOGLE_SHEET_ID ingresado no existe o es incorrecto. Confírmalo mirando el ID en la URL de tu navegador.";
        } else if (errMsg.includes("permission") || errMsg.includes("403") || errMsg.includes("caller does not have permission") || errMsg.includes("unauthorized")) {
          hint = "La cuenta de servicio no tiene permisos en esta planilla. Debes ir a Google Sheets, hacer clic en 'Compartir' (Share) en la esquina superior derecha, agregar el correo '" + email + "' y asignarle el rol de editor.";
        }

        diagnostics.connectionTest = {
          success: false,
          error: errMsg,
          hint,
        };
      }
    }

    res.json({
      configured: !!(email && key && sheetId),
      email: email ? `${email.substring(0, Math.min(email.length, 12))}...` : null,
      sheetId: sheetId ? `${sheetId.substring(0, Math.min(sheetId.length, 12))}...` : null,
      hasKey: !!key,
      diagnostics
    });
  } catch (error: any) {
    console.error("Global crash in status endpoint:", error);
    // Respond with status 200 but include detailed configuration payload so page loads fine, showing diagnostic details!
    res.json({
      configured: false,
      error: error.message || error.toString(),
      stack: error.stack,
      diagnostics: {
        envVariables: {
          hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          hasKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        },
        connectionTest: {
          success: false,
          error: error.message || error.toString(),
          hint: "Falla global en el servidor. Revisa si la clave privada contiene caracteres inválidos que causan errores de sintaxis en el motor de criptografía."
        }
      }
    });
  }
});

// GET Endpoint to read table
app.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    
    // Ensure sheet exists before reading
    await ensureSheetExists(sheets, spreadsheetId, table);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${table}!A1:Z50000`,
      });

      const rows = response.data.values;
      if (!rows || rows.length < 1) {
        return res.json({ success: true, data: [] });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      // Map rows to array of JSON objects
      const list = dataRows.map((row) => {
        const rowObj: any = {};
        let hasValidValue = false;
        
        headers.forEach((header, index) => {
          if (header) {
            const val = row[index] !== undefined ? row[index] : "";
            if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
              try {
                rowObj[header] = JSON.parse(val);
              } catch (e) {
                rowObj[header] = val;
              }
            } else {
              rowObj[header] = val;
            }
            if (val !== "") {
              hasValidValue = true;
            }
          }
        });
        
        return hasValidValue ? rowObj : null;
      }).filter((item) => item !== null);

      return res.json({ success: true, data: list });
    } catch (readError: any) {
      // If range is invalid/sheet empty, return empty array
      if (readError.message?.includes("range")) {
        return res.json({ success: true, data: [] });
      }
      throw readError;
    }
  } catch (error: any) {
    console.error(`Error reading sheet ${table}:`, error);
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// POST Endpoint to read/write tables
app.post("/api/sheets", async (req, res) => {
  const { action, table, data } = req.body;

  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  try {
    const { sheets, spreadsheetId } = getSheetsClient();

    // Handle READ action via POST
    if (action === "read") {
      await ensureSheetExists(sheets, spreadsheetId, table);
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${table}!A1:Z50000`,
        });

        const rows = response.data.values;
        if (!rows || rows.length < 1) {
          return res.json({ success: true, data: [] });
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        const list = dataRows.map((row) => {
          const rowObj: any = {};
          let hasValidValue = false;
          headers.forEach((header, index) => {
            if (header) {
              const val = row[index] !== undefined ? row[index] : "";
              if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
                try {
                  rowObj[header] = JSON.parse(val);
                } catch (e) {
                  rowObj[header] = val;
                }
              } else {
                rowObj[header] = val;
              }
              if (val !== "") {
                hasValidValue = true;
              }
            }
          });
          return hasValidValue ? rowObj : null;
        }).filter((item) => item !== null);

        return res.json({ success: true, data: list });
      } catch (readError: any) {
        if (readError.message?.includes("range")) {
          return res.json({ success: true, data: [] });
        }
        throw readError;
      }
    }

    // Handle WRITE action
    if (action === "write") {
      await ensureSheetExists(sheets, spreadsheetId, table);

      // Clear existing values
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${table}!A1:Z50000`,
      });

      if (!data || data.length === 0) {
        return res.json({ success: true, message: "Sheet cleared successfully." });
      }

      // Build spreadsheet headers dynamically from raw data keys
      const headersSet = new Set<string>();
      data.forEach((item: any) => {
        Object.keys(item).forEach((key) => {
          if (item[key] !== undefined && item[key] !== null) {
            headersSet.add(key);
          }
        });
      });

      const headers = Array.from(headersSet);

      const rows = data.map((item: any) => {
        return headers.map((header) => {
          const val = item[header];
          if (val === undefined || val === null) return "";
          if (typeof val === "object") {
            try {
              return JSON.stringify(val);
            } catch (e) {
              return "";
            }
          }
          return val;
        });
      });

      const values = [headers, ...rows];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${table}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });

      return res.json({ success: true, count: data.length });
    }

    return res.status(400).json({ success: false, error: `Acción inválida: ${action}` });
  } catch (error: any) {
    console.error(`Error in sheets action for ${table}:`, error);
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Vite Setup & Routing
async function startServer() {
  if (process.env.VERCEL) {
    console.log("Running in Vercel serverless environment. Dynamic port listening is bypassed.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
