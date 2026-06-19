import { Router } from "express";
import { GenericRepository } from "../repositories/generic.repository.js";
import { ProductionService } from "../services/production.service.js";
import { ParosService } from "../services/paros.service.js";
import { MaestrosService } from "../services/maestros.service.js";
import { TABLE_SCHEMAS } from "../schemas/tableSchemas.js";
import { getIdColumnAndKey } from "../utils/mappings.js";
import { areRecordsEqual, areNozzleNewsListsEqual, areDetailsListsEqual } from "../utils/helpers.js";
import { getSupabaseClient } from "../services/supabase.service.js";
import { invalidateCache } from "../cache/cache.service.js";

const router = Router();

// Helper to trace and log incoming calls with comprehensive diagnostics
function logTraceRequest(req: any, endpoint: string, tableRequested: string) {
  const timestamp = new Date().toISOString();
  const queryParams = JSON.stringify(req.query || {});
  const bodyParams = req.body ? JSON.stringify(req.body) : "{}";
  const userAgent = req.headers["user-agent"] || "No User-Agent";
  const referer = req.headers["referer"] || "No Referer";
  const source = req.query.source || "N/A";
  const bypassCache = req.query.bypassCache || "false";
  
  // IP Extraction & Anonymization
  let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  let ip = 'unknown';
  if (typeof rawIp === 'string') {
    const firstIp = rawIp.split(',')[0].trim();
    if (firstIp.includes('.')) {
      const parts = firstIp.split('.');
      if (parts.length >= 2) {
        ip = `${parts[0]}.${parts[1]}.x.x`;
      } else {
        ip = firstIp;
      }
    } else if (firstIp.includes(':')) {
      const parts = firstIp.split(':');
      if (parts.length >= 2) {
        ip = `${parts[0]}:${parts[1]}:x:x`;
      } else {
        ip = firstIp;
      }
    } else {
      ip = firstIp;
    }
  }

  // Identify application origin callers if customized headers exist
  const appCallerHeader = req.headers["x-app-caller"] || "Not Specified (Legacy/Generic)";
  const secChUa = req.headers["sec-ch-ua"] || "N/A";
  const secChUaPlatform = req.headers["sec-ch-ua-platform"] || "N/A";
  const secFetchSite = req.headers["sec-fetch-site"] || "N/A";
  const secFetchMode = req.headers["sec-fetch-mode"] || "N/A";
  const authHeader = req.headers["authorization"] ? "Attached" : "None";
  const cookieHeader = req.headers["cookie"] ? "Attached" : "None";

  console.log(`
====== [PSCQUBE API TRACE LOG] ======
Timestamp (Exact): ${timestamp}
Accessed Endpoint: ${endpoint}
Requested Table  : ${tableRequested}
Bypass Cache Flag: ${bypassCache}
Origin Source Tracker: ${source}
Anonymized IP    : ${ip}
Received Query   : ${queryParams}
Received Body    : ${bodyParams}
User-Agent       : ${userAgent}
sec-ch-ua        : ${secChUa}
sec-ch-ua-plat   : ${secChUaPlatform}
sec-fetch-site   : ${secFetchSite}
sec-fetch-mode   : ${secFetchMode}
Referer          : ${referer}
App Caller ID    : ${appCallerHeader}
Credentials Meta : Auth=${authHeader}, Cookies=${cookieHeader}
======================================
`);
}

// Reconciles incoming collection list against cached database state
async function reconcileTableData(tableName: string, incomingData: any[], allowDeleteMissing: boolean = false): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const dbData = await GenericRepository.findAll(tableName);
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

  for (const item of incomingData) {
    if (!item) continue;

    // Enrich item if needed (so looking up shiftDescription, materialDescription, etc. happens BEFORE we compare or save)
    await MaestrosService.enrichDataIfNeeded(tableName, [item]);

    const itemId = String(item[clientKey]);
    if (dbMap.has(itemId)) {
      const dbItem = dbMap.get(itemId);
      const schema = TABLE_SCHEMAS[upperTable];
      const headers = schema ? schema.sheetHeaders : [];
      
      const equalBase = areRecordsEqual(item, dbItem, headers, schema);
      let equalNozzles = true;
      let equalDetails = true;
      if (upperTable === "PRODUCCIONV2") {
        equalNozzles = areNozzleNewsListsEqual(item.nozzleNews, dbItem.nozzleNews);
        equalDetails = areDetailsListsEqual(item.materialsDetails, dbItem.materialsDetails);
      }

      if (!equalBase || !equalNozzles || !equalDetails) {
        console.log(`[Reconciler] Item ${itemId} has changed in table ${tableName}. Modifying...`);
        await GenericRepository.update(tableName, itemId, item);
        if (upperTable === "PRODUCCIONV2") {
          await ProductionService.syncProductionChildren(item);
        }
      }
    } else {
      console.log(`[Reconciler] Item ${itemId} is new in table ${tableName}. Appending...`);
      await GenericRepository.create(tableName, item);
      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }
    }
  }

  // Deletions against incoming state
  if (allowDeleteMissing) {
    for (const dbItem of dbData) {
      if (!dbItem) continue;
      const dbId = String(dbItem[clientKey]);
      if (!incomingMap.has(dbId)) {
        console.log(`[Reconciler] Item ${dbId} is deleted in client. Triggering deletion...`);
        if (upperTable === "PRODUCCIONV2") {
          await ProductionService.deleteProductionChildren(dbId);
        }
        await GenericRepository.delete(tableName, dbId);
      }
    }
  }
}

