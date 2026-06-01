import express from "express";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables in development
dotenv.config();

const app = express();
const PORT = 3000;

// Supabase lazy client initialization
let supabaseClient: any = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      // Auto-sanitize the URL to prevent /rest/v1/ invalid path errors
      supabaseUrl = supabaseUrl.trim().replace(/\/+$/, ""); // Remove trailing slashes
      if (supabaseUrl.toLowerCase().endsWith("/rest/v1")) {
        supabaseUrl = supabaseUrl.slice(0, -8);
      }
      supabaseUrl = supabaseUrl.trim().replace(/\/+$/, ""); // Remove trailing slashes again

      if (supabaseUrl.includes("/dashboard") || supabaseUrl.includes("/project/")) {
        console.error(`
🚨 [Supabase Configuration Error] 🚨
Your SUPABASE_URL is configured with the Dashboard/Studio URL: "${supabaseUrl}".
This is why you are receiving HTML elements instead of API responses.
Please update SUPABASE_URL to your Project API URL, which looks like: https://xxxx.supabase.co
--------------------------------------------------`);
        return null;
      }
      console.log(`[Supabase v2] Auto-initializing client for sanitized URL: ${supabaseUrl}`);
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn(`[Supabase v2] Missing SUPABASE_URL or SUPABASE_KEY. Supabase operations will be skipped.`);
    }
  }
  return supabaseClient;
}

// Convert a column name to lowercase, alphanumeric, with accents stripped and spaces/symbols transformed to underscores
function sanitizeColumnName(col: string): string {
  // convert camelCase to snake_case first (e.g., durationHours -> duration_hours)
  const withUnder = col.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const result = withUnder
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9_]/g, "_")    // replace spaces, ?, symbols with _
    .replace(/__+/g, "_")           // deduplicate underscores
    .replace(/^_+|_+$/g, "");       // trim leading/trailing underscores
  if (result === "rendimineto") {
    return "rendimiento";
  }
  return result;
}

function safeMatch(idA: any, idB: any): boolean {
  if (idA === undefined || idA === null || idB === undefined || idB === null) return false;
  return String(idA).trim() === String(idB).trim();
}

function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  let strA = String(hacA).trim().toUpperCase();
  let strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  // 1. Direct match
  if (strA === strB) return true;

  // 2. Clear alphanumeric match
  const cleanA = strA.replace(/[^A-Z0-9]/g, '');
  const cleanB = strB.replace(/[^A-Z0-9]/g, '');
  if (cleanA === "" || cleanB === "") return false;
  if (cleanA === cleanB) return true;

  // 3. Bidirectional inclusion
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // 4. Prefix/mid comparison by removing "MG" or similar standard prefixes
  const looseA = cleanA.startsWith("MG") ? cleanA.slice(2) : cleanA;
  const looseB = cleanB.startsWith("MG") ? cleanB.slice(2) : cleanB;
  if (looseA === looseB || looseA.includes(looseB) || looseB.includes(looseA)) return true;

  // 5. Split and check numerical similarity (e.g., 672, 673, 674)
  const partsA = strA.split(/[\s.\-_/]+/).filter(Boolean);
  const partsB = strB.split(/[\s.\-_/]+/).filter(Boolean);

  const hasNumA = partsA.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  const hasNumB = partsB.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  
  if (hasNumA && hasNumB) {
    // Check if they share a specific suffix portion (like BT1, PZ1, AM1)
    const suffixA = partsA.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    const suffixB = partsB.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    if (suffixA && suffixB && (suffixA.includes(suffixB) || suffixB.includes(suffixA))) {
      return true;
    }
    // If one is just the group (e.g. 672) and the other is specific (e.g. 672-BT1)
    if (partsA.length === 1 || partsB.length === 1) {
      return true;
    }
  }

  return false;
}

function formatSupabaseError(err: any): string {
  if (!err) return "unknown error";
  if (typeof err === "object") {
    const parts: string[] = [];
    if (err.message) parts.push(`Message: "${err.message}"`);
    if (err.code) parts.push(`Code: "${err.code}"`);
    if (err.details) parts.push(`Details: "${err.details}"`);
    if (err.hint) parts.push(`Hint: "${err.hint}"`);
    if (parts.length === 0) {
      try {
        return JSON.stringify(err);
      } catch (e) {
        return String(err);
      }
    }
    return parts.join(", ");
  }
  return String(err);
}

// Table aliases to gracefully fallback to simple/plural/singular names if the versioned tables are missing in Supabase
const TABLE_ALIASES: Record<string, string[]> = {
  "carga_combustiblev2": ["carga_combustible", "carga_combustibles", "cargas_combustibles", "cargas_combustible"],
  "turnosv2": ["turnos", "turno"],
  "usuariosv2": ["usuarios", "usuario"],
  "cambio_productov2": ["cambio_producto", "cambios_producto", "cambio_productos", "cambios_productos"],
  "parosv2": ["paros", "paro"],
  "produccionv2": ["produccion", "producciones"],
  "punto_cargav2": ["punto_carga", "puntos_carga", "puntos_cargav2"],
  "puntos_cargav2": ["puntos_carga", "punto_carga"],
  "empresasv2": ["empresas", "empresa"],
  "proveedores_bolsav2": ["proveedores_bolsa", "proveedor_bolsa"],
  "vehiculosv2": ["vehiculos", "vehiculo"],
  "capacidadesv2": ["capacidades", "capacidad"]
};

function sanitizeValue(val: any): any {
  if (val === undefined || val === null) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Match percentage value, e.g., "99.3%" or "99.3 %" or "-15.2%"
    const matchPercent = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (matchPercent) {
      const num = parseFloat(matchPercent[1]);
      if (!isNaN(num)) {
        return num;
      }
    }
    return trimmed;
  }
  return val;
}

const BOOLEAN_COLUMNS = new Set([
  "es_punto_de_muestreo",
  "es_fechador",
  "es_balanza",
  "es_pallet",
  "es_productivo",
  "es_insumo",
  "es_bigbag",
  "todo_el_turno",
  "purga",
  "valvula_silo_cerrada",
  "circuito_vaciado",
  "maquina_limpia",
  "tolva_vaciada",
  "silo_cambiado",
  "fechador_actualizado",
  "envase_correcto",
  "dos_big_bags_pal",
  "muestreo_color",
  "muestra_enviada_lab",
  "producto_liberado",
  "habilitada"
]);

function toBoolean(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  return str === 'si' || str === 'sí' || str === 'yes' || str === 'true' || str === '1' || str === 't' || str === 's';
}

function getProcessedValue(colName: string, originalKey: string, val: any): any {
  const cleanCol = sanitizeColumnName(colName);
  const cleanOrig = sanitizeColumnName(originalKey);
  if (BOOLEAN_COLUMNS.has(cleanCol) || BOOLEAN_COLUMNS.has(cleanOrig) || colName.endsWith('?') || originalKey.endsWith('?')) {
    return toBoolean(val);
  }
  const sanitized = sanitizeValue(val);
  return typeof sanitized === "object" ? JSON.stringify(sanitized) : sanitized;
}

function mapItemForSupabase(tableName: string, item: any): Record<string, any> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  const mapped: Record<string, any> = {};

  if (!item) return mapped;

  // For PAROSV2, we must preserve exact quoted column keys from the database schema (e.g., "causa sap", "tipo paro")
  if (schema && upperTable === "PAROSV2") {
    const allowedColumns = new Set<string>(schema.sheetHeaders);
    const tempPayload: Record<string, any> = {};

    // 1. Copy original keys that map directly
    for (const [key, val] of Object.entries(item)) {
      if (val !== undefined && val !== null) {
        if (allowedColumns.has(key)) {
          tempPayload[key] = getProcessedValue(key, key, val);
        }
      }
    }

    // 2. Process schema mappings to find any omitted properties by clientKey or sheet header
    for (const [header, clientKey] of Object.entries(schema.sheetToClient)) {
      let val = item[clientKey];
      if (val === undefined) {
        val = item[header];
      }
      if (val !== undefined && val !== null) {
        tempPayload[header] = getProcessedValue(header, clientKey, val);
      }
    }

    // 3. Keep only columns that present in the strictly allowed database set
    const strictMapped: Record<string, any> = {};
    for (const col of allowedColumns) {
      if (tempPayload[col] !== undefined) {
        strictMapped[col] = tempPayload[col];
      }
    }
    return strictMapped;
  }

  // If a schema exists to enforce database alignment, strictly construct the payload
  // containing only sanitized, valid database columns.
  if (schema) {
    const allowedColumns = new Set<string>();
    for (const header of schema.sheetHeaders) {
      allowedColumns.add(sanitizeColumnName(header));
    }

    const tempPayload: Record<string, any> = {};

    // 1. Copy original keys that map directly to the allowed sanitized columns
    for (const [key, val] of Object.entries(item)) {
      if (val !== undefined && val !== null) {
        const cleanKey = sanitizeColumnName(key);
        if (allowedColumns.has(cleanKey)) {
          tempPayload[cleanKey] = getProcessedValue(cleanKey, key, val);
        }
      }
    }

    // 2. Process schema mappings to find any omitted properties by clientKey or sheet header
    for (const [header, clientKey] of Object.entries(schema.sheetToClient)) {
      const cleanCol = sanitizeColumnName(header);
      
      let val = item[clientKey];
      if (val === undefined) {
        val = item[header];
      }
      if (val === undefined) {
        val = item[cleanCol];
      }

      if (val !== undefined && val !== null) {
        tempPayload[cleanCol] = getProcessedValue(cleanCol, clientKey, val);
      }
    }

    // 3. Keep only columns that present in the strictly allowed database set
    const strictMapped: Record<string, any> = {};
    for (const col of allowedColumns) {
      if (tempPayload[col] !== undefined) {
        strictMapped[col] = tempPayload[col];
      }
    }
    return strictMapped;
  }

  // If no schema exists, fall back to best-effort key sanitization of original item attributes
  for (const [key, val] of Object.entries(item)) {
    if (val !== undefined && val !== null) {
      const cleanKey = sanitizeColumnName(key);
      mapped[cleanKey] = getProcessedValue(cleanKey, key, val);
    }
  }

  return mapped;
}

function mapSupabaseRowToClient(tableName: string, dbRow: any): any {
  if (!dbRow) return {};
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  const clientObj: any = {};

  const processValue = (val: any) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          return trimmed;
        }
      }
      return trimmed;
    }
    return val;
  };

  // 1. Iterate over the schema to prioritize mapping to clientKeys (camelCase keys)
  if (schema) {
    for (const [header, clientKey] of Object.entries(schema.sheetToClient)) {
      const cleanHeader = sanitizeColumnName(header);
      
      // Look up in dbRow with priority:
      // a) clientKey (camelCase)
      // b) header (Sheets literal name)
      // c) cleanHeader (sanitized snake_case)
      let val = dbRow[clientKey];
      if (val === undefined) {
        val = dbRow[header];
      }
      if (val === undefined) {
        val = dbRow[cleanHeader];
      }

      if (val !== undefined && val !== null) {
        clientObj[clientKey] = processValue(val);
      }
    }
  }

  // 2. Plus copy any other keys that are in the database row but weren't identified by sheetToClient
  for (const [key, val] of Object.entries(dbRow)) {
    if (val !== undefined && val !== null) {
      const existsInSchema = schema && Object.values(schema.sheetToClient).includes(key);
      if (!existsInSchema && clientObj[key] === undefined) {
        clientObj[key] = processValue(val);
      }
    }
  }

  // Special validations (from parseRowToClientObject)
  if (upperTable === "PAROS_BOQUILLASV2") {
    if (clientObj.isAllShift !== undefined) {
      clientObj.isAllShift = (clientObj.isAllShift === true || clientObj.isAllShift === "true" || clientObj.isAllShift === "SI" || clientObj.isAllShift === "TRUE" || clientObj.isAllShift === 1 || clientObj.isAllShift === "yes");
    }
    if (clientObj.nozzleNumber !== undefined) {
      clientObj.nozzleNumber = Number(clientObj.nozzleNumber) || 0;
    }
  }

  if (upperTable === "CONTROL_FECHADORV2") {
    const numericFields = ["inkStock", "solventStock", "headsStock"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
  }

  if (upperTable === "CONTROL_BALANZAV2") {
    const numericFields = ["weight1", "weight2", "weight3", "patternWeight", "average", "bias", "range"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
  }

  if (upperTable === "CAMBIO_PRODUCTOV2") {
    const booleanFields = [
      "siloValveClosed", "circuitEmptied", "machineCleaned", "hopperEmptied", "siloChanged",
      "setupChanged", "packagingChanged", "twoBigBagsPalletized", "colorSampling", "sampleSentToLab",
      "productReleased"
    ];
    booleanFields.forEach(f => {
      if (clientObj[f] !== undefined) {
        const val = clientObj[f];
        clientObj[f] = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1 || val === "CUMPLIDO");
      }
    });

    const numericFields = ["calcinationLoss", "incorporatedAir", "ckPercentageByDrx"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined && clientObj[f] !== "") {
        clientObj[f] = Number(clientObj[f]) || 0;
      }
    });
  }

  if (upperTable === "INVENTARIO_FISICOV2") {
    const numericFields = ["quantity", "weightTn"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
  }

  if (upperTable === "ESTADO_CALLESV2") {
    if (clientObj.isEnabled !== undefined) {
      const val = clientObj.isEnabled;
      clientObj.isEnabled = (val === true || val === "true" || val === "SI" || val === "SÍ" || val === "Habilitada" || val === "Habilitado" || val === "TRUE" || val === 1);
    }
  }

  return clientObj;
}

function normalizeUniqueIds(tableName: string, list: any[]): any[] {
  if (!list || !Array.isArray(list)) return [];
  const { clientKey } = getIdColumnAndKey(tableName);
  const seenIds = new Set<string>();
  
  return list.map((item: any, idx: number) => {
    if (!item) return item;
    let idVal = item[clientKey];
    if (idVal === undefined || idVal === null || String(idVal).trim() === "") {
      idVal = `auto-${tableName.toLowerCase()}-${idx}-${Date.now().toString(36)}`;
      item[clientKey] = idVal;
    } else {
      const idStr = String(idVal).trim();
      if (seenIds.has(idStr)) {
        idVal = `${idStr}-dup-${idx}`;
        item[clientKey] = idVal;
      }
    }
    seenIds.add(String(idVal).trim());
    return item;
  });
}

async function readFromSupabase(tableName: string): Promise<any[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const table = tableName.toLowerCase();
  const tablesToTry = [table, ...(TABLE_ALIASES[table] || [])];
  if (table.endsWith("v2") && !tablesToTry.includes(table.slice(0, -2))) {
    tablesToTry.push(table.slice(0, -2));
  }

  for (const targetTable of tablesToTry) {
    try {
      let allRows: any[] = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;
      let selectStr = "*";
      
      const isCausaTable = targetTable.toLowerCase().includes("causa");
      if (isCausaTable) {
        // Optimize: select only the 10 required columns for causas to stay performant and avoid fat wire loads
        selectStr = "id,hac,descripcion,parte_objeto,grupo_codigo_sintoma,codigo_sintoma,causa_sap,grupo_codigo_causa,codigo_causa,tipo_paro";
      }

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase.from(targetTable).select(selectStr).range(from, to);

        if (isCausaTable) {
          query = query.order("hac", { ascending: true });
        }

        const { data, error } = await query;
        if (error) {
          // If optimized select failed, handle fallback to select("*") in page 0
          if (selectStr !== "*" && page === 0) {
            console.warn(`[Supabase Read] Optimized select failed for '${targetTable}', falling back to select("*"). Error: ${error.message}`);
            selectStr = "*";
            continue; // Retry the first page with "*"
          }

          let errStr = (error.message || "").toLowerCase();
          let errCode = error.code || "";
          const isTableMissing = errCode === "42P01" || errStr.includes("does not exist") || errStr.includes("no existe") || errStr.includes("not found") || errStr.includes("invalid path");
          
          if (isTableMissing && page === 0) {
            console.log(`[Supabase Read] Table '${targetTable}' does not exist in database yet (expected fallback).`);
            break; // Break the page loop to try the next table fallback
          }
          throw error;
        }

        if (data && data.length > 0) {
          allRows = [...allRows, ...data];
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allRows.length > 0 || page > 0) {
        console.log(`[Supabase Read] Successfully loaded ${allRows.length} total records from table '${targetTable}' over ${page + 1} pages.`);
        const mappedList = allRows.map((dbRow: any) => {
          return mapSupabaseRowToClient(tableName, dbRow);
        });
        
        // Log diagnostics for CAUSAS
        if (tableName.toUpperCase() === "CAUSASV2") {
          console.log(`[Diagnostic] CAUSASV2 total read from database: ${allRows.length} original records.`);
        }
        
        return mappedList;
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      console.warn(`[Supabase Read Trial Notice] Trial for safety table fallback '${targetTable}': ${errMsg}`);
    }
  }

  return null;
}

function extractColumnFromError(message: string): string | null {
  if (!message) return null;
  // Match column "xyz" or «xyz» or 'xyz' in error messages
  const match = message.match(/column\s+["'«]([^"'»]+)["'»]/i) 
             || message.match(/["'«]([^"'»]+)["'»]\s+column/i)
             || message.match(/columna\s+["'«]([^"'»]+)["'»]/i)
             || message.match(/["'«]([^"'»]+)["'»]\s+does\s+not\s+exist/i);
  return match ? match[1] : null;
}

async function writeToSupabase(tableName: string, action: 'insert' | 'update' | 'upsert', idKey: string, idVal: any, rawData: any): Promise<any> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log(`[Supabase Write] Skipped: credentials not set.`);
    return null;
  }

  const table = tableName.toLowerCase();
  let payload = mapItemForSupabase(tableName, rawData);

  const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);

  // If we are doing an update/upsert, ensure ID is set both raw and sanitized using the DB column name
  if (idVal !== undefined && idVal !== null) {
    payload[dbIdCol] = idVal;
    
    const cleanDbIdCol = sanitizeColumnName(dbIdCol);
    if (cleanDbIdCol && cleanDbIdCol !== dbIdCol) {
      payload[cleanDbIdCol] = idVal;
    }
  }

  let currentTable = table;
  let attempt = 0;
  const maxAttempts = 25;
  let aliasIndex = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      let query;
      if (action === 'insert') {
        query = supabase.from(currentTable).insert([payload]);
      } else if (action === 'update') {
        const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
        
        // We will perform the query using the DB column name
        query = supabase.from(currentTable).update(payload).eq(dbIdCol, cleanIdVal);
      } else {
        query = supabase.from(currentTable).upsert([payload], { onConflict: dbIdCol });
      }

      const { data, error } = await query;

      if (!error) {
        console.log(`[Supabase Write] Successfully completed ${action} in ${currentTable} after ${attempt} attempts.`);
        return data;
      }

      // If we got an error, analyze it
      let errStr = error.message || "";
      if (errStr.includes("<!DOCTYPE") || errStr.includes("<html")) {
        console.error(`🚨 [Supabase Error] Received an HTML response page instead of JSON API response. This occurs when SUPABASE_URL is configured to the browser's Studio dashboard webpage instead of the REST API Endpoint URL.`);
        break; // Stop retrying on HTML responses to avoid spamming
      }

      console.warn(`[Supabase Error Attempt ${attempt}] table ${currentTable}: ${formatSupabaseError(error)}`);

      // Code 42P01 is "undefined_table" (table does not exist)
      if (error.code === '42P01' || errStr.toLowerCase().includes('does not exist') || errStr.toLowerCase().includes('no existe') || errStr.toLowerCase().includes('not found')) {
        const aliases = TABLE_ALIASES[table] || [];
        if (aliasIndex < aliases.length) {
          const nextTable = aliases[aliasIndex];
          aliasIndex++;
          console.log(`[Supabase Table Fallback] Table '${currentTable}' does not exist. Retrying with alias '${nextTable}'...`);
          currentTable = nextTable;
          continue; // retry writing to correct active DB table
        } else if (currentTable.endsWith('v2')) {
          const fallback = currentTable.slice(0, -2);
          console.log(`[Supabase Table Fallback] Last-resort table fallback. Retrying with non-v2 name '${fallback}'...`);
          currentTable = fallback;
          continue; // retry writing to correct active DB table
        }
      }

      // Code 42703 is "undefined_column", PGRST204 is PostgREST schema cache error
      if (
        error.code === '42703' || 
        error.code === 'PGRST204' || 
        errStr.includes('column') || 
        errStr.includes('schema cache')
      ) {
        const missingCol = extractColumnFromError(error.message);
        if (missingCol && payload[missingCol] !== undefined) {
          console.log(`[Supabase Self-Heal] Column '${missingCol}' does not exist in table '${currentTable}'. Removing and retrying...`);
          delete payload[missingCol];
          continue; // retry writing without the non-existent column
        }
        
        // Search if the error specifies other column names in quotes (both single and double quotes)
        const matchAnyQuote = error.message.match(/['"“]([^'"”]+)['"”]/g);
        if (matchAnyQuote) {
          let removedAny = false;
          for (const quoted of matchAnyQuote) {
            const col = quoted.replace(/['"“]/g, '');
            if (payload[col] !== undefined && col !== idKey) {
              console.log(`[Supabase Self-Heal] Removing quoted column '${col}' from payload.`);
              delete payload[col];
              removedAny = true;
            }
          }
          if (removedAny) continue;
        }
      }

      // Code 22P02 is "invalid_text_representation" (type mismatch, e.g. numeric column with "7 tn" text)
      if (error.code === '22P02') {
        const errStrLower = errStr.toLowerCase();
        let invalidStr: string | null = null;
        
        // Extract any text inside quotes from the error message
        const matchVal = errStr.match(/['"“]([^"'”]+)['"”]/);
        if (matchVal) {
          invalidStr = matchVal[1];
        }

        console.log(`[Supabase Self-Heal] 22P02 handling. Extracted invalidStr: '${invalidStr}'. Current payload:`, JSON.stringify(payload));

        if (invalidStr) {
          let fixedAny = false;
          const searchStr = invalidStr.toLowerCase().trim();
          for (const key of Object.keys(payload)) {
            const valStr = String(payload[key]).toLowerCase().trim();
            if (valStr === searchStr || valStr.includes(searchStr) || searchStr.includes(valStr)) {
              if (errStrLower.includes('numeric') || errStrLower.includes('integer') || errStrLower.includes('double') || errStrLower.includes('real')) {
                // Clean non-numeric characters except digits, dots, and minus signs
                const numericPart = String(payload[key]).replace(/[^\d.,-]/g, '').replace(/,/g, '.');
                const parsedNum = parseFloat(numericPart);
                if (!isNaN(parsedNum)) {
                  console.log(`[Supabase Self-Heal] Fixed invalid numeric column '${key}' from '${payload[key]}' to ${parsedNum}.`);
                  payload[key] = parsedNum;
                } else {
                  console.log(`[Supabase Self-Heal] Cannot parse '${payload[key]}' as number. Setting column '${key}' to null.`);
                  payload[key] = null;
                }
                fixedAny = true;
              } else if (errStrLower.includes('boolean')) {
                const lowerVal = String(payload[key]).toLowerCase().trim();
                const isTrue = lowerVal === 'si' || lowerVal === 'sí' || lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1' || lowerVal === 't' || lowerVal === 's';
                console.log(`[Supabase Self-Heal] Fixed invalid boolean column '${key}' from '${payload[key]}' to ${isTrue}.`);
                payload[key] = isTrue;
                fixedAny = true;
              } else {
                console.log(`[Supabase Self-Heal] Nullifying invalid value '${payload[key]}' for column '${key}'.`);
                payload[key] = null;
                fixedAny = true;
              }
            }
          }
          if (fixedAny) {
            console.log(`[Supabase Self-Heal] Payload key(s) corrected. Retrying write...`);
            continue; // retry writing with fixed payload!
          }
        }
      }

      // If we have some other write failure, log it but don't hold back the whole App if we want resilient fallback
      throw error;

    } catch (err: any) {
      console.error(`[Supabase Write Failure] table ${currentTable} failed completely: ${formatSupabaseError(err)}`);
      // If we exceed max attempts, we continue to prevent blocking Google Sheets backup write
      break;
    }
  }
}

async function deleteFromSupabase(tableName: string, idKey: string, idVal: any): Promise<any> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const table = tableName.toLowerCase();
  const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;

  const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);
  
  const tablesToTry = [table, ...(TABLE_ALIASES[table] || [])];
  if (table.endsWith("v2") && !tablesToTry.includes(table.slice(0, -2))) {
    tablesToTry.push(table.slice(0, -2));
  }

  let lastError: any = null;
  for (const targetTable of tablesToTry) {
    try {
      // Attempt delete by standard dbIdCol first
      const { data, error } = await supabase.from(targetTable).delete().eq(dbIdCol, cleanIdVal);
      if (!error) {
        return data;
      }

      let errStr = (error.message || "").toLowerCase();
      const isTableMissing = error.code === "42P01" || errStr.includes("does not exist") || errStr.includes("no existe") || errStr.includes("not found");

      if (isTableMissing) {
        console.log(`[Supabase Delete Warning] Table '${targetTable}' does not exist. trying next table in alias list...`);
        continue; // Try the next table in the fallback list
      }

      // If there is another error, try by the client idKey as fallback
      if (idKey && idKey !== dbIdCol) {
        const rxFallback = await supabase.from(targetTable).delete().eq(idKey, cleanIdVal);
        if (!rxFallback.error) return rxFallback.data;
      }

      // If there is another error, try by sanitized close id key as well
      const cleanIdKey = sanitizeColumnName(dbIdCol);
      if (cleanIdKey !== dbIdCol) {
        const rx = await supabase.from(targetTable).delete().eq(cleanIdKey, cleanIdVal);
        if (!rx.error) return rx.data;
      }

      throw error;
    } catch (err) {
      console.warn(`[Supabase Delete Trial Warning] Trial for '${targetTable}' failed: ${formatSupabaseError(err)}`);
      lastError = err;
    }
  }

  console.error(`[Supabase Delete Failure] All delete trials for table ${table} failed.`);
  throw lastError || new Error(`Todas las pruebas de eliminación en Supabase para la tabla ${table} fallaron.`);
}

// Set up JSON body parser with generous limit
app.use(express.json({ limit: "50mb" }));

