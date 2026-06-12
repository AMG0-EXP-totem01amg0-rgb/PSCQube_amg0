import { createClient } from "@supabase/supabase-js";
import { TABLE_ALIASES, getIdColumnAndKey, mapItemForSupabase, mapSupabaseRowToClient } from "../utils/mappings.js";
import { sanitizeColumnName } from "../utils/sanitizers.js";
import { formatSupabaseError, extractColumnFromError } from "../utils/helpers.js";
import { invalidateCache } from "../cache/cache.service.js";

let supabaseClient: any = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      // Auto-sanitize the URL to prevent /rest/v1/ invalid path errors
      supabaseUrl = supabaseUrl.trim();
      try {
        const parsed = new URL(supabaseUrl);
        supabaseUrl = parsed.protocol + "//" + parsed.host;
      } catch (e) {
        // Fallback regex sanitization
        supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
      }

      if (supabaseUrl.includes("/dashboard") || supabaseUrl.includes("/project/")) {
        console.error(`
🚨 [Supabase Configuration Error] 🚨
Your SUPABASE_URL is configured with the Dashboard/Studio URL: "${supabaseUrl}".
This is why you are receiving HTML elements instead of API responses.
Please update SUPABASE_URL to your Project API URL, which looks like: https://xxxx.supabase.co
--------------------------------------------------`);
        return null;
      }
      console.log(`[Supabase Service] Auto-initializing client for sanitized URL: ${supabaseUrl}`);
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn(`[Supabase Service] Missing SUPABASE_URL or SUPABASE_KEY. Supabase operations will be skipped.`);
    }
  }
  return supabaseClient;
}

export async function readFromSupabase(tableName: string): Promise<any[] | null> {
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

export async function writeToSupabase(tableName: string, action: 'insert' | 'update' | 'upsert', idKey: string, idVal: any, rawData: any): Promise<any> {
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
        query = supabase.from(currentTable).insert([payload]).select();
      } else if (action === 'update') {
        const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
        
        // We will perform the query using the DB column name
        query = supabase.from(currentTable).update(payload).eq(dbIdCol, cleanIdVal).select();
      } else {
        query = supabase.from(currentTable).upsert([payload], { onConflict: dbIdCol }).select();
      }

      const { data, error } = await query;

      if (!error) {
        if (action === 'update') {
          if (!data || data.length === 0) {
            const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
            throw new Error(`No se actualizó ningún registro en ${currentTable} con ${dbIdCol}=${cleanIdVal}`);
          }
        }
        console.log(`[Supabase Write] Successfully completed ${action} in ${currentTable} after ${attempt} attempts.`);
        return data;
      }

      // If we got an error, analyze it
      let errStr = error.message || "";
      if (errStr.includes("<!DOCTYPE") || errStr.includes("<html")) {
        console.error(`🚨 [Supabase Error] Received an HTML response page instead of JSON API response. This occurs when SUPABASE_URL is configured to the browser's Studio dashboard webpage instead of the REST API Endpoint URL.`);
        throw error; // Stop retrying and throw immediately on HTML configuration errors
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

      throw error;

    } catch (err: any) {
      console.error(`[Supabase Write Failure] table ${currentTable} failed completely: ${formatSupabaseError(err)}`);
      throw err;
    }
  }
  throw new Error(`No se pudo completar la escritura en Supabase para la tabla ${tableName} tras ${maxAttempts} intentos.`);
}

export async function deleteFromSupabase(tableName: string, idKey: string, idVal: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const table = tableName.toLowerCase();
  const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;

  const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);
  
  const tablesToTry = [table, ...(TABLE_ALIASES[table] || [])];
  if (table.endsWith("v2") && !tablesToTry.includes(table.slice(0, -2))) {
    tablesToTry.push(table.slice(0, -2));
  }

  // 5. Si la eliminación afecta PRODUCCIONV2: eliminar previamente PAROS_BOQUILLASV2 y DETALLES_PRODUCCIONV2
  const upperTable = tableName.toUpperCase();
  if (upperTable === "PRODUCCIONV2") {
    console.log(`[Supabase Delete Cascade] Executing cascade deletes for production report '${cleanIdVal}'...`);
    
    try {
      const { data: bqData, error: bqError } = await supabase
        .from("paros_boquillasv2")
        .delete()
        .eq("produccion_id", cleanIdVal)
        .select();
      console.log(`[Supabase Delete Cascade] Deleted ${bqData ? bqData.length : 0} nozzle entries from paros_boquillasv2.`);
    } catch (bqErr) {
      console.error(`[Supabase Delete Cascade Error] Failed removing related paros_boquillasv2:`, bqErr);
    }

    try {
      const { data: bqDetails, error: bqDetError } = await supabase
        .from("detalles_produccionv2")
        .delete()
        .eq("produccion_id", cleanIdVal)
        .select();
      console.log(`[Supabase Delete Cascade] Deleted ${bqDetails ? bqDetails.length : 0} production detail entries from detalles_produccionv2.`);
    } catch (detErr) {
      console.error(`[Supabase Delete Cascade Error] Failed removing related detalles_produccionv2:`, detErr);
    }
  }

  let lastError: any = null;
  for (const targetTable of tablesToTry) {
    try {
      // 1. Ejecutar .delete().eq(...).select()
      let colUsed = dbIdCol;
      const { data, error } = await supabase.from(targetTable).delete().eq(dbIdCol, cleanIdVal).select();

      if (error) {
        let errStr = (error.message || "").toLowerCase();
        const isTableMissing = error.code === "42P01" || errStr.includes("does not exist") || errStr.includes("no existe") || errStr.includes("not found");

        if (isTableMissing) {
          console.log(`[Supabase Delete Warning] Table '${targetTable}' does not exist. Trying next fallback...`);
          continue;
        }

        // Try idKey as fallback
        if (idKey && idKey !== dbIdCol) {
          colUsed = idKey;
          const rxFallback = await supabase.from(targetTable).delete().eq(idKey, cleanIdVal).select();
          if (!rxFallback.error) {
            const deletedCount = rxFallback.data ? rxFallback.data.length : 0;
            console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);
            if (rxFallback.data !== null && deletedCount > 0) {
              invalidateCache(tableName);
              return true;
            }
          }
        }

        // Try cleanIdKey as fallback
        const cleanIdKey = sanitizeColumnName(dbIdCol);
        if (cleanIdKey !== dbIdCol) {
          colUsed = cleanIdKey;
          const rx = await supabase.from(targetTable).delete().eq(cleanIdKey, cleanIdVal).select();
          if (!rx.error) {
            const deletedCount = rx.data ? rx.data.length : 0;
            console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);
            if (rx.data !== null && deletedCount > 0) {
              invalidateCache(tableName);
              return true;
            }
          }
        }

        throw error;
      }

      // 2. Verificar: data !== null && data.length > 0
      const deletedCount = data ? data.length : 0;
      
      // 4. Registrar logs: (tabla, columna utilizada, id recibido, cantidad de filas eliminadas)
      console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);

      if (data !== null && deletedCount > 0) {
        // 6. Invalidar cache inmediatamente después de una eliminación exitosa
        invalidateCache(tableName);
        return true;
      } else {
        // 3. Si no se eliminó ninguna fila: NO devolver éxito
        console.warn(`[Supabase Delete Warning] No rows deleted in table ${targetTable} matching ${colUsed}=${cleanIdVal} (returned count:0)`);
        return false;
      }

    } catch (err) {
      console.warn(`[Supabase Delete Trial Error] Trial for '${targetTable}' failed: ${formatSupabaseError(err)}`);
      lastError = err;
    }
  }

  console.error(`[Supabase Delete Failure] All delete trials for table ${table} failed.`);
  throw lastError || new Error(`Todas las pruebas de eliminación en Supabase para la tabla ${table} fallaron.`);
}