// GET Endpoint to test Supabase connection and check table columns
router.get("/api/supabase-test", async (req, res) => {
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

const APP_BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || "v2.0.1-stable";

// GET Version Endpoint
router.get("/api/version", (req, res) => {
  return res.json({
    success: true,
    version: APP_BUILD_VERSION
  });
});

// GET Status Endpoint (Google Sheets status is now mock-returned as we operate purely on Supabase)
router.get("/api/sheets/status", async (req, res) => {
  return res.json({
    success: true,
    configured: true,
    hasKey: true,
    isJsonConfigured: true,
    email: "supabase-active-PSCQUBE@supabase.co",
    sheetId: "PSCQUBE_SUPABASE_DATABASE",
    diagnostics: {
      connectionOk: true,
      message: "pscqube is fully operational on Supabase database cloud persistence."
    }
  });
});

// GET Catalogos (returns all master directories in one single call)
router.get("/api/catalogos", async (req, res) => {
  logTraceRequest(req, "GET /api/catalogos", "ALL_CATALOGUES_BULK");
  const bypassCache = req.query.bypassCache === "true";
  const catalogTables = [
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

  try {
    const results: Record<string, any[]> = {};
    for (const table of catalogTables) {
      if (bypassCache) {
        invalidateCache(table);
      }
      results[table] = await GenericRepository.findAll(table);
    }
    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("GET /api/catalogos Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer catálogos" });
  }
});

// GET Produccion Endpoint
router.get("/api/produccion", async (req, res) => {
  logTraceRequest(req, "GET /api/produccion", "PRODUCCIONV2");
  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    invalidateCache("PRODUCCIONV2");
  }
  try {
    let list = await GenericRepository.findAll("PRODUCCIONV2");

    // Apply active filters at backend level if provided!
    const { date } = req.query as Record<string, string>;
    if (date) {
      list = list.filter((r: any) => r.date === date);
    }

    await ProductionService.enrichProductionReportsWithNozzleNews(list);
    await ProductionService.enrichProductionReportsWithDetails(list);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/produccion Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer producción" });
  }
});

// GET Paros Endpoint
router.get("/api/paros", async (req, res) => {
  logTraceRequest(req, "GET /api/paros", "PAROSV2");
  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    invalidateCache("PAROSV2");
  }
  try {
    let list = await GenericRepository.findAll("PAROSV2");

    // Apply active filters at backend level if provided!
    const { date } = req.query as Record<string, string>;
    if (date) {
      list = list.filter((r: any) => r.date === date);
    }

    await ParosService.enrichParosOnRead(list);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/paros Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer paros" });
  }
});

// GET Endpoint to read tables generically
router.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  logTraceRequest(req, "GET /api/sheets", table || "unspecified");
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    invalidateCache(table);
  }

  try {
    let list = await GenericRepository.findAll(table);

    const upperTable = table.toUpperCase();

    // List of transactional/filterable tables
    const filterableTables = [
      "PAROSV2",
      "PRODUCCIONV2",
      "CONTROL_FECHADORV2",
      "CONTROL_BALANZAV2",
      "INVENTARIO_FISICOV2",
      "CLASISFICACION_PALLETSV2",
      "CAMBIO_PRODUCTOV2",
      "DESPACHOSV2",
      "ESTADO_CALLESV2",
      "CARGA_COMBUSTIBLEV2"
    ];

    if (filterableTables.includes(upperTable)) {
      const { date } = req.query as Record<string, string>;
      if (date) {
        list = list.filter((r: any) => r.date === date);
      }
    }

    if (upperTable === "PRODUCCIONV2") {
      await ProductionService.enrichProductionReportsWithNozzleNews(list);
      await ProductionService.enrichProductionReportsWithDetails(list);
    } else if (upperTable === "PAROSV2") {
      await ParosService.enrichParosOnRead(list);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/sheets Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error al leer datos de " + table
    });
  }
});

