import { GenericRepository } from "../repositories/generic.repository.js";
import { ParosService } from "./paros.service.js";

export class MaestrosService {
  static async enrichInventarioFisico(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbMaterials] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => [])
      ]);

      const shiftMap = new Map<string, string>();
      dbShifts.forEach((s: any) => {
        if (!s) return;
        const val = String(s.name || s.nombre || s.description || s.descripcion || "").trim();
        if (!val) return;
        [s.id, s.shift_id, s.code, s.id_turno].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) shiftMap.set(key, val);
          }
        });
      });

      const matMap = new Map<string, string>();
      dbMaterials.forEach((m: any) => {
        if (!m) return;
        const val = String(m.name || m.nombre || m.description || m.descripcion || "").trim();
        if (!val) return;
        [m.id, m.material_id, m.code, m.id_material].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) matMap.set(key, val);
          }
        });
      });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          const found = shiftMap.get(key);
          if (found) item.shiftDescription = found;
        }
        if (item.materialId) {
          const key = String(item.materialId).trim();
          const found = matMap.get(key);
          if (found) item.materialDescription = found;
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

      const shiftMap = new Map<string, string>();
      dbShifts.forEach((s: any) => {
        if (!s) return;
        const val = String(s.name || s.nombre || s.description || s.descripcion || "").trim();
        if (!val) return;
        [s.id, s.shift_id, s.code, s.id_turno].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) shiftMap.set(key, val);
          }
        });
      });

      const laneMap = new Map<string, string>();
      dbLanes.forEach((l: any) => {
        if (!l) return;
        const val = String(l.name || l.nombre || l.description || l.descripcion || "").trim();
        if (!val) return;
        [l.id, l.lane_id, l.code, l.punto_carga_id].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) laneMap.set(key, val);
          }
        });
      });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          const found = shiftMap.get(key);
          if (found) item.shiftDescription = found;
        }
        if (item.loadingPointId) {
          const key = String(item.loadingPointId).trim();
          const found = laneMap.get(key);
          if (found) item.loadingPointDescription = found;
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

      const shiftMap = new Map<string, string>();
      dbShifts.forEach((s: any) => {
        if (!s) return;
        const val = String(s.name || s.nombre || s.description || s.descripcion || "").trim();
        if (!val) return;
        [s.id, s.shift_id, s.code, s.id_turno].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) shiftMap.set(key, val);
          }
        });
      });

      const matMap = new Map<string, string>();
      dbMaterials.forEach((m: any) => {
        if (!m) return;
        const val = String(m.name || m.nombre || m.description || m.descripcion || "").trim();
        if (!val) return;
        [m.id, m.material_id, m.code, m.id_material].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) matMap.set(key, val);
          }
        });
      });

      data.forEach((item: any) => {
        if (item.shiftId) {
          const key = String(item.shiftId).trim();
          const found = shiftMap.get(key);
          if (found) item.shiftDescription = found;
        }
        if (item.materialId) {
          const key = String(item.materialId).trim();
          const found = matMap.get(key);
          if (found) item.materialDescription = found;
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