// Robust helper to sanitize and parse the service account private key
function cleanPrivateKey(key: string): string {
  if (!key) return "";

  let cleaned = key.trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (parsed?.private_key) {
      cleaned = parsed.private_key;
    }
  } catch {}

  cleaned = cleaned
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .trim();

  const begin = "-----BEGIN PRIVATE KEY-----";
  const end = "-----END PRIVATE KEY-----";

  const beginIndex = cleaned.indexOf(begin);
  const endIndex = cleaned.indexOf(end);

  if (beginIndex !== -1 && endIndex !== -1) {
    cleaned = cleaned.substring(beginIndex, endIndex + end.length);
  }

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

interface TableSchema {
  sheetHeaders: string[];
  clientToSheet: Record<string, string>;
  sheetToClient: Record<string, string>;
}

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  TURNOSV2: {
    sheetHeaders: ["id", "name", "startTime", "endTime", "durationHours"],
    clientToSheet: {
      id: "id",
      name: "name",
      startTime: "startTime",
      endTime: "endTime",
      durationHours: "durationHours"
    },
    sheetToClient: {
      id: "id",
      name: "name",
      startTime: "startTime",
      endTime: "endTime",
      durationHours: "durationHours"
    }
  },
  PALETIZADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "hac_id"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      hacId: "hac_id"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      hac_id: "hacId"
    }
  },
  ENSACADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "boquillas", "hac_id", "es_punto_de_muestreo?"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      nozzles: "boquillas",
      hacId: "hac_id",
      isSamplingPoint: "es_punto_de_muestreo?"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      boquillas: "nozzles",
      hac_id: "hacId",
      "es_punto_de_muestreo?": "isSamplingPoint"
    }
  },
  HACSV2: {
    sheetHeaders: ["id", "hac", "descripcion_hac", "gpo_codigo_objeto", "equipo", "es_fechador?", "es_balanza?"],
    clientToSheet: {
      id: "id",
      hac: "hac",
      detail: "descripcion_hac",
      gpoCodObjeto: "gpo_codigo_objeto",
      equipment: "equipo",
      isDater: "es_fechador?",
      isScale: "es_balanza?"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion_hac: "detail",
      detalle_hac: "detail",
      "detalle hac": "detail",
      detalle: "detail",
      descripcion: "detail",
      descripción: "detail",
      gpo_codigo_objeto: "gpoCodObjeto",
      "gpo.cód. objeto": "gpoCodObjeto",
      grupo_codigo_objeto: "gpoCodObjeto",
      equipo: "equipment",
      "es_fechador?": "isDater",
      es_fechador: "isDater",
      "es_balanza?": "isScale",
      es_balanza: "isScale"
    }
  },
  CAUSASV2: {
    sheetHeaders: [
      "id",
      "hac",
      "descripcion",
      "parte_objeto",
      "grupo_código_sintoma",
      "codigo_sintoma",
      "causa_sap",
      "grupo_codigo_causa",
      "codigo_causa",
      "tipo_paro"
    ],
    clientToSheet: {
      id: "id",
      hac: "hac",
      text: "descripcion",
      partObject: "parte_objeto",
      symptomGroup: "grupo_código_sintoma",
      symptomCode: "codigo_sintoma",
      sapCause: "causa_sap",
      causeGroup: "grupo_codigo_causa",
      causeCode: "codigo_causa",
      stopType: "tipo_paro"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion: "text",
      descripción: "text",
      "texto de causa": "text",
      texto_de_causa: "text",
      parte_objeto: "partObject",
      "parte objeto": "partObject",
      grupo_código_sintoma: "symptomGroup",
      grupo_codigo_sintoma: "symptomGroup",
      "gpo.cód. sintoma": "symptomGroup",
      "gpo.cód. síntoma": "symptomGroup",
      gpo_cod_sintoma: "symptomGroup",
      codigo_sintoma: "symptomCode",
      código_sintoma: "symptomCode",
      "cód. sintoma": "symptomCode",
      "cód. síntoma": "symptomCode",
      causa_sap: "sapCause",
      "causa sap": "sapCause",
      grupo_codigo_causa: "causeGroup",
      "gpo.cod. causa": "causeGroup",
      gpo_cod_causa: "causeGroup",
      codigo_causa: "causeCode",
      "código causa": "causeCode",
      tipo_paro: "stopType",
      "tipo paro": "stopType"
    }
  },
  MATERIALESV2: {
    sheetHeaders: [
      "id",
      "nombre",
      "codigo_sap",
      "peso_embalaje",
      "peso_bolsa",
      "es_pallet?",
      "es_productivo?",
      "es_insumo?",
      "es_bigbag?"
    ],
    clientToSheet: {
      id: "id",
      name: "nombre",
      code: "codigo_sap",
      packingWeight: "peso_embalaje",
      bagWeight: "peso_bolsa",
      isPallet: "es_pallet?",
      isProductive: "es_productivo?",
      isSupply: "es_insumo?",
      isBigBag: "es_bigbag?"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      codigo_sap: "code",
      peso_embalaje: "packingWeight",
      peso_bolsa: "bagWeight",
      "es_pallet?": "isPallet",
      "es_productivo?": "isProductive",
      "es_insumo?": "isSupply",
      "es_bigbag?": "isBigBag"
    }
  },
  CAPACIDADESV2: {
    sheetHeaders: ["id", "ensacadora_id", "peletizadora_id", "material_id", "bdp"],
    clientToSheet: {
      id: "id",
      baggerId: "ensacadora_id",
      palletizerId: "peletizadora_id",
      materialId: "material_id",
      bdp: "bdp"
    },
    sheetToClient: {
      id: "id",
      ensacadora_id: "baggerId",
      peletizadora_id: "palletizerId",
      material_id: "materialId",
      bdp: "bdp"
    }
  },
  PUNTOS_CARGAV2: {
    sheetHeaders: ["id", "nombre", "tipo"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      type: "tipo"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      tipo: "type"
    }
  },
  EMPRESASV2: {
    sheetHeaders: ["id", "nombre", "dirección", "cuit", "telefono", "email"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      address: "dirección",
      taxId: "cuit",
      phone: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      "dirección": "address",
      cuit: "taxId",
      telefono: "phone",
      email: "email"
    }
  },
  PROVEEDORES_BOLSAV2: {
    sheetHeaders: ["id", "nombre", "direccion", "telefono", "email"],
    clientToSheet: {
      id: "id",
      nombre: "nombre",
      direccion: "direccion",
      telefono: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "nombre",
      direccion: "direccion",
      telefono: "telefono",
      email: "email"
    }
  },
  VEHICULOSV2: {
    sheetHeaders: ["id", "marca", "identificación", "tipo", "carga_maxima"],
    clientToSheet: {
      id: "id",
      marca: "marca",
      identificación: "identificación",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    },
    sheetToClient: {
      id: "id",
      marca: "marca",
      identificación: "identificación",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    }
  },
  CARGA_COMBUSTIBLEV2: {
    sheetHeaders: ["id", "fecha", "unidad_movil", "id_operario", "descripcion_operario", "litros_combustible"],
    clientToSheet: {
      id: "id",
      date: "fecha",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    }
  },
  USUARIOSV2: {
    sheetHeaders: ["dni", "nombre", "usuariosap", "email", "email2", "puesto", "perfil", "permisos"],
    clientToSheet: {
      dni: "dni",
      name: "nombre",
      sapUser: "usuariosap",
      email: "email",
      email2: "email2",
      position: "puesto",
      profile: "perfil",
      permissions: "permisos"
    },
    sheetToClient: {
      dni: "dni",
      nombre: "name",
      usuariosap: "sapUser",
      email: "email",
      email2: "email2",
      puesto: "position",
      perfil: "profile",
      permisos: "permissions"
    }
  },
  PRODUCCIONV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripción_turno",
      "palletizadora_id",
      "hac_paletizadora",
      "ensacadora_id",
      "hac_ensacadora",
      "material_id",
      "decripcion_material",
      "bolsas_producidas",
      "tn_producidas",
      "bdp_teorico",
      "boquillas_turno",
      "proveedor_bolsa",
      "bolsas_rech_ensacadora",
      "bolsas_sin_boquilla",
      "bolsas_rech_ventocheck",
      "bolsas_rech_transporte",
      "rendimineto",
      "disponibilidad",
      "oee",
      "disponibilidad_boquillas"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripción_turno",
      palletizerId: "palletizadora_id",
      palletizerHac: "hac_paletizadora",
      baggerId: "ensacadora_id",
      baggerHac: "hac_ensacadora",
      materialId: "material_id",
      materialDescription: "decripcion_material",
      bagsProduced: "bolsas_producidas",
      tonsProduced: "tn_producidas",
      bdp: "bdp_teorico",
      availableNozzlesShift: "boquillas_turno",
      bagProvider: "proveedor_bolsa",
      discardedBagsBagger: "bolsas_rech_ensacadora",
      notNozzledBags: "bolsas_sin_boquilla",
      discardedBagsVentocheck: "bolsas_rech_ventocheck",
      discardedBagsTransport: "bolsas_rech_transporte",
      yield: "rendimineto",
      availability: "disponibilidad",
      oee: "oee",
      nozzleAvailability: "disponibilidad_boquillas"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripción_turno: "shiftDescription",
      palletizadora_id: "palletizerId",
      hac_paletizadora: "palletizerHac",
      ensacadora_id: "baggerId",
      hac_ensacadora: "baggerHac",
      material_id: "materialId",
      decripcion_material: "materialDescription",
      bolsas_producidas: "bagsProduced",
      tn_producidas: "tonsProduced",
      bdp_teorico: "bdp",
      boquillas_turno: "availableNozzlesShift",
      proveedor_bolsa: "bagProvider",
      bolsas_rech_ensacadora: "discardedBagsBagger",
      bolsas_sin_boquilla: "notNozzledBags",
      bolsas_rech_ventocheck: "discardedBagsVentocheck",
      bolsas_rech_transporte: "discardedBagsTransport",
      rendimineto: "yield",
      disponibilidad: "availability",
      oee: "oee",
      disponibilidad_boquillas: "nozzleAvailability"
    }
  },
  PAROS_BOQUILLASV2: {
    sheetHeaders: [
      "id",
      "produccion_id",
      "nro_boquilla",
      "hora_inicio",
      "hora_fin",
      "todo_el_turno",
      "observacion"
    ],
    clientToSheet: {
      id: "id",
      productionId: "produccion_id",
      nozzleNumber: "nro_boquilla",
      startTime: "hora_inicio",
      endTime: "hora_fin",
      isAllShift: "todo_el_turno",
      observation: "observacion"
    },
    sheetToClient: {
      id: "id",
      produccion_id: "productionId",
      nro_boquilla: "nozzleNumber",
      hora_inicio: "startTime",
      hora_fin: "endTime",
      todo_el_turno: "isAllShift",
      observacion: "observation"
    }
  },
  CONTROL_FECHADORV2: {
    sheetHeaders: [
      "idctrlfechador",
      "fecha",
      "maquinista_id",
      "descripcion_maquinista",
      "turno_id",
      "hac_fechador",
      "purga?",
      "nivel_recipiente",
      "calidad_impresion",
      "stock_tinta",
      "stock_solvente",
      "stock_cabezales",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlfechador",
      date: "fecha",
      userId: "maquinista_id",
      userName: "descripcion_maquinista",
      shiftId: "turno_id",
      hac: "hac_fechador",
      purge: "purga?",
      containerLevel: "nivel_recipiente",
      printQuality: "calidad_impresion",
      inkStock: "stock_tinta",
      solventStock: "stock_solvente",
      headsStock: "stock_cabezales",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlfechador: "id",
      fecha: "date",
      maquinista_id: "userId",
      descripcion_maquinista: "userName",
      turno_id: "shiftId",
      hac_fechador: "hac",
      "purga?": "purge",
      nivel_recipiente: "containerLevel",
      calidad_impresion: "printQuality",
      stock_tinta: "inkStock",
      stock_solvente: "solventStock",
      stock_cabezales: "headsStock",
      observaciones: "observations"
    }
  },
  CONTROL_BALANZAV2: {
    sheetHeaders: [
      "idctrlbalanza",
      "fecha",
      "maquinista_id",
      "maquinista_nombre",
      "turno_id",
      "hac",
      "peso_1",
      "peso_2",
      "peso_3",
      "peso_patron",
      "media",
      "bias",
      "rango",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlbalanza",
      date: "fecha",
      userId: "maquinista_id",
      userName: "maquinista_nombre",
      shiftId: "turno_id",
      hac: "hac",
      weight1: "peso_1",
      weight2: "peso_2",
      weight3: "peso_3",
      patternWeight: "peso_patron",
      average: "media",
      bias: "bias",
      range: "rango",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlbalanza: "id",
      fecha: "date",
      maquinista_id: "userId",
      maquinista_nombre: "userName",
      turno_id: "shiftId",
      hac: "hac",
      peso_1: "weight1",
      peso_2: "weight2",
      peso_3: "weight3",
      peso_patron: "patternWeight",
      media: "average",
      bias: "bias",
      rango: "range",
      observaciones: "observations"
    }
  },
  CAMBIO_PRODUCTOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "maquinista_id",
      "maquinista_nombre",
      "maquina_id",
      "valvula_silo_cerrada",
      "circuito_vaciado",
      "maquina_limpia",
      "tolva_vaciada",
      "silo_cambiado",
      "fechador_actualizado",
      "envase_correcto",
      "dos_big_bags_pal",
      "muestreo_color",
      "muestra_enviada_lab",
      "producto_liberado",
      "material_anterior_id",
      "material_nuevo_id",
      "motivo_cambio",
      "lab_operador_id",
      "lab_operador_name",
      "p_calcinacion",
      "aire_incorporado",
      "porcentaje_ck_drx",
      "estado_aprobacion",
      "observacion_rechazo"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      operatorId: "maquinista_id",
      operatorName: "maquinista_nombre",
      machineId: "maquina_id",
      siloValveClosed: "valvula_silo_cerrada",
      circuitEmptied: "circuito_vaciado",
      machineCleaned: "maquina_limpia",
      hopperEmptied: "tolva_vaciada",
      siloChanged: "silo_cambiado",
      setupChanged: "fechador_actualizado",
      packagingChanged: "envase_correcto",
      twoBigBagsPalletized: "dos_big_bags_pal",
      colorSampling: "muestreo_color",
      sampleSentToLab: "muestra_enviada_lab",
      productReleased: "producto_liberado",
      previousMaterialId: "material_anterior_id",
      newMaterialId: "material_nuevo_id",
      changeReason: "motivo_cambio",
      labOperatorId: "lab_operador_id",
      labOperatorName: "lab_operador_name",
      calcinationLoss: "p_calcinacion",
      incorporatedAir: "aire_incorporado",
      ckPercentageByDrx: "porcentaje_ck_drx",
      approvalStatus: "estado_aprobacion",
      rejectionObservation: "observacion_rechazo"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      maquinista_id: "operatorId",
      maquinista_nombre: "operatorName",
      maquina_id: "machineId",
      valvula_silo_cerrada: "siloValveClosed",
      circuito_vaciado: "circuitEmptied",
      maquina_limpia: "machineCleaned",
      tolva_vaciada: "hopperEmptied",
      silo_cambiado: "siloChanged",
      fechador_actualizado: "setupChanged",
      envase_correcto: "packagingChanged",
      dos_big_bags_pal: "twoBigBagsPalletized",
      muestreo_color: "colorSampling",
      muestra_enviada_lab: "sampleSentToLab",
      producto_liberado: "productReleased",
      material_anterior_id: "previousMaterialId",
      material_nuevo_id: "newMaterialId",
      motivo_cambio: "changeReason",
      lab_operador_id: "labOperatorId",
      lab_operador_name: "labOperatorName",
      p_calcinacion: "calcinationLoss",
      aire_incorporado: "incorporatedAir",
      porcentaje_ck_drx: "ckPercentageByDrx",
      estado_aprobacion: "approvalStatus",
      observacion_rechazo: "rejectionObservation"
    }
  },
  INVENTARIO_FISICOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "cantidad",
      "peso_tn",
      "usuario_id",
      "descripcion_maquinista"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      quantity: "cantidad",
      weightTn: "peso_tn",
      userId: "usuario_id",
      userName: "descripcion_maquinista"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      cantidad: "quantity",
      peso_tn: "weightTn",
      usuario_id: "userId",
      descripcion_maquinista: "userName"
    }
  },
  ESTADO_CALLESV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "punto_carga_id",
      "descripcion_punto_de_carga",
      "habilitada?",
      "materiales_permitidos",
      "observaciones_falla"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      loadingPointId: "punto_carga_id",
      loadingPointDescription: "descripcion_punto_de_carga",
      isEnabled: "habilitada?",
      materialIds: "materiales_permitidos",
      observation: "observaciones_falla"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      punto_carga_id: "loadingPointId",
      descripcion_punto_de_carga: "loadingPointDescription",
      "habilitada?": "isEnabled",
      materiales_permitidos: "materialIds",
      observaciones_falla: "observation"
    }
  },
  DESPACHOSV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "toneladas",
      "usuario_id",
      "usuario_nombre"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      tons: "toneladas",
      userId: "usuario_id",
      userName: "usuario_nombre"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      toneladas: "tons",
      usuario_id: "userId",
      usuario_nombre: "userName"
    }
  },
  PAROSV2: {
    sheetHeaders: [
      "idparo",
      "fecha",
      "fechafin",
      "máquina afectada",
      "turno",
      "material",
      "inicio",
      "fin",
      "duración",
      "detalle hac",
      "hac",
      "equipo",
      "texto de causa",
      "texto aviso",
      "texto síntoma",
      "causa sap",
      "gpo.cod. causa",
      "código causa",
      "tipo paro",
      "gpo.cód. objeto",
      "parte objeto",
      "gpo.cód. sintoma",
      "cód. sintoma",
      "usuario",
      "puesto de trabajo",
      "centro"
    ],
    clientToSheet: {
      id: "idparo",
      date: "fecha",
      finishDate: "fechafin",
      machineHacText: "máquina afectada",
      shiftName: "turno",
      materialDescription: "material",
      startTime: "inicio",
      endTime: "fin",
      durationTime: "duración",
      hacDetail: "detalle hac",
      hacName: "hac",
      equipment: "equipo",
      causeText: "texto de causa",
      noticeText: "texto aviso",
      symptomText: "texto síntoma",
      sapCause: "causa sap",
      causeGroup: "gpo.cod. causa",
      causeCode: "código causa",
      stopType: "tipo paro",
      gpoCodObjeto: "gpo.cód. objeto",
      partObject: "parte objeto",
      symptomGroup: "gpo.cód. sintoma",
      symptomCode: "cód. sintoma",
      user: "usuario",
      workCenter: "puesto de trabajo",
      center: "centro"
    },
    sheetToClient: {
      idparo: "id",
      fecha: "date",
      fechafin: "finishDate",
      "máquina afectada": "machineHacText",
      turno: "shiftName",
      material: "materialDescription",
      inicio: "startTime",
      fin: "endTime",
      duración: "durationTime",
      "detalle hac": "hacDetail",
      hac: "hacName",
      equipo: "equipment",
      "texto de causa": "causeText",
      "texto aviso": "noticeText",
      "texto síntoma": "symptomText",
      "causa sap": "sapCause",
      "gpo.cod. causa": "causeGroup",
      "código causa": "causeCode",
      "tipo paro": "stopType",
      "gpo.cód. objeto": "gpoCodObjeto",
      "parte objeto": "partObject",
      "gpo.cód. sintoma": "symptomGroup",
      "cód. sintoma": "symptomCode",
      usuario: "user",
      "puesto de trabajo": "workCenter",
      centro: "center"
    }
  }
}

