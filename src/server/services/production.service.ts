import { GenericRepository } from "../repositories/generic.repository.js";
import { getSupabaseClient } from "./supabase.service.js";
import { safeMatch, safeHacMatch } from "../utils/helpers.js";
import { invalidateCache } from "../cache/cache.service.js";
import { ParosService } from "./paros.service.js";

function isStopForMachine(stop: any, machineId: string | any, dbPalletizers: any[], dbBaggers: any[]) {
  if (!stop || !machineId) return false;
  
  let targetId = "";
  if (typeof machineId === 'object' && machineId !== null) {
    targetId = String(machineId.id || machineId.hacId || machineId.hac_id || machineId.name || machineId.nombre || "").trim().toUpperCase();
  } else {
    targetId = String(machineId).trim().toUpperCase();
  }
  
  if (!targetId) return false;

  const selectedMac = dbPalletizers.find((p: any) => p && (
    String(p.id).trim().toUpperCase() === targetId ||
    String(p.hacId || p.hac_id || "").trim().toUpperCase() === targetId ||
    String(p.name || p.nombre || "").trim().toUpperCase() === targetId
  )) || dbBaggers.find((b: any) => b && (
    String(b.id).trim().toUpperCase() === targetId ||
    String(b.hacId || b.hac_id || "").trim().toUpperCase() === targetId ||
    String(b.name || b.nombre || "").trim().toUpperCase() === targetId
  ));

  const stopMachineId = String(stop.machineId || stop.maquina_id || "").trim().toUpperCase();
  const stopMachineName = String(stop.machineName || stop.nombre_maquina || "").trim().toUpperCase();
  const stopMachineHacText = String(stop.machineHacText || stop.maquina_hac || "").trim().toUpperCase();

  if (!selectedMac) {
    return stopMachineId === targetId || stopMachineHacText === targetId || stopMachineName === targetId;
  }

  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();

  const stopFields = [stopMachineId, stopMachineName, stopMachineHacText].filter(Boolean);
  const macFields = [macId, macName, macHacId].filter(Boolean);

  for (const sField of stopFields) {
    for (const mField of macFields) {
      if (sField === mField) return true;
    }
  }

  const cleanStr = (val: string) => val.replace(/[^A-Z0-9]/g, '');
  const cleanStopFields = stopFields.map(cleanStr).filter(Boolean);
  const cleanMacFields = macFields.map(cleanStr).filter(Boolean);

  for (const sClean of cleanStopFields) {
    for (const mClean of cleanMacFields) {
      if (sClean === mClean) return true;
    }
  }

  if (macHacId && (stopMachineHacText.includes(macHacId) || macHacId.includes(stopMachineHacText))) return true;

  return false;
}

function isStopForShift(stop: any, shiftId: string | null | undefined, dbShifts: any[]) {
  if (!stop || !shiftId) return false;
  const targetId = String(shiftId).trim().toUpperCase();
  
  const selectedS = dbShifts.find((s: any) => s && String(s.id).trim().toUpperCase() === targetId);
  if (!selectedS) {
    const stopShiftId = String(stop.shiftId || '').trim().toUpperCase();
    return stopShiftId === targetId;
  }
  
  const sId = String(selectedS.id).trim().toUpperCase();
  const sName = String(selectedS.name || selectedS.nombre || "").trim().toUpperCase();
  
  const stopShiftId = String(stop.shiftId || "").trim().toUpperCase();
  const stopShiftName = String(stop.shiftName || stop.turno || "").trim().toUpperCase();
  
  if (stopShiftId === sId) return true;
  if (stopShiftName === sName) return true;
  if (stopShiftId === sName) return true;
  if (stopShiftName === sId) return true;
  
  // Robust substring matching (e.g. "TURNO A" matching or including "A")
  if (sName && stopShiftName && (stopShiftName.includes(sName) || sName.includes(stopShiftName))) return true;
  
  // Custom normalization: strip "TURNO" prefix/suffix
  const cleanSName = sName.replace("TURNO", "").trim();
  const cleanStopShiftName = stopShiftName.replace("TURNO", "").trim();
  if (cleanSName && cleanStopShiftName && cleanSName === cleanStopShiftName) return true;

  return false;
}

