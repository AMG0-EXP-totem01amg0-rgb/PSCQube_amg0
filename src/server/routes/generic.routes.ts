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
        if (upperTable === "PRODUCCIONV2") {
          await ProductionService.syncProductionChildren(item);
        }
        await GenericRepository.update(tableName, itemId, item);
      }
    } else {
      console.log(`[Reconciler] Item ${itemId} is new in table ${tableName}. Appending...`);
      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }
      await GenericRepository.create(tableName, item);
    }
  }

  // Deletions against incoming state
  if (upperTable === "PAROSV2") {
    console.log(`[SAFE WRITE] Delete-missing reconciliation disabled for PAROSV2.`);
  } else if (allowDeleteMissing) {
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

// GET Endpoint to read tables generically
router.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    invalidateCache(table);
  }

  try {
    const list = await GenericRepository.findAll(table);

    const upperTable = table.toUpperCase();
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
      const allowDeleteMissing = req.body.allowDeleteMissing === true;
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

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      await GenericRepository.create(table, item);
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

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      await GenericRepository.update(table, id, item);
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