const formatTimeHHMMSS = (timeStr: string | undefined): string => {
  if (!timeStr) return "00:00:00";
  const trimmed = timeStr.trim();
  if (trimmed.length === 5) {
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }
  }
  if (trimmed.length === 8) {
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return trimmed;
};

const calculateDurationTime = (startStr: string, endStr: string): string => {
  try {
    const sStr = formatTimeHHMMSS(startStr);
    const eStr = formatTimeHHMMSS(endStr);
    const [sh, sm, ss] = sStr.split(":").map(Number);
    const [eh, em, es] = eStr.split(":").map(Number);
    
    let startSecs = sh * 3600 + sm * 60 + ss;
    let endSecs = eh * 3600 + em * 60 + es;
    
    let diffSecs = endSecs - startSecs;
    if (diffSecs < 0) {
      diffSecs += 24 * 3600;
    }
    
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  } catch (err) {
    return "00:00:00";
  }
};

const durationMinutesFromHHMMSS = (timeStr: string | undefined): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length >= 2) {
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  }
  return 0;
};

function parseRowToClientObject(headers: string[], row: any[], tableName: string): any {
  const rowObj: any = {};
  let hasValidValue = false;
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];

  headers.forEach((header, index) => {
    if (header) {
      const val = row[index] !== undefined ? row[index] : "";
      
      let clientKey = header;
      if (schema) {
        if (schema.sheetToClient[header]) {
          clientKey = schema.sheetToClient[header];
        } else {
          // Robust fallback: try looking up using sanitized header
          const cleanHeader = sanitizeColumnName(header);
          const matchedEntry = Object.entries(schema.sheetToClient).find(
            ([k, v]) => sanitizeColumnName(k) === cleanHeader
          );
          if (matchedEntry) {
            clientKey = matchedEntry[1] as string;
          }
        }
      }
      
      let parsedVal: any = typeof val === "string" ? val.trim() : val;
      if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
        try {
          parsedVal = JSON.parse(val.trim());
        } catch (e) {
          parsedVal = val.trim();
        }
      } else if (typeof val === "string") {
        parsedVal = val.trim();
      } else {
        parsedVal = val;
      }

      if (upperTable === "PAROS_BOQUILLASV2") {
        if (clientKey === "isAllShift") {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1);
        } else if (clientKey === "nozzleNumber") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CONTROL_FECHADORV2") {
        if (clientKey === "inkStock" || clientKey === "solventStock" || clientKey === "headsStock") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CONTROL_BALANZAV2") {
        if (["weight1", "weight2", "weight3", "patternWeight", "average", "bias", "range"].includes(clientKey)) {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CAMBIO_PRODUCTOV2") {
        const booleanFields = [
          "siloValveClosed", "circuitEmptied", "machineCleaned", "hopperEmptied", "siloChanged",
          "setupChanged", "packagingChanged", "twoBigBagsPalletized", "colorSampling", "sampleSentToLab",
          "productReleased"
        ];
        if (booleanFields.includes(clientKey)) {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1 || val === "CUMPLIDO");
        } else if (["calcinationLoss", "incorporatedAir", "ckPercentageByDrx"].includes(clientKey)) {
          parsedVal = val !== "" ? (Number(val) || 0) : undefined;
        }
      }

      if (upperTable === "INVENTARIO_FISICOV2") {
        if (clientKey === "quantity" || clientKey === "weightTn") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "ESTADO_CALLESV2") {
        if (clientKey === "isEnabled") {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "SÍ" || val === "Habilitada" || val === "Habilitado" || val === "TRUE" || val === 1);
        }
      }

      if (upperTable === "DESPACHOSV2") {
        if (clientKey === "tons") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "PRODUCCIONV2") {
        const numericFields = [
          "bagsProduced",
          "tonsProduced",
          "bdp",
          "availableNozzlesShift",
          "discardedBagsBagger",
          "notNozzledBags",
          "discardedBagsVentocheck",
          "discardedBagsTransport",
          "yield",
          "availability",
          "oee"
        ];
        if (numericFields.includes(clientKey)) {
          parsedVal = Number(String(val).replace(",", ".")) || 0;
        }
      }

      // Standardize boolean fields across all tables to prevent false-positives
      const isBoolean = header.endsWith("?") || 
                        ["isPallet", "isProductive", "isSupply", "isBigBag", "isSamplingPoint", "isDater", "isScale", "isEnabled", "purge"].includes(clientKey);
      if (isBoolean) {
        const norm = String(val).trim().toUpperCase();
        parsedVal = (val === true || val === 1 || norm === "TRUE" || norm === "1" || norm === "SI" || norm === "SÍ" || norm === "HABILITADO" || norm === "HABILITADA" || norm === "CUMPLIDO");
      }

      // Standardize generic numeric fields that can be read as string
      if (upperTable === "MATERIALESV2" && ["packingWeight", "bagWeight"].includes(clientKey)) {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }
      if (upperTable === "CAPACIDADESV2" && clientKey === "bdp") {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }
      if (upperTable === "ENSACADORAV2" && clientKey === "nozzles") {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }

      rowObj[clientKey] = parsedVal;

      if (val !== "") {
        hasValidValue = true;
      }
    }
  });

  return hasValidValue ? rowObj : null;
}

