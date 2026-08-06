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

      // Mapas de acceso rápido O(1)
      const shiftMap = new Map<string, any>();
      for (let i = 0; i < dbShifts.length; i++) {
        const s = dbShifts[i];
        if (s && s.id !== undefined && s.id !== null) {
          shiftMap.set(String(s.id).trim().toUpperCase(), s);
        }
      }

      const materialMap = new Map<string, any>();
      for (let i = 0; i < dbMaterials.length; i++) {
        const m = dbMaterials[i];
        if (m && m.id !== undefined && m.id !== null) {
          materialMap.set(String(m.id).trim().toUpperCase(), m);
        }
      }

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item) continue;

        if (item.shiftId) {
          const key = String(item.shiftId).trim().toUpperCase();
          const shift = shiftMap.get(key) || dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
          item.shiftDescription = shift ? (shift.name || shift.nombre || "") : "";
        }

        if (item.materialId) {
          const key = String(item.materialId).trim().toUpperCase();
          const mat = materialMap.get(key) || dbMaterials.find((m: any) => m && safeMatch(m.id, item.materialId));
          item.materialDescription = mat ? (mat.name || mat.nombre || "") : "";
        }
      }
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

      // Mapas de acceso rápido O(1)
      const shiftMap = new Map<string, any>();
      for (let i = 0; i < dbShifts.length; i++) {
        const s = dbShifts[i];
        if (s && s.id !== undefined && s.id !== null) {
          shiftMap.set(String(s.id).trim().toUpperCase(), s);
        }
      }

      const laneMap = new Map<string, any>();
      for (let i = 0; i < dbLanes.length; i++) {
        const l = dbLanes[i];
        if (l && l.id !== undefined && l.id !== null) {
          laneMap.set(String(l.id).trim().toUpperCase(), l);
        }
      }

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item) continue;

        if (item.shiftId) {
          const key = String(item.shiftId).trim().toUpperCase();
          const shift = shiftMap.get(key) || dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
          item.shiftDescription = shift ? (shift.name || shift.nombre || "") : "";
        }

        if (item.loadingPointId) {
          const key = String(item.loadingPointId).trim().toUpperCase();
          const lane = laneMap.get(key) || dbLanes.find((l: any) => l && safeMatch(l.id, item.loadingPointId));
          item.loadingPointDescription = lane ? (lane.name || lane.nombre || "") : "";
        }
      }
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

      // Mapas de acceso rápido O(1)
      const shiftMap = new Map<string, any>();
      for (let i = 0; i < dbShifts.length; i++) {
        const s = dbShifts[i];
        if (s && s.id !== undefined && s.id !== null) {
          shiftMap.set(String(s.id).trim().toUpperCase(), s);
        }
      }

      const materialMap = new Map<string, any>();
      for (let i = 0; i < dbMaterials.length; i++) {
        const m = dbMaterials[i];
        if (m && m.id !== undefined && m.id !== null) {
          materialMap.set(String(m.id).trim().toUpperCase(), m);
        }
      }

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item) continue;

        if (item.shiftId) {
          const key = String(item.shiftId).trim().toUpperCase();
          const shift = shiftMap.get(key) || dbShifts.find((s: any) => s && safeMatch(s.id, item.shiftId));
          item.shiftDescription = shift ? (shift.name || shift.nombre || "") : "";
        }

        if (item.materialId) {
          const key = String(item.materialId).trim().toUpperCase();
          const mat = materialMap.get(key) || dbMaterials.find((m: any) => m && safeMatch(m.id, item.materialId));
          item.materialDescription = mat ? (mat.name || mat.nombre || "") : "";
        }
      }
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