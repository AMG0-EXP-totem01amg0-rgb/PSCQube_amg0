import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";

// Load environment variables in development
dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with generous limit
app.use(express.json({ limit: "50mb" }));

// Helper to initialize Google Sheets Client
function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Handle escape sequences in private key
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error(
      "Configuración de Google Sheets incompleta. " +
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
app.get("/api/sheets/status", (req, res) => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  res.json({
    configured: !!(email && key && sheetId),
    email: email ? `${email.substring(0, 5)}...` : null,
    sheetId: sheetId ? `${sheetId.substring(0, 10)}...` : null,
    hasKey: !!key,
  });
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
            rowObj[header] = val;
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
              rowObj[header] = val;
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
          if (typeof item[key] !== "object" && item[key] !== undefined && item[key] !== null) {
            headersSet.add(key);
          }
        });
      });

      const headers = Array.from(headersSet);

      const rows = data.map((item: any) => {
        return headers.map((header) => {
          const val = item[header];
          return val === undefined || val === null ? "" : val;
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
  if (process.env.NODE_ENV !== "production") {
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