// POST Endpoint to read/write/create/update/delete tables
router.post("/api/sheets", async (req, res) => {
  const { action, table, data } = req.body;
  logTraceRequest(req, `POST /api/sheets (action: ${action || 'n/a'})`, table || "unspecified");

  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const upperTable = table.toUpperCase();

  try {
    // 1. READ action
    if (action === "read") {
      const list = await GenericRepository.findAll(table);
      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.enrichProductionReportsWithNozzleNews(list);
        await ProductionService.enrichProductionReportsWithDetails(list);
      } else if (upperTable === "PAROSV2") {
        await ParosService.enrichParosOnRead(list);
      }
      return res.json({ success: true, data: list });
    }

    // 2. WRITE action (reconciliation)
    if (action === "write") {
      if (!data) {
        return res.status(400).json({ success: false, error: "Faltan los datos para la acción write" });
      }
      let allowDeleteMissing = req.body.allowDeleteMissing === true;
      
      const transactionalTables = [
        "PAROSV2",
        "PRODUCCIONV2",
        "DESPACHOSV2",
        "CONTROL_FECHADORV2",
        "CONTROL_BALANZAV2",
        "INVENTARIO_FISICOV2",
        "CLASISFICACION_PALLETSV2",
        "CAMBIO_PRODUCTOV2",
        "ESTADO_CALLESV2",
        "CARGA_COMBUSTIBLEV2"
      ];
      if (transactionalTables.includes(upperTable)) {
        allowDeleteMissing = false;
      }

      await reconcileTableData(table, data, allowDeleteMissing);
      
      invalidateCache(table);

      if (table === "PAROSV2" || table === "PRODUCCIONV2") {
        await ProductionService.autoRecalculateProductionMetrics();
      }
      return res.json({ success: true, count: data.length });
    }

    // 3. CREATE action
    if (action === "create") {
      const { item } = req.body;
      if (!item) {
        return res.status(400).json({ success: false, error: "Falta el parámetro 'item' para crear" });
      }

      await MaestrosService.enrichDataIfNeeded(table, [item]);

      await GenericRepository.create(table, item);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      invalidateCache(table);

      if (table === "PAROSV2" || table === "PRODUCCIONV2") {
        await ProductionService.autoRecalculateProductionMetrics();
      }
      return res.json({ success: true, message: "Registro guardado con éxito" });
    }

    // 4. UPDATE action
    if (action === "update") {
      const { id, item } = req.body;
      if (id === undefined || !item) {
        return res.status(400).json({ success: false, error: "Faltan 'id' o 'item' para actualizar" });
      }

      await MaestrosService.enrichDataIfNeeded(table, [item]);

      await GenericRepository.update(table, id, item);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      invalidateCache(table);

      if (table === "PAROSV2" || table === "PRODUCCIONV2") {
        await ProductionService.autoRecalculateProductionMetrics();
      }
      return res.json({ success: true, message: "Registro actualizado con éxito" });
    }

    // 5. DELETE action
    if (action === "delete") {
      const { id } = req.body;
      if (id === undefined) {
        return res.status(400).json({ success: false, error: "Falta el parámetro 'id' para eliminar" });
      }

      if (upperTable === "PRODUCCIONV2") {
        console.log(`[Delete Action] Cascade deleting children for production report: ${id}`);
        await ProductionService.deleteProductionChildren(id);
      }

      // Supabase cascade handled directly inside the repository and service delete calls
      const isDeleted = await GenericRepository.delete(table, id);
      invalidateCache(table);

      if ((table === "PAROSV2" || table === "PRODUCCIONV2") && isDeleted) {
        await ProductionService.autoRecalculateProductionMetrics();
      }
      return res.json({ success: true, message: isDeleted ? "Registro eliminado con éxito" : "Registro no encontrado para eliminar" });
    }

    return res.status(400).json({ success: false, error: "Acción no reconocida" });

  } catch (error: any) {
    console.error(`POST /api/sheets Error action:${action} table:${table}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || `Error al procesar acción ${action} en tabla ${table}`
    });
  }
});

export default router;
