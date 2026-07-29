import { GenericRepository } from "../repositories/generic.repository.js";
import { safeMatch } from "../utils/helpers.js";
import { ParosService } from "./paros.service.js";

export class MaestrosService {
  static async enrichInventarioFisico(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbMaterials] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => [])
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

  static async enrichEstadoCalles(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbLanes] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PUNTOS_CARGAV2").catch(() => [])
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

  static async enrichDespachos(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbMaterials] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => [])
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

  static async enrichDataIfNeeded(tableName: string, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    const upper = tableName.toUpperCase();
    if (upper === "INVENTARIO_FISICOV2") {
      await MaestrosService.enrichInventarioFisico(items);
    } else if (upper === "ESTADO_CALLESV2") {
      await MaestrosService.enrichEstadoCalles(items);
    } else if (upper === "DESPACHOSV2") {
      await MaestrosService.enrichDespachos(items);
    } else if (upper === "PAROSV2") {
      await ParosService.enrichParos(items);
    }
  }
}