const PREDEFINED_HEADERS: Record<string, string[]> = {
  TURNOSV2: ["id", "name", "startTime", "endTime", "durationHours"],
  PALETIZADORAV2: ["id", "tipo", "nombre", "hac_id"],
  ENSACADORAV2: ["id", "tipo", "nombre", "boquillas", "hac_id", "es_punto_de_muestreo?"],
  HACSV2: ["id", "hac", "descripcion_hac", "gpo_codigo_objeto", "equipo", "es_fechador?", "es_balanza?"],
  CAUSASV2: ["id", "hac", "descripcion", "parte_objeto", "grupo_código_sintoma", "codigo_sintoma", "causa_sap", "grupo_codigo_causa", "codigo_causa", "tipo_paro"],
  MATERIALESV2: ["id", "nombre", "codigo_sap", "peso_embalaje", "peso_bolsa", "es_pallet?", "es_productivo?", "es_insumo?", "es_bigbag?"],
  CAPACIDADESV2: ["id", "ensacadora_id", "peletizadora_id", "material_id", "bdp"],
  USUARIOSV2: ["dni", "nombre", "usuariosap", "email", "email2", "puesto", "perfil", "permisos"],
  EMPRESASV2: ["id", "nombre", "dirección", "cuit", "telefono", "email"],
  PROVEEDORES_BOLSAV2: ["id", "nombre", "direccion", "telefono", "email"],
  VEHICULOSV2: ["id", "marca", "identificación", "tipo", "carga_maxima"],
  CARGA_COMBUSTIBLEV2: ["id", "fecha", "unidad_movil", "id_operario", "descripcion_operario", "litros_combustible"],
  PUNTOS_CARGAV2: ["id", "nombre", "tipo"],
  DESPACHOSV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "material_id", "descripcion_material", "toneladas", "usuario_id", "usuario_nombre"
  ],
  PAROSV2: [
    "idparo", "fecha", "fechafin", "máquina afectada", "turno", "material", "inicio", "fin", "duración", "detalle hac", "hac", "equipo", "texto de causa", "texto aviso", "texto síntoma", "causa sap", "gpo.cod. causa", "código causa", "tipo paro", "gpo.cód. objeto", "parte objeto", "gpo.cód. sintoma", "cód. sintoma", "usuario", "puesto de trabajo", "centro"
  ],
  PRODUCCIONV2: [
    "id",
    "fecha",
    "turno_id",
    "descripción_turno",
    "palletizadora_id",
    "hac_paletizadora",
    "ensacadora_id",
    "hac_ensacadora",
    "material_id",
    "decripcion_material",
    "bolsas_producidas",
    "tn_producidas",
    "bdp_teorico",
    "boquillas_turno",
    "proveedor_bolsa",
    "bolsas_rech_ensacadora",
    "bolsas_sin_boquilla",
    "bolsas_rech_ventocheck",
    "bolsas_rech_transporte",
    "rendimineto",
    "disponibilidad",
    "oee",
    "disponibilidad_boquillas"
  ],
  PAROS_BOQUILLASV2: [
    "id",
    "produccion_id",
    "nro_boquilla",
    "hora_inicio",
    "hora_fin",
    "todo_el_turno",
    "observacion"
  ],
  CONTROL_FECHADORV2: [
    "idctrlfechador", "fecha", "maquinista_id", "descripcion_maquinista", "turno_id", "hac_fechador", "purga?", "nivel_recipiente", "calidad_impresion", "stock_tinta", "stock_solvente", "stock_cabezales", "observaciones"
  ],
  CONTROL_BALANZAV2: [
    "idctrlbalanza", "fecha", "maquinista_id", "maquinista_nombre", "turno_id", "hac", "peso_1", "peso_2", "peso_3", "peso_patron", "media", "bias", "rango", "observaciones"
  ],
  INVENTARIO_FISICOV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "material_id", "descripcion_material", "cantidad", "peso_tn", "usuario_id", "descripcion_maquinista"
  ],
  CAMBIO_PRODUCTOV2: [
    "id", "fecha", "turno_id", "maquinista_id", "maquinista_nombre", "maquina_id", "valvula_silo_cerrada", "circuito_vaciado", "maquina_limpia", "tolva_vaciada", "silo_cambiado", "fechador_actualizado", "envase_correcto", "dos_big_bags_pal", "muestreo_color", "muestra_enviada_lab", "producto_liberado", "material_anterior_id", "material_nuevo_id", "motivo_cambio", "lab_operador_id", "lab_operador_name", "p_calcinacion", "aire_incorporado", "porcentaje_ck_drx", "estado_aprobacion", "observacion_rechazo"
  ],
  ESTADO_CALLESV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "punto_carga_id", "descripcion_punto_de_carga", "habilitada?", "materiales_permitidos", "observaciones_falla"
  ]
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuota = error.status === 429 || 
                    error.code === 429 || 
                    error.message?.includes("Quota exceeded") || 
                    error.message?.includes("Read requests") ||
                    error.message?.includes("rate limit");
    if (isQuota && retries > 0) {
      console.warn(`Sheets API rate limit hit (429). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 500));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Thread-safe and rate-limit proof promise cache for sheet names
let sheetNamesPromise: Promise<string[]> | null = null;
let lastSheetNamesFetch = 0;
const SHEET_NAMES_CACHE_TTL = 300000; // 5 minutes cache

async function getSheetNames(sheets: any, spreadsheetId: string): Promise<string[]> {
  const now = Date.now();
  if (sheetNamesPromise && (now - lastSheetNamesFetch < SHEET_NAMES_CACHE_TTL)) {
    return sheetNamesPromise;
  }
  
  lastSheetNamesFetch = now;
  sheetNamesPromise = (async () => {
    try {
      const response: any = await callWithRetry(() => sheets.spreadsheets.get({ spreadsheetId }));
      return response.data.sheets?.map((s: any) => s.properties?.title) || [];
    } catch (err) {
      sheetNamesPromise = null;
      lastSheetNamesFetch = 0;
      throw err;
    }
  })();
  
  return sheetNamesPromise;
}

// Ensure sheet exists; if not, create it
async function ensureSheetExists(sheets: any, spreadsheetId: string, tableName: string): Promise<boolean> {
  try {
    const sheetNames = await getSheetNames(sheets, spreadsheetId);
    
    if (sheetNames.includes(tableName)) {
      return true;
    }

    // Create the sheet
    await callWithRetry(() => sheets.spreadsheets.batchUpdate({
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
    }));
    
    // Clear cache to force a refresh on the next fetch
    sheetNamesPromise = null;
    lastSheetNamesFetch = 0;
    return true;
  } catch (error) {
    console.error(`Error ensuring sheet existence for ${tableName}:`, error);
    return false;
  }
}

// ----------------------------------------------------
// DATABASE OPERATION HELPERS & SAFETY WRAPPER METHODS
// ----------------------------------------------------

const verifiedTables = new Set<string>();

// 1. Ensure sheet exists AND column headers row is correct (Point 1, 7)
async function ensureHeadersAndColumns(sheets: any, spreadsheetId: string, tableName: string): Promise<string[]> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  let expectedHeaders = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);

  if (verifiedTables.has(upperTable)) {
    return expectedHeaders;
  }

  await ensureSheetExists(sheets, spreadsheetId, tableName);

  // Read current Row 1
  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ1`,
  }));

  const existingRows = response.data.values;
  let existingHeaders: string[] = existingRows && existingRows[0] ? existingRows[0].map((h: any) => String(h || "").trim()) : [];

  if (upperTable === "PRODUCCIONV2" && existingHeaders.some(h => h.toLowerCase() === "novedades_boquillas")) {
    console.log(`[ensureHeadersAndColumns] Found obsolete column 'novedades_boquillas' in PRODUCCIONV2 sheet, clearing and rewritimg headers.`);
    existingHeaders = existingHeaders.filter(h => h.toLowerCase() !== "novedades_boquillas");
    await callWithRetry(() => sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tableName}!A1:ZZ1`,
    }));
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [existingHeaders],
      },
    }));
  }

  if (existingHeaders.length === 0 || existingHeaders.every(h => h === "")) {
    console.log(`[ensureHeadersAndColumns] Table ${tableName} header is empty. Writing default headers:`, expectedHeaders);
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [expectedHeaders],
      },
    }));
    verifiedTables.add(upperTable);
    return expectedHeaders;
  }

  // Check if columns are missing
  const missingHeaders = expectedHeaders.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length > 0) {
    console.log(`[ensureHeadersAndColumns] Table ${tableName} is missing columns. Appending missing columns securely:`, missingHeaders);
    const updatedHeaders = [...existingHeaders, ...missingHeaders];
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedHeaders],
      },
    }));
    verifiedTables.add(upperTable);
    return updatedHeaders;
  }

  verifiedTables.add(upperTable);
  return existingHeaders;
}

// 2. Identify the matching ID Column name in sheet and property keyword in client objects
function getIdColumnAndKey(tableName: string): { sheetCol: string; clientKey: string } {
  const upper = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upper];
  if (!schema) {
    return { sheetCol: "id", clientKey: "id" };
  }
  const idFields = ["id", "idparo", "idctrlfechador", "idctrlbalanza", "dni"];
  const sheetCol = schema.sheetHeaders.find(h => idFields.includes(h.toLowerCase())) || schema.sheetHeaders[0];
  const clientKey = schema.sheetToClient[sheetCol] || sheetCol;
  return { sheetCol, clientKey };
}

// 3. Robust comparison of records to skip redundant updates (Point 8, Concurrency safety)
function areRecordsEqual(recordA: any, recordB: any, schemaHeaders: string[], schema: any): boolean {
  if (!recordA || !recordB) return false;
  for (const header of schemaHeaders) {
    const key = schema ? schema.sheetToClient[header] || header : header;
    const valA = recordA[key];
    const valB = recordB[key];
    
    const normalize = (v: any) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch { return ""; }
      }
      return String(v).trim();
    };
    
    if (normalize(valA) !== normalize(valB)) {
      return false;
    }
  }
  return true;
}

// 4. Enrich item details on backend side dynamically when writing to Sheets
async function enrichProductionRecords(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [dbShifts, dbPalletizers, dbBaggers, dbMaterials, dbHacs, dbParos, dbCauses, dbCapacities] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PALETIZADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "ENSACADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "HACSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PAROSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "CAUSASV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "CAPACIDADESV2").catch(() => []),
    ]);

    data.forEach((item: any) => {
      const shiftId = item.shiftId || item.turno_id;
      const shift = dbShifts.find((s: any) => s && (safeMatch(s.id, shiftId) || safeMatch(s.id, item.shiftId)));
      const shiftName = shift ? (shift.name || shift.nombre || "") : "";
      item.shiftDescription = shiftName;
      item["descripción_turno"] = shiftName;
      item["descripcion_turno"] = shiftName;

      const palId = item.palletizerId || item.palletizadora_id;
      const pal = dbPalletizers.find((p: any) => p && safeMatch(p.id, palId));
      const palHacId = pal ? (pal.hacId || pal.hac_id) : "";
      const hacPal = dbHacs.find((h: any) => h && (safeMatch(h.id, palHacId) || safeMatch(h.hac, palHacId)));
      const palHacVal = hacPal ? (hacPal.hac || "") : (palHacId || "");
      item.palletizerHac = palHacVal;
      item["hac_paletizadora"] = palHacVal;

      const bagId = item.baggerId || item.ensacadora_id;
      const bag = dbBaggers.find((b: any) => b && safeMatch(b.id, bagId));
      const bagHacId = bag ? (bag.hacId || bag.hac_id) : "";
      const hacBag = dbHacs.find((h: any) => h && (safeMatch(h.id, bagHacId) || safeMatch(h.hac, bagHacId)));
      const bagHacVal = hacBag ? (hacBag.hac || "") : (bagHacId || "");
      item.baggerHac = bagHacVal;
      item["hac_ensacadora"] = bagHacVal;

      const matId = item.materialId || item.material_id;
      const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, matId));
      const matName = mat ? (mat.nombre || mat.name || "") : "";
      item.materialDescription = matName;
      item["decripcion_material"] = matName;
      item["descripcion_material"] = matName;

      const shiftDurationHours = shift ? Number(shift.durationHours || 8) : 8;

      const stops = dbParos.filter((s: any) => 
        s.date === item.date && 
        s.shiftId === item.shiftId && 
        s.machineId === item.palletizerId
      );
      const stopMins = stops.reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
      const hsMarcha = Math.max(0, shiftDurationHours - (stopMins / 60));

      const externalStopMinutes = stops
        .filter((s: any) => {
          const c = dbCauses.find((cause: any) => 
            cause.id === s.causeId || 
            cause.text === s.causeText || 
            cause.descripcion === s.causeText || 
            cause.id === s.causeText
          );
          return (c && c.stopType === 'EXTERNO') || s.stopType === 'EXTERNO';
        })
        .reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
      const externalStopHours = externalStopMinutes / 60;

      // Disponibilidad = (hs. de paro externo + hs. de marcha) / duración de turno
      let availabilityPercent = 100;
      if (shiftDurationHours > 0) {
        availabilityPercent = ((externalStopHours + hsMarcha) / shiftDurationHours) * 100;
      }
      item.availability = `${Math.min(100, Math.round(availabilityPercent))}%`;

      // Rendimiento = (totalTons / hsMarcha) / bdp_ponderado
      const contextReports = data.filter((r: any) => 
        r.date === item.date && 
        r.shiftId === item.shiftId && 
        r.palletizerId === item.palletizerId
      );

      let yieldPercent = 100;
      if (contextReports.length > 0 && hsMarcha > 0) {
        let totalTons = 0;
        let sumTonsOverBDP = 0;

        contextReports.forEach((r: any) => {
          const tons = Number(r.tonsProduced) || 0;
          totalTons += tons;

          // Find BDP in database capacities
          const cap = dbCapacities.find((c: any) => 
            String(c.palletizerId || "").trim().toUpperCase() === String(r.palletizerId || "").trim().toUpperCase() &&
            String(c.baggerId || "").trim().toUpperCase() === String(r.baggerId || "").trim().toUpperCase() &&
            String(c.materialId || "").trim().toUpperCase() === String(r.materialId || "").trim().toUpperCase()
          );

          const bdpVal = cap ? Number(cap.bdp) : (Number(r.bdp) || 100);
          if (bdpVal > 0) {
            sumTonsOverBDP += tons / bdpVal;
          } else {
            sumTonsOverBDP += tons / 100;
          }
        });

        if (totalTons > 0 && sumTonsOverBDP > 0) {
          const rate = totalTons / hsMarcha;
          const bdpPonderado = totalTons / sumTonsOverBDP; // tons/hour
          yieldPercent = (rate / bdpPonderado) * 100;
        } else {
          yieldPercent = 0;
        }
      } else {
        yieldPercent = 0;
      }
      
      item.yield = `${Math.round(yieldPercent)}%`;

      // OEE = rendimiento * disponibilidad
      const oeePercent = (availabilityPercent / 100) * (yieldPercent / 100) * 100;
      item.oee = `${Math.round(oeePercent)}%`;
    });
  } catch (enrichError) {
    console.error("Error enriching production data:", enrichError);
  }
}

async function autoRecalculateProductionMetrics(sheets: any, spreadsheetId: string) {
  try {
    console.log("[autoRecalculateProductionMetrics] Starting automatic OEE/Availability/Yield recalculation...");
    delete readCache["PRODUCCIONV2"];
    delete readCache["PAROSV2"];

    const productionList = await readTableData(sheets, spreadsheetId, "PRODUCCIONV2");
    if (!productionList || productionList.length === 0) {
      console.log("[autoRecalculateProductionMetrics] No production records found to recalculate.");
      return;
    }

    // Recalculate
    await enrichProductionRecords(sheets, spreadsheetId, productionList);

    console.log(`[autoRecalculateProductionMetrics] Recalculated ${productionList.length} records. Committing updates to PRODUCCIONV2...`);
    for (const report of productionList) {
      await updateRecord(sheets, spreadsheetId, "PRODUCCIONV2", report.id, report);
    }
    
    delete readCache["PRODUCCIONV2"];
    console.log("[autoRecalculateProductionMetrics] Done recalculating.");
  } catch (err) {
    console.error("[autoRecalculateProductionMetrics] Failed to auto-recalculate:", err);
  }
}

async function enrichInventarioFisico(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [dbShifts, dbMaterials] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => [])
    ]);

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.materialId) {
        const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, item.materialId));
        item.materialDescription = mat ? mat.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching inventory:", err);
  }
}

async function enrichEstadoCalles(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [dbShifts, dbLanes] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PUNTOS_CARGAV2").catch(() => [])
    ]);

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.loadingPointId) {
        const lane = dbLanes.find((l: any) => l && safeMatch(l.id, item.loadingPointId));
        item.loadingPointDescription = lane ? lane.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching loading lanes:", err);
  }
}

async function enrichDespachos(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [dbShifts, dbMaterials] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => [])
    ]);

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.materialId) {
        const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, item.materialId));
        item.materialDescription = mat ? mat.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching dispatches:", err);
  }
}

async function enrichParos(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [dbShifts, dbPalletizers, dbBaggers, dbHacs, dbMaterials] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PALETIZADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "ENSACADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "HACSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => [])
    ]);

    data.forEach((item: any) => {
      const shiftId = item.shiftId || item.turno_id;
      const shift = dbShifts.find((s: any) => s && (
        safeMatch(s.id, shiftId) || 
        safeMatch(s.name, shiftId) || 
        safeMatch(s.nombre, shiftId) || 
        safeMatch(s.id, item.shiftId) ||
        safeMatch(s.name, item.shiftId) ||
        safeMatch(s.nombre, item.shiftId)
      ));
      const shiftName = shift ? (shift.name || shift.nombre || "") : "";
      item.shiftName = shiftName;
      item["turno"] = shiftName;

      if (item.machineId) {
        const pal = dbPalletizers.find((p: any) => p && (safeMatch(p.id, item.machineId) || safeMatch(p.name, item.machineId) || safeMatch(p.nombre, item.machineId))) || 
                    dbBaggers.find((b: any) => b && (safeMatch(b.id, item.machineId) || safeMatch(b.name, item.machineId) || safeMatch(b.nombre, item.machineId)));
        const hacPal = dbHacs.find((h: any) => h && (safeMatch(h.id, pal?.hacId) || safeMatch(h.hac, pal?.hacId) || safeHacMatch(h.hac, pal?.hacId)));
        // If there is no HAC related to this machine, use the machine's ID so we can map it back perfectly on read
        item.machineHacText = item.machineHacText || (hacPal ? hacPal.hac : (pal?.id || item.machineId));
        item["máquina afectada"] = item.machineHacText;
      }

      const matId = item.materialId || item.material_id;
      const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, matId));
      const matName = mat ? (mat.nombre || mat.name || "") : "";
      item.materialDescription = matName;
      item["material"] = matName;

      item.finishDate = item.date;
      item.center = "AMG0";
      item.startTime = formatTimeHHMMSS(item.startTime);
      item.endTime = formatTimeHHMMSS(item.endTime);
      
      const duration = calculateDurationTime(item.startTime, item.endTime);
      item.durationTime = duration;
      item["duración"] = duration;
      item["duracion"] = duration;
    });
  } catch (err) {
    console.error("Error enriching paros:", err);
  }
}

async function enrichDataIfNeeded(sheets: any, spreadsheetId: string, tableName: string, items: any[]) {
  const upper = tableName.toUpperCase();
  if (upper === "PRODUCCIONV2") {
    await enrichProductionRecords(sheets, spreadsheetId, items);
  } else if (upper === "INVENTARIO_FISICOV2") {
    await enrichInventarioFisico(sheets, spreadsheetId, items);
  } else if (upper === "ESTADO_CALLESV2") {
    await enrichEstadoCalles(sheets, spreadsheetId, items);
  } else if (upper === "DESPACHOSV2") {
    await enrichDespachos(sheets, spreadsheetId, items);
  } else if (upper === "PAROSV2") {
    await enrichParos(sheets, spreadsheetId, items);
  }
}

// 5. Insert single record securely using safe append on Sheets (Point 2)
async function insertRecord(sheets: any, spreadsheetId: string, tableName: string, item: any): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  
  // Clean item key mapping or enrichment
  await enrichDataIfNeeded(sheets, spreadsheetId, tableName, [item]);

  // Write to Supabase first as requested by the user flow
  const { clientKey } = getIdColumnAndKey(tableName);
  const idValue = item[clientKey];
  
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await writeToSupabase(tableName, "insert", clientKey, idValue, item);
      if (upperTable === "PRODUCCIONV2") {
        await syncProductionNozzles(sheets, spreadsheetId, item);
      }
      console.log(`[Database log: CREATE via Supabase] Table '${tableName}' written directly to Supabase. Skipping Google Sheets write.`);
      delete readCache[upperTable];
      if (upperTable === "PRODUCCIONV2") {
        delete readCache["PAROS_BOQUILLASV2"];
      }
      return; // Bypasses Google Sheets write completely!
    } catch (supaErr) {
      console.error(`[Supabase Insert Record Error] table ${tableName}: ${formatSupabaseError(supaErr)}`);
      console.warn(`[Supabase Error Fallback] Retrying write in Google Sheets...`);
    }
  }

  // Ensure and get correct column headers ordering for the sheet
  const headers = await ensureHeadersAndColumns(sheets, spreadsheetId, tableName);

  const row = headers.map((header) => {
    let val;
    if (schema) {
      const clientKey = schema.sheetToClient[header] || header;
      val = item[clientKey];
    } else {
      val = item[header];
      if (val === undefined) {
        const lowerHeader = header.toLowerCase();
        const matchingKey = Object.keys(item).find(k => k.toLowerCase() === lowerHeader);
        if (matchingKey) {
          val = item[matchingKey];
        }
      }
    }
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

  await callWithRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tableName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  }));

  if (upperTable === "PRODUCCIONV2") {
    await syncProductionNozzles(sheets, spreadsheetId, item);
  }

  console.log(`[Database log: CREATE] Selected append insertion in table ${tableName}. ID: ${item.id || item.dni || item.idctrlfechador || item.idctrlbalanza || item.idparo || 'unknown'}`);
}

// 6. Update single record securely by searching by original ID (Point 3)
async function updateRecord(sheets: any, spreadsheetId: string, tableName: string, targetId: string, item: any): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];

  await enrichDataIfNeeded(sheets, spreadsheetId, tableName, [item]);

  // Write to Supabase first as requested by the user flow
  const { clientKey } = getIdColumnAndKey(tableName);
  
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await writeToSupabase(tableName, "update", clientKey, targetId, item);
      if (upperTable === "PRODUCCIONV2") {
        await syncProductionNozzles(sheets, spreadsheetId, item);
      }
      console.log(`[Database log: UPDATE via Supabase] Table '${tableName}' updated directly in Supabase. Skipping Google Sheets write.`);
      delete readCache[upperTable];
      if (upperTable === "PRODUCCIONV2") {
        delete readCache["PAROS_BOQUILLASV2"];
      }
      return; // Bypasses Google Sheets write completely!
    } catch (supaErr) {
      console.error(`[Supabase Update Record Error] table ${tableName}: ${formatSupabaseError(supaErr)}`);
      console.warn(`[Supabase Error Fallback] Retrying update in Google Sheets...`);
    }
  }

  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  }

  const { sheetCol } = getIdColumnAndKey(tableName);
  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ50000`,
  }));

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const idColIndex = headers.indexOf(sheetCol);

  if (idColIndex === -1) {
    console.warn(`[updateRecord] ID column ${sheetCol} not found in headers for ${tableName}. Performing append insert.`);
    await insertRecord(sheets, spreadsheetId, tableName, item);
    return;
  }

  let matchingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const idValueInRow = rows[i][idColIndex];
    if (idValueInRow !== undefined && String(idValueInRow).trim() === String(targetId).trim()) {
      matchingRowIndex = i + 1; // 1-based index in Google Sheets
      break;
    }
  }

  if (matchingRowIndex === -1) {
    console.log(`[updateRecord] ID ${targetId} not found in ${tableName}. Direct inserting as new row.`);
    await insertRecord(sheets, spreadsheetId, tableName, item);
    return;
  }

  const row = headers.map((header) => {
    let val;
    if (schema) {
      const clientKey = schema.sheetToClient[header] || header;
      val = item[clientKey];
    } else {
      val = item[header];
      if (val === undefined) {
        const lowerHeader = header.toLowerCase();
        const matchingKey = Object.keys(item).find(k => k.toLowerCase() === lowerHeader);
        if (matchingKey) {
          val = item[matchingKey];
        }
      }
    }
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

  await callWithRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tableName}!A${matchingRowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  }));

  if (upperTable === "PRODUCCIONV2") {
    await syncProductionNozzles(sheets, spreadsheetId, item);
  }

  console.log(`[Database log: UPDATE] Updated row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
}

// 7. Delete nested nozzles linked with production report (Point 4)
async function deleteNozzlesForProduction(sheets: any, spreadsheetId: string, productionId: string) {
  try {
    const list = await readTableData(sheets, spreadsheetId, "PAROS_BOQUILLASV2");
    const matching = list.filter((n: any) => n.productionId === productionId);
    for (const match of matching) {
      await deleteRecord(sheets, spreadsheetId, "PAROS_BOQUILLASV2", match.id);
    }
  } catch (err) {
    console.error("Error deleting old nozzles for productionId " + productionId + ":", err);
  }
}

// 8. Safely push/sync nested nozzle entries to PAROS_BOQUILLASV2
async function syncProductionNozzles(sheets: any, spreadsheetId: string, item: any) {
  if (!item.nozzleNews || !Array.isArray(item.nozzleNews)) return;
  try {
    const nozzleNewsEntries = item.nozzleNews.map((news: any) => ({
      id: news.id,
      productionId: item.id,
      nozzleNumber: news.nozzleNumber,
      startTime: news.startTime,
      endTime: news.endTime,
      isAllShift: news.isAllShift === true || news.isAllShift === "true" || news.isAllShift === "SI" ? "SI" : "NO",
      observation: news.observation || ""
    }));

    await deleteNozzlesForProduction(sheets, spreadsheetId, item.id);

    for (const entry of nozzleNewsEntries) {
      await insertRecord(sheets, spreadsheetId, "PAROS_BOQUILLASV2", entry);
    }
  } catch (err) {
    console.error("Error syncing production nozzles:", err);
  }
}

// 9. Delete single record uniquely by original ID (Point 4)
async function deleteRecord(sheets: any, spreadsheetId: string, tableName: string, targetId: string): Promise<boolean> {
  const upperTable = tableName.toUpperCase();
  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  } else if (upperTable === "PAROS_BOQUILLASV2") {
    delete readCache["PRODUCCIONV2"];
  }

  const { sheetCol, clientKey } = getIdColumnAndKey(tableName);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await deleteFromSupabase(tableName, clientKey, targetId);
      if (upperTable === "PRODUCCIONV2") {
        await deleteNozzlesForProduction(sheets, spreadsheetId, targetId);
      }
      console.log(`[Database log: DELETE via Supabase] Table '${tableName}' deleted directly in Supabase. Skipping Google Sheets write.`);
      delete readCache[upperTable];
      if (upperTable === "PRODUCCIONV2") {
        delete readCache["PAROS_BOQUILLASV2"];
      } else if (upperTable === "PAROS_BOQUILLASV2") {
        delete readCache["PRODUCCIONV2"];
      }
      return true; // Bypasses Google Sheets write completely!
    } catch (supaErr) {
      console.error(`[Supabase Delete Record Error] table ${tableName}: ${formatSupabaseError(supaErr)}`);
      console.warn(`[Supabase Error Fallback] Retrying delete in Google Sheets...`);
    }
  }

  if (upperTable === "PRODUCCIONV2") {
    await deleteNozzlesForProduction(sheets, spreadsheetId, targetId);
  }

  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ50000`,
  }));

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const idColIndex = headers.indexOf(sheetCol);

  if (idColIndex === -1) {
    console.warn(`[deleteRecord] ID column ${sheetCol} not found in ${tableName}`);
    return false;
  }

  let matchingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const idValueInRow = rows[i][idColIndex];
    if (idValueInRow !== undefined && String(idValueInRow).trim() === String(targetId).trim()) {
      matchingRowIndex = i + 1; // 1-based index in Sheets
      break;
    }
  }

  if (matchingRowIndex === -1) {
    console.log(`[deleteRecord] ID ${targetId} not found in ${tableName}, nothing to delete.`);
    return false;
  }

  let deletedPhysically = false;
  try {
    const meta: any = await callWithRetry(() => sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    }));
    const sheetProp = meta.data.sheets?.find((s: any) => s.properties?.title === tableName);
    const sheetIdNum = sheetProp?.properties?.sheetId;

    if (sheetIdNum !== undefined) {
      await callWithRetry(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetIdNum,
                  dimension: "ROWS",
                  startIndex: matchingRowIndex - 1, // 0-based inclusive
                  endIndex: matchingRowIndex,      // 0-based exclusive
                },
              },
            },
          ],
        },
      }));
      deletedPhysically = true;
      console.log(`[Database log: DELETE] Physically deleted row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
    }
  } catch (err) {
    console.error("[deleteRecord] Physical delete failed, using clear cells fallback:", err);
  }

  if (!deletedPhysically) {
    await callWithRetry(() => sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tableName}!A${matchingRowIndex}:ZZ${matchingRowIndex}`,
    }));
    console.log(`[Database log: DELETE] Cleared values of row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
  }

  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  } else if (upperTable === "PAROS_BOQUILLASV2") {
    delete readCache["PRODUCCIONV2"];
  }

  return true;
}

function areNozzleNewsListsEqual(listA: any[], listB: any[]): boolean {
  const arrA = Array.isArray(listA) ? listA : [];
  const arrB = Array.isArray(listB) ? listB : [];
  if (arrA.length !== arrB.length) return false;
  
  const sortedA = [...arrA].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  const sortedB = [...arrB].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  
  for (let i = 0; i < sortedA.length; i++) {
    const a = sortedA[i];
    const b = sortedB[i];
    if (
      Number(a.nozzleNumber) !== Number(b.nozzleNumber) ||
      String(a.startTime || "").trim() !== String(b.startTime || "").trim() ||
      String(a.endTime || "").trim() !== String(b.endTime || "").trim() ||
      Boolean(a.isAllShift) !== Boolean(b.isAllShift) ||
      String(a.observation || "").trim() !== String(b.observation || "").trim()
    ) {
      return false;
    }
  }
  return true;
}

// 10. Intelligent row-by-row reconciliation for fallback or bulk sync calls (Point 5, 8)
async function reconcileTableData(sheets: any, spreadsheetId: string, tableName: string, incomingData: any[]): Promise<void> {
  const upperTable = tableName.toUpperCase();
  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  }

  // Ensure headers exist as reference first (only if using Google Sheets)
  const supabase = getSupabaseClient();
  if (!supabase) {
    await ensureHeadersAndColumns(sheets, spreadsheetId, tableName);
  }

  const dbData = await readTableData(sheets, spreadsheetId, tableName);
  const { clientKey } = getIdColumnAndKey(tableName);

  const dbMap = new Map<string, any>();
  dbData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      dbMap.set(String(item[clientKey]), item);
    }
  });

  const incomingMap = new Map<string, any>();
  incomingData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      incomingMap.set(String(item[clientKey]), item);
    }
  });

  // Perform surgical inserts or updates
  for (const item of incomingData) {
    if (!item) continue;
    const itemId = String(item[clientKey]);
    if (dbMap.has(itemId)) {
      const dbItem = dbMap.get(itemId);
      const schema = TABLE_SCHEMAS[upperTable];
      const headers = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);
      
      const equalBase = areRecordsEqual(item, dbItem, headers, schema);
      let equalNozzles = true;
      if (upperTable === "PRODUCCIONV2") {
        equalNozzles = areNozzleNewsListsEqual(item.nozzleNews, dbItem.nozzleNews);
      }

      if (!equalBase || !equalNozzles) {
        console.log(`[Reconciler] Item ${itemId} has changed in table ${tableName}. Modifying single row...`);
        await updateRecord(sheets, spreadsheetId, tableName, itemId, item);
      }
    } else {
      console.log(`[Reconciler] Item ${itemId} is new in table ${tableName}. Appending...`);
      await insertRecord(sheets, spreadsheetId, tableName, item);
    }
  }

  // Safely execute deletions against incoming state
  for (const dbItem of dbData) {
    if (!dbItem) continue;
    const dbId = String(dbItem[clientKey]);
    if (!incomingMap.has(dbId)) {
      console.log(`[Reconciler] Item ${dbId} is deleted in client. Triggering single row deletion...`);
      await deleteRecord(sheets, spreadsheetId, tableName, dbId);
    }
  }
}

// API Routes
// GET Endpoint to test Supabase connection and check table columns
app.get("/api/supabase-test", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: "Supabase client is not initialized. Check your SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY env variables."
      });
    }

    const testTables = ["turnosv2", "usuariosv2", "cambio_productov2", "parosv2", "produccionv2"];
    const results: Record<string, any> = {};

    for (const table of testTables) {
      try {
        const { data, error } = await supabase.from(table).select("*").limit(1);
        results[table] = {
          success: !error,
          rowCount: data ? data.length : 0,
          columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          error: error || null
        };
      } catch (err: any) {
        results[table] = {
          success: false,
          error: err.message || err.toString()
        };
      }
    }

    return res.json({
      success: true,
      message: "Supabase connection and structure diagnostics.",
      supabaseUrl: process.env.SUPABASE_URL,
      hasKey: !!(process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      results
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || error.toString()
    });
  }
});

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
        const testRes = await callWithRetry(() => sheets.spreadsheets.get({
          spreadsheetId,
          fields: "properties.title,sheets.properties.title",
        }));
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

const readCache: Record<string, { timestamp: number; data: any[] }> = {};
const CACHE_TTL_MS = 6000; // Cache duration: 6 seconds to drastically reduce direct API calls

async function readTableData(sheets: any, spreadsheetId: string, table: string): Promise<any[]> {
  const upperTable = table.toUpperCase();
  const cached = readCache[upperTable];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try to fetch from Supabase first
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const dbList = await readFromSupabase(table);
      if (dbList !== null) {
        // Enrich data as required (e.g., nozzles reporting or shift data)
        if (upperTable === "PRODUCCIONV2") {
          await enrichProductionReportsWithNozzleNews(sheets, spreadsheetId, dbList);
        }
        if (upperTable === "PAROSV2") {
          await enrichParosOnRead(sheets, spreadsheetId, dbList);
        }

        readCache[upperTable] = { timestamp: Date.now(), data: dbList };
        return dbList;
      }
    } catch (supaErr) {
      console.error(`[Supabase Read Failback to Sheets] table ${table} read failed, trying Sheets: ${formatSupabaseError(supaErr)}`);
    }
  }

  // 2. Fallback to Google Sheets
  console.log(`[Database log: READ via Sheets] Querying table '${table}' from row 1 downward to load data.`);
  await ensureSheetExists(sheets, spreadsheetId, table);

  try {
    let rows: any[] = [];
    let headers: string[] = [];

    const schema = TABLE_SCHEMAS[upperTable];
    const expectedHeaders = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);

    const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${table}!A1:ZZ50000`,
    }));

    rows = response.data.values || [];

    if (!verifiedTables.has(upperTable)) {
      const existingHeaders = rows && rows[0] ? rows[0].map((h: any) => String(h || "").trim()) : [];
      let needsHeadersFix = false;
      let finalHeaders = existingHeaders;

      if (upperTable === "PRODUCCIONV2" && existingHeaders.some(h => h.toLowerCase() === "novedades_boquillas")) {
        needsHeadersFix = true;
        finalHeaders = existingHeaders.filter(h => h.toLowerCase() !== "novedades_boquillas");
      }

      if (finalHeaders.length === 0 || finalHeaders.every(h => h === "")) {
        console.log(`[readTableData/audit] Table ${table} header is empty. Writing default headers:`, expectedHeaders);
        await callWithRetry(() => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${table}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [expectedHeaders],
          },
        }));
        verifiedTables.add(upperTable);
        readCache[upperTable] = { timestamp: Date.now(), data: [] };
        return [];
      }

      const missingHeaders = expectedHeaders.filter(h => !finalHeaders.includes(h));
      if (missingHeaders.length > 0 || needsHeadersFix) {
        console.log(`[readTableData/audit] Table ${table} needs header repair or has missing columns. Repairing...`);
        const updatedHeaders = [...finalHeaders, ...missingHeaders];
        
        if (needsHeadersFix) {
          await callWithRetry(() => sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${table}!A1:ZZ1`,
          }));
        }

        await callWithRetry(() => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${table}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [updatedHeaders],
          },
        }));
        verifiedTables.add(upperTable);
        
        // Re-read once to align with the newly updated headers
        const response2: any = await callWithRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${table}!A1:ZZ50000`,
        }));
        rows = response2.data.values || [];
        headers = rows && rows[0] ? rows[0] : updatedHeaders;
      } else {
        verifiedTables.add(upperTable);
        headers = existingHeaders;
      }
    } else {
      headers = rows && rows[0] ? rows[0] : expectedHeaders;
    }

    if (!rows || rows.length < 1) {
      readCache[upperTable] = { timestamp: Date.now(), data: [] };
      return [];
    }

    const dataRows = rows.slice(1);

    const list = dataRows.map((row) => {
      return parseRowToClientObject(headers, row, table);
    }).filter((item) => item !== null);

    if (upperTable === "PRODUCCIONV2") {
      await enrichProductionReportsWithNozzleNews(sheets, spreadsheetId, list);
    }

    if (upperTable === "PAROSV2") {
      await enrichParosOnRead(sheets, spreadsheetId, list);
    }

    readCache[upperTable] = { timestamp: Date.now(), data: list };
    return list;
  } catch (readError: any) {
    if (readError.message?.includes("range")) {
      readCache[upperTable] = { timestamp: Date.now(), data: [] };
      return [];
    }
    throw readError;
  }
}

async function enrichProductionReportsWithNozzleNews(sheets: any, spreadsheetId: string, list: any[]) {
  try {
    const nozzleList = await readTableData(sheets, spreadsheetId, "PAROS_BOQUILLASV2");
    list.forEach((item: any) => {
      item.nozzleNews = nozzleList.filter((n: any) => n.productionId === item.id);
    });
  } catch (err) {
    console.error("Error fetching PAROS_BOQUILLASV2 on read:", err);
    list.forEach((item: any) => {
      item.nozzleNews = [];
    });
  }
}

async function enrichParosOnRead(sheets: any, spreadsheetId: string, list: any[]) {
  try {
    const [shifts, palletizers, baggers, hacs, materials, causes] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PALETIZADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "ENSACADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "HACSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "CAUSASV2").catch(() => []),
    ]);

    list.forEach((item: any) => {
      // 1. Shift Mapping (Ultra-Robust)
      const targetShiftName = String(item.shiftName || "").trim().toUpperCase();
      const shift = shifts.find((s: any) => 
        s && (
          String(s.name || "").trim().toUpperCase() === targetShiftName ||
          String(s.nombre || "").trim().toUpperCase() === targetShiftName ||
          String(s.id || "").trim().toUpperCase() === targetShiftName
        )
      );
      if (shift) {
        item.shiftId = shift.id;
      } else {
        // Try partial check
        const looseShift = shifts.find((s: any) => 
          s && (
            String(s.name || "").trim().toUpperCase().includes(targetShiftName) ||
            targetShiftName.includes(String(s.name || "").trim().toUpperCase())
          )
        );
        item.shiftId = looseShift ? looseShift.id : (item.shiftName || "");
      }

      // 2. Machine Affected (Palletizer / Bagger) - Ultra-Robust Resolution Engine
      const allMachines = [...palletizers, ...baggers];
      const targetMachineText = String(item.machineHacText || "").trim().toUpperCase();

      let pal = null;

      // Tier 1: Case-insensitive name or ID match
      if (!pal) {
        pal = allMachines.find((p: any) => {
          if (!p) return false;
          const pId = String(p.id || "").trim().toUpperCase();
          const pName = String(p.name || p.nombre || "").trim().toUpperCase();
          return pId === targetMachineText || pName === targetMachineText;
        });
      }

      // Tier 2: Alphanumeric match (removing symbols, spacing and letters)
      if (!pal) {
        const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
        pal = allMachines.find((p: any) => {
          if (!p) return false;
          const cleanId = String(p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          const cleanName = String(p.name || p.nombre || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          return cleanId === cleanTarget || cleanName === cleanTarget;
        });
      }

      // Tier 3: Match through HAC table integration
      if (!pal) {
        const hacForPal = hacs.find((h: any) => 
          h && h.hac && (
            String(h.hac).trim().toUpperCase() === targetMachineText ||
            safeHacMatch(h.hac, targetMachineText)
          )
        );
        if (hacForPal) {
          pal = allMachines.find((p: any) => {
            if (!p) return false;
            const pHacId = String(p.hacId || p.hac_id || "").trim().toUpperCase();
            const hId = String(hacForPal.id || "").trim().toUpperCase();
            const hHac = String(hacForPal.hac || "").trim().toUpperCase();
            return (
              pHacId === hId || 
              pHacId === hHac || 
              safeHacMatch(pHacId, hId) || 
              safeHacMatch(pHacId, hHac)
            );
          });
        }
      }

      // Tier 4: Inclusion / substring match
      if (!pal) {
        const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
        pal = allMachines.find((p: any) => {
          if (!p) return false;
          const cleanId = String(p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          const cleanName = String(p.name || p.nombre || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          return (
            (cleanId && cleanTarget.includes(cleanId)) || 
            (cleanTarget && cleanId.includes(cleanTarget)) ||
            (cleanName && cleanTarget.includes(cleanName)) || 
            (cleanTarget && cleanName.includes(cleanTarget))
          );
        });
      }

      // Tier 5: Split token match
      if (!pal) {
        pal = allMachines.find((p: any) => {
          if (!p) return false;
          const pName = String(p.name || p.nombre || "").trim().toUpperCase();
          return safeHacMatch(pName, targetMachineText);
        });
      }

      if (pal) {
        item.machineId = pal.id;
        item.machineName = pal.name || pal.nombre || "";
      } else {
        item.machineId = item.machineHacText || "";
        item.machineName = item.machineHacText || "";
      }

      // 3. Material
      const mat = materials.find((m: any) => m.name === item.materialDescription);
      if (mat) {
        item.materialId = mat.id;
      } else {
        item.materialId = item.materialDescription || "";
      }

      // 4. HAC
      const hacObj = hacs.find((h: any) => h.hac && safeHacMatch(h.hac, item.hacName));
      if (hacObj) {
        item.hacId = hacObj.id;
      } else {
        item.hacId = item.hacName || "";
      }

      // 5. Cause
      const causeObj = causes.find((c: any) => c.text === item.causeText || c.descripcion === item.causeText);
      if (causeObj) {
        item.causeId = causeObj.id;
      } else {
        item.causeId = item.causeText || "";
      }

      // 6. durationMinutes
      item.durationMinutes = durationMinutesFromHHMMSS(item.durationTime);

      // 7. Format time for Form (HH:mm)
      if (item.startTime && item.startTime.length === 8) {
        item.startTime = item.startTime.slice(0, 5);
      }
      if (item.endTime && item.endTime.length === 8) {
        item.endTime = item.endTime.slice(0, 5);
      }
    });

  } catch (err) {
    console.error("Error enriching PAROSV2 on read:", err);
  }
}

// Helper to format Google Sheets API errors with actionable diagnostic hints
function handleSheetsError(error: any, table: string, action: string, res: any) {
  const errMsg = error.message || error.toString();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  console.error(`Error performing '${action}' on sheet '${table}':`, error);
  
  if (error.status === 403 || errMsg.includes("permission") || errMsg.includes("403") || errMsg.includes("caller does not have permission") || errMsg.includes("unauthorized")) {
    const hint = `Error de permisos (403 Forbidden) al intentar ESCRITURA. La cuenta de servicio '${email}' no tiene permisos suficientes para modificar este documento. Por favor, abre tu planilla de Google Sheets, haz clic en el botón 'Compartir' (Share) en la esquina superior derecha, agrega o busca el correo '${email}' y cámbiale su permiso de 'Lector' (Viewer) a 'Editor'. Guarda los cambios e intenta nuevamente.`;
    return res.status(403).json({
      success: false,
      error: errMsg,
      hint,
      code: "PERMISSION_DENIED"
    });
  }

  if (errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("Requested entity was not found")) {
    const hint = "No se encuentra el Documento de Google Sheets. El GOOGLE_SHEET_ID ingresado no existe en tu cuenta o es incorrecto.";
    return res.status(404).json({
      success: false,
      error: errMsg,
      hint,
      code: "NOT_FOUND"
    });
  }
  
  return res.status(500).json({
    success: false,
    error: errMsg,
    hint: "Error interno del servidor al interactuar con Google Sheets.",
    code: "SERVER_ERROR"
  });
}

// GET Endpoint to read table
app.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    const upperTable = table.toUpperCase();
    delete readCache[upperTable];
    if (upperTable === "PRODUCCIONV2") {
      delete readCache["PAROS_BOQUILLASV2"];
    } else if (upperTable === "PAROS_BOQUILLASV2") {
      delete readCache["PRODUCCIONV2"];
    }
  }

  // Safely attempt to initialize Google Sheets client details (making them optional if Supabase is active)
  let sheets: any = null;
  let spreadsheetId: string = "";
  try {
    const sheetsClient = getSheetsClient();
    sheets = sheetsClient.sheets;
    spreadsheetId = sheetsClient.spreadsheetId;
  } catch (err) {
    console.log("[Optional Google Sheets Connection Skipped in GET]", err instanceof Error ? err.message : err);
  }

  try {
    const list = await readTableData(sheets, spreadsheetId, table);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return handleSheetsError(error, table, "read", res);
  }
});

