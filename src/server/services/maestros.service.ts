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

      const shiftMap = new Map();
      dbShifts.forEach((s: any) => { if (s && s.id) shiftMap.set(String(s.id).trim(), s.name || s.nombre || ""); });

      const matMap = new Map();
      dbMaterials.forEach((m: any) => { if (m && m.id) matMap.set(String(m.id).trim(), m.name || m.nombre || ""); });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          item.shiftDescription = shiftMap.get(key) || "";
        }
        if (item.materialId) {
          const key = String(item.materialId).trim();
          item.materialDescription = matMap.get(key) || "";
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

      const shiftMap = new Map();
      dbShifts.forEach((s: any) => { if (s && s.id) shiftMap.set(String(s.id).trim(), s.name || s.nombre || ""); });

      const laneMap = new Map();
      dbLanes.forEach((l: any) => { if (l && l.id) laneMap.set(String(l.id).trim(), l.name || l.nombre || ""); });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          item.shiftDescription = shiftMap.get(key) || "";
        }
        if (item.loadingPointId) {
          const key = String(item.loadingPointId).trim();
          item.loadingPointDescription = laneMap.get(key) || "";
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

      const shiftMap = new Map();
      dbShifts.forEach((s: any) => { if (s && s.id) shiftMap.set(String(s.id).trim(), s.name || s.nombre || ""); });

      const matMap = new Map();
      dbMaterials.forEach((m: any) => { if (m && m.id) matMap.set(String(m.id).trim(), m.name || m.nombre || ""); });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          item.shiftDescription = shiftMap.get(key) || "";
        }
        if (item.materialId) {
          const key = String(item.materialId).trim();
          item.materialDescription = matMap.get(key) || "";
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