export class ProductionService {
  static async enrichProductionRecords(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbPalletizers, dbBaggers, dbMaterials, dbHacs, dbParos, dbCauses, dbCapacities, dbDetails] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PALETIZADORAV2").catch(() => []),
        GenericRepository.findAll("ENSACADORAV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => []),
        GenericRepository.findAll("HACSV2").catch(() => []),
        GenericRepository.findAll("PAROSV2").catch(() => []),
        GenericRepository.findAll("CAUSASV2").catch(() => []),
        GenericRepository.findAll("CAPACIDADESV2").catch(() => []),
        GenericRepository.findAll("DETALLES_PRODUCCIONV2").catch(() => []),
      ]);

      // Enrich raw dbParos with durationMinutes, machineId, shiftId, etc.
      await ParosService.enrichParosOnRead(dbParos);

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

        // Fallback for material ID lookup search details first if missing in root PRODUCCIONV2
        const rDetailsOnItem = dbDetails.filter((d: any) => 
          String(d.productionId || d.produccion_id || d.id_produccion || "").trim() === String(item.id || "").trim()
        );
        const matId = item.materialId || item.material_id || (rDetailsOnItem[0] ? (rDetailsOnItem[0].materialId || rDetailsOnItem[0].material_id) : "");
        const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, matId));
        const matName = mat ? (mat.nombre || mat.name || "") : "";
        item.materialDescription = matName;
        item["decripcion_material"] = matName;
        item["descripcion_material"] = matName;

        const shiftDurationHours = shift ? Number(shift.durationHours || 8) : 8;

        const stops = dbParos.filter((s: any) => 
          s &&
          String(s.date || s.fecha || "").substring(0, 10) === String(item.date || item.fecha || "").substring(0, 10) &&
          isStopForShift(s, shiftId, dbShifts) &&
          isStopForMachine(s, palId, dbPalletizers, dbBaggers)
        );
        const stopMins = stops.reduce((sum: number, s: any) => sum + (Number(s.durationMinutes || s.duracion_minutos) || 0), 0);
        const stopHours = stopMins / 60;
        const actualHsMarchaVal = shiftDurationHours - stopHours;

        const externalStopMinutes = stops
          .filter((s: any) => {
            const c = dbCauses.find((cause: any) => 
              cause && (
                cause.id === s.causeId || 
                cause.text === s.causeText || 
                cause.descripcion === s.causeText || 
                cause.id === s.causeText
              )
            );
            const stopType = String(s.stopType || c?.stopType || 'INTERNO').toUpperCase();
            return stopType === 'EXTERNO';
          })
          .reduce((sum: number, s: any) => sum + (Number(s.durationMinutes || s.duracion_minutos) || 0), 0);
        const externalStopHours = externalStopMinutes / 60;

        // Disponibilidad = (hs. de paro externo + hs. de marcha) / duración de turno
        let availVal = shiftDurationHours > 0 ? (externalStopHours + Math.max(0, actualHsMarchaVal)) / shiftDurationHours : 0;
        availVal = Math.min(1, Math.max(0, availVal));
        const availabilityPercent = Math.round(availVal * 100);

        const availStr = `${availabilityPercent}%`;
        item.availability = availStr;
        item.disponibilidad = availStr;

        // Rendimiento
        const contextReports = data.filter((r: any) => 
          r &&
          String(r.date || r.fecha || "").substring(0, 10) === String(item.date || item.fecha || "").substring(0, 10) &&
          (safeMatch(r.shiftId, shiftId) || safeMatch(r.turno_id, shiftId)) &&
          (safeMatch(r.palletizerId, palId) || safeMatch(r.palletizadora_id, palId))
        );

        let perfVal = 0;
        const actualHsMarchaUsed = Math.max(0, actualHsMarchaVal);

        if (contextReports.length > 0 && actualHsMarchaUsed > 0) {
          const totalTons = contextReports.reduce((sum, r) => sum + (Number(r.tonsProduced || r.tn_producidas) || 0), 0);
          const sumTonsOverBDP = contextReports.reduce((sum, r) => sum + ((Number(r.tonsProduced || r.tn_producidas) || 0) / (Number(r.bdp || r.bdp_teorico) || 100)), 0);
          const theoreticBDPWeighted = sumTonsOverBDP > 0 ? totalTons / sumTonsOverBDP : 100;
          perfVal = Math.min(1.5, (totalTons / actualHsMarchaUsed) / theoreticBDPWeighted);
        }

        const yieldPercent = Math.round(perfVal * 100);
        const yieldStr = `${yieldPercent}%`;
        item.yield = yieldStr;
        item.rendimiento = yieldStr;

        const oeeVal = availVal * perfVal;
        const oeePercent = Math.round(oeeVal * 100);
        const oeeStr = `${oeePercent}%`;
        item.oee = oeeStr;
      });
    } catch (enrichError) {
      console.error("Error enriching production data:", enrichError);
    }
  }

  static async autoRecalculateProductionMetrics(targetDate?: string, targetShiftId?: string): Promise<void> {
    try {
      console.log("[autoRecalculateProductionMetrics] Starting automatic OEE/Availability/Yield recalculation...");
      invalidateCache("PRODUCCIONV2");
      invalidateCache("PAROSV2");

      const productionList = await GenericRepository.findAll("PRODUCCIONV2");
      if (!productionList || productionList.length === 0) {
        console.log("[autoRecalculateProductionMetrics] No production records found to recalculate.");
        return;
      }

      await ProductionService.enrichProductionRecords(productionList);

      const targetDateClean = targetDate ? String(targetDate).substring(0, 10) : undefined;
      const targetShiftClean = targetShiftId ? String(targetShiftId).trim().toUpperCase() : undefined;

      const toUpdate = productionList.filter((r: any) => {
        if (!r) return false;
        if (targetDateClean && String(r.date || r.fecha || "").substring(0, 10) !== targetDateClean) return false;
        if (targetShiftClean && String(r.shiftId || r.turno_id || "").trim().toUpperCase() !== targetShiftClean) return false;
        return true;
      });

      console.log(`[autoRecalculateProductionMetrics] Recalculated ${productionList.length} records. Committing ${toUpdate.length} target updates to Supabase...`);
      for (const report of toUpdate) {
        await GenericRepository.update("PRODUCCIONV2", report.id, report);
      }
      
      invalidateCache("PRODUCCIONV2");
      console.log("[autoRecalculateProductionMetrics] Recalculation completed successfully.");
    } catch (err) {
      console.error("[autoRecalculateProductionMetrics] Failed to auto-recalculate:", err);
    }
  }

  static async deleteNozzlesForProduction(productionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const list = await GenericRepository.findAll("PAROS_BOQUILLASV2");
      const matching = list.filter((n: any) => 
        String(n.productionId || n.produccion_id || n.id_produccion || "").trim() === String(productionId || "").trim()
      );
      for (const match of matching) {
        await GenericRepository.delete("PAROS_BOQUILLASV2", match.id);
      }
    } catch (err) {
      console.error("Error deleting old nozzles for productionId " + productionId + ":", err);
    }
  }

  static async syncProductionNozzles(item: any): Promise<void> {
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

      await ProductionService.deleteNozzlesForProduction(item.id);

      for (const entry of nozzleNewsEntries) {
        await GenericRepository.create("PAROS_BOQUILLASV2", entry);
      }
    } catch (err) {
      console.error("Error syncing production nozzles:", err);
    }
  }

  static async deleteDetailsForProduction(productionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const list = await GenericRepository.findAll("DETALLES_PRODUCCIONV2");
      const matching = list.filter((d: any) => 
        String(d.productionId || d.produccion_id || d.id_produccion || "").trim() === String(productionId || "").trim()
      );
      for (const match of matching) {
        await GenericRepository.delete("DETALLES_PRODUCCIONV2", match.id);
      }
    } catch (err) {
      console.error("Error deleting old details for productionId " + productionId + ":", err);
    }
  }

  static async syncProductionDetails(item: any): Promise<void> {
    if (!item.materialsDetails || !Array.isArray(item.materialsDetails)) return;
    try {
      const detailEntries = item.materialsDetails.map((det: any) => ({
        id: det.id || Math.random().toString(36).substr(2, 9),
        productionId: item.id,
        materialId: det.materialId,
        materialDescription: det.materialDescription || det.materialName || "",
        bagsProduced: Number(det.bagsProduced || det.bags || 0),
        tonsProduced: Number(det.tonsProduced || det.tons || 0),
        bdp: Number(det.bdp || det.bdp_teorico || 0),
        availableNozzlesShift: Number(det.availableNozzlesShift || 0),
        bagProvider: det.bagProvider || "",
        discardedBagsBagger: Number(det.discardedBagsBagger || 0),
        notNozzledBags: Number(det.notNozzledBags || 0),
        discardedBagsVentocheck: Number(det.discardedBagsVentocheck || 0),
        discardedBagsTransport: Number(det.discardedBagsTransport || 0),
        observacion: det.observacion || ""
      }));

      await ProductionService.deleteDetailsForProduction(item.id);

      for (const entry of detailEntries) {
        await GenericRepository.create("DETALLES_PRODUCCIONV2", entry);
      }
    } catch (err) {
      console.error("Error syncing production details:", err);
    }
  }

  static async syncProductionChildren(item: any): Promise<void> {
    await ProductionService.syncProductionNozzles(item);
    await ProductionService.syncProductionDetails(item);
  }

  static async deleteProductionChildren(productionId: string): Promise<void> {
    await ProductionService.deleteNozzlesForProduction(productionId);
    await ProductionService.deleteDetailsForProduction(productionId);
  }

  static async enrichProductionReportsWithNozzleNews(list: any[]): Promise<void> {
    try {
      const nozzleList = await GenericRepository.findAll("PAROS_BOQUILLASV2");
      list.forEach((item: any) => {
        item.nozzleNews = nozzleList.filter((n: any) => 
          String(n.productionId || n.produccion_id || n.id_produccion || "").trim() === String(item.id || "").trim()
        );
      });
    } catch (err) {
      console.error("Error fetching PAROS_BOQUILLASV2 on read:", err);
      list.forEach((item: any) => {
        item.nozzleNews = [];
      });
    }
  }

  static async enrichProductionReportsWithDetails(list: any[]): Promise<void> {
    try {
      const detailsList = await GenericRepository.findAll("DETALLES_PRODUCCIONV2");
      list.forEach((item: any) => {
        item.materialsDetails = detailsList.filter((d: any) => 
          String(d.productionId || d.produccion_id || d.id_produccion || "").trim() === String(item.id || "").trim()
        );
      });
    } catch (err) {
      console.warn("Error fetching DETALLES_PRODUCCIONV2 on read:", err);
      list.forEach((item: any) => {
        item.materialsDetails = [];
      });
    }
  }
}