// POST Endpoint to read/write tables
app.post("/api/sheets", async (req, res) => {
  const { action, table, data } = req.body;

  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  // Safely attempt to initialize Google Sheets client details (making them optional if Supabase is active)
  let sheets: any = null;
  let spreadsheetId: string = "";
  try {
    const sheetsClient = getSheetsClient();
    sheets = sheetsClient.sheets;
    spreadsheetId = sheetsClient.spreadsheetId;
  } catch (err) {
    console.log("[Optional Google Sheets Connection Skipped]", err instanceof Error ? err.message : err);
  }

  try {
    // Handle READ action via POST
    if (action === "read") {
      try {
        const list = await readTableData(sheets, spreadsheetId, table);
        return res.json({ success: true, data: list });
      } catch (error: any) {
        return handleSheetsError(error, table, "read", res);
      }
    }

    // Handle WRITE action (backward compatible, now safe reconciliation)
    if (action === "write") {
      try {
        if (!data) {
          return res.status(400).json({ success: false, error: "Faltan los datos para la acción write" });
        }
        await reconcileTableData(sheets, spreadsheetId, table, data);
        if (table === "PAROSV2" || table === "PRODUCCIONV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, count: data.length });
      } catch (error: any) {
        return handleSheetsError(error, table, "write", res);
      }
    }

    // Handle CREATE action
    if (action === "create") {
      try {
        const { item } = req.body;
        if (!item) {
          return res.status(400).json({ success: false, error: "Falta el parámetro 'item' para crear" });
        }
        await insertRecord(sheets, spreadsheetId, table, item);
        if (table === "PAROSV2" || table === "PRODUCCIONV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: "Registro guardado con éxito" });
      } catch (error: any) {
        return handleSheetsError(error, table, "create", res);
      }
    }

    // Handle UPDATE action
    if (action === "update") {
      try {
        const { id, item } = req.body;
        if (id === undefined || !item) {
          return res.status(400).json({ success: false, error: "Faltan 'id' o 'item' para actualizar" });
        }
        await updateRecord(sheets, spreadsheetId, table, id, item);
        if (table === "PAROSV2" || table === "PRODUCCIONV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: "Registro actualizado con éxito" });
      } catch (error: any) {
        return handleSheetsError(error, table, "update", res);
      }
    }

    // Handle DELETE action
    if (action === "delete") {
      try {
        const { id } = req.body;
        if (id === undefined) {
          return res.status(400).json({ success: false, error: "Falta el parámetro 'id' para eliminar" });
        }
        const isDeleted = await deleteRecord(sheets, spreadsheetId, table, id);
        if ((table === "PAROSV2" || table === "PRODUCCIONV2") && isDeleted) {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: isDeleted ? "Registro eliminado con éxito" : "Registro no encontrado para eliminar" });
      } catch (error: any) {
        return handleSheetsError(error, table, "delete", res);
      }
    }

    return res.status(400).json({ success: false, error: `Acción inválida: ${action}` });
  } catch (error: any) {
    return handleSheetsError(error, table, action || "unknown", res);
  }
});

// GET Endpoint to retrieve Supabase Public credentials for Client Sign-In
app.get("/api/auth/supabase/config", (req, res) => {
  return res.json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  });
});

