import { GenericRepository } from "../repositories/generic.repository.js";
import { getSupabaseClient } from "./supabase.service.js";
import { safeMatch, safeHacMatch } from "../utils/helpers.js";
import { invalidateCache } from "../cache/cache.service.js";

export class ProductionService {
  static async enrichProductionRecords(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbPalletizers, dbBaggers, dbMaterials, dbHacs, dbParos, dbCauses, dbCapacities] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PALETIZADORAV2").catch(() => []),
        GenericRepository.findAll("ENSACADORAV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => []),
        GenericRepository.findAll("HACSV2").catch(() => []),
        GenericRepository.findAll("PAROSV2").catch(() => []),
        GenericRepository.findAll("CAUSASV2").catch(() => []),
        GenericRepository.findAll("CAPACIDADESV2").catch(() => []),
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
            const bdpPonderado = totalTons / sumTonsOverBDP;
            yieldPercent = (rate / bdpPonderado) * 100;
          } else {
            yieldPercent = 0;
          }
        } else {
          yieldPercent = 0;
        }
        
        item.yield = `${Math.round(yieldPercent)}%`;

        const oeePercent = (availabilityPercent / 100) * (yieldPercent / 100) * 100;
        item.oee = `${Math.round(oeePercent)}%`;
      });
    } catch (enrichError) {
      console.error("Error enriching production data:", enrichError);
    }
  }

  static async autoRecalculateProductionMetrics(): Promise<void> {
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

      console.log(`[autoRecalculateProductionMetrics] Recalculated ${productionList.length} records. Committing updates to Supabase...`);
      for (const report of productionList) {
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