// GET Endpoint to generate Google OAuth Authorization URL
app.get("/api/auth/google/url", (req, res) => {
  const customRedirect = req.query.redirectUri as string;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      error: "Google OAuth credentials are not configured on the server. Please define GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in environment settings."
    });
  }

  // Fallback redirect URI if client didn't supply one
  const redirectUri = customRedirect || `${req.protocol}://${req.get("host")}/auth/callback`;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    prompt: "consent"
  });

  return res.json({ success: true, url });
});

// GET OAuth Callback endpoint to handle code exchange, verify user in USUARIOSV2 and return session
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code, state } = req.query;
  const customRedirect = req.query.redirectUri as string;
  const redirectUri = customRedirect || `${req.protocol}://${req.get("host")}/auth/callback`;

  if (!code) {
    return res.status(400).send("No authorization code provided by Google OAuth.");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth is not configured on the server. Please define GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    const googleEmail = userInfoRes.data.email;
    const googleName = userInfoRes.data.name;

    if (!googleEmail) {
      return res.status(400).send("No se pudo obtener la dirección de correo electrónico de la cuenta de Google.");
    }

    // Safely attempt to initialize Google Sheets client details for user authorization list lookup
    let sheets: any = null;
    let spreadsheetId: string = "";
    try {
      const sheetsClient = getSheetsClient();
      sheets = sheetsClient.sheets;
      spreadsheetId = sheetsClient.spreadsheetId;
    } catch (err) {
      console.log("[Optional Sheets skipped for user auth in callback]", err);
    }

    // Read list of authorized users (reads from Supabase if active, else falls back to Sheets)
    const userList = await readTableData(sheets, spreadsheetId, "USUARIOSV2");
    
    // Check if the Google email matches "email" or "email2" field of any user (case-insensitive and trimmed)
    const matchedUser = userList.find((u: any) => {
      const emailA = String(u.email || u.mail || "").trim().toLowerCase();
      const emailB = String(u.email2 || "").trim().toLowerCase();
      const target = googleEmail.trim().toLowerCase();
      return emailA === target || emailB === target;
    });

    if (!matchedUser) {
      // Return beautiful high-contrast dark theme error page indicating lack of authorization
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Acceso no autorizado - PSCQUBE</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { font-family: 'Inter', sans-serif; }
            </style>
          </head>
          <body class="bg-[#0b0f19] text-gray-200 min-h-screen flex items-center justify-center p-6">
            <div class="max-w-md w-full bg-[#151c2c] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
              <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-white mb-2">Acceso No Autorizado</h1>
              <p class="text-sm text-gray-400 mb-6 font-medium leading-relaxed">
                La dirección de correo electrónico <strong class="text-red-400 font-semibold">${googleEmail}</strong> no está registrada como usuario habilitado en el sistema <strong>PSCQUBE</strong>.
              </p>
              <div class="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-left mb-6 text-xs text-yellow-300/90 leading-relaxed font-mono">
                Póngase en contacto con el Super Usuario o Administrador del sistema para que registre este correo en las columnas email o email2 de la tabla "usuariosv2".
              </div>
              <button onclick="cerrarVentana()" class="w-full bg-[#1b2234] hover:bg-[#232c42] text-white py-3 px-4 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary">
                Cerrar e Intentar de Nuevo
              </button>
            </div>
            <script>
              function cerrarVentana() {
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_ERROR', 
                    error: 'Correo no autorizado',
                    detail: 'El correo ${googleEmail} no está registrado en la base de datos de usuarios (usuariosv2).'
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }
            </script>
          </body>
        </html>
      `);
    }

    // Success! Save session on client side via message to opener
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Autenticación exitosa - PSCQUBE</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-[#0b0f19] text-gray-200 min-h-screen flex items-center justify-center p-6 font-sans">
          <div class="max-w-md w-full bg-[#151c2c] border border-emerald-500/20 rounded-2xl p-8 text-center shadow-2xl">
            <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">Ingreso Autorizado</h1>
            <p class="text-sm text-gray-400 mb-6 font-medium">
              ¡Bienvenido, <strong class="text-emerald-400 font-bold">${matchedUser.nombre || matchedUser.name || googleName}</strong>! Has ingresado correctamente.
            </p>
            <p class="text-xs text-gray-500 animate-pulse">Esta ventana se cerrará automáticamente.</p>
          </div>
          <script>
            // Prepare matched user with client mappings standard
            const matchedUserObj = ${JSON.stringify(matchedUser)};
            
            // Re-map attributes if they arrived in Sheet raw format
            if (matchedUserObj.nombre && !matchedUserObj.name) matchedUserObj.name = matchedUserObj.nombre;
            if (matchedUserObj.usuariosap && !matchedUserObj.sapUser) matchedUserObj.sapUser = matchedUserObj.usuariosap;
            if (matchedUserObj.puesto && !matchedUserObj.position) matchedUserObj.position = matchedUserObj.puesto;
            if (matchedUserObj.perfil && !matchedUserObj.profile) matchedUserObj.profile = matchedUserObj.perfil;
            if (matchedUserObj.permisos && !matchedUserObj.permissions) matchedUserObj.permissions = matchedUserObj.permisos;

            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: matchedUserObj,
                googleEmail: "${googleEmail}"
              }, '*');
              window.close();
            } else {
              sessionStorage.setItem('pscqube_user', JSON.stringify(matchedUserObj));
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error);
    return res.status(500).send(`Error de inicio de sesión de Google: ${error.message || error.toString()}`);
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
