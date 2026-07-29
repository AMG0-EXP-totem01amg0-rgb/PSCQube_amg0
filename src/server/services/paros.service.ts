import { GenericRepository } from "../repositories/generic.repository.js";
import { safeHacMatch, calculateDurationTime, durationMinutesFromHHMMSS } from "../utils/helpers.js";
import { formatTimeHHMMSS } from "../utils/sanitizers.js";

export class ParosService {
  static async enrichParos(data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      const [dbShifts, dbPalletizers, dbBaggers, dbHacs, dbMaterials] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PALETIZADORAV2").catch(() => []),
        GenericRepository.findAll("ENSACADORAV2").catch(() => []),
        GenericRepository.findAll("HACSV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => [])
      ]);

      const shiftMap = new Map<string, string>();
      dbShifts.forEach((s: any) => {
        if (!s) return;
        const val = String(s.name || s.nombre || s.description || s.descripcion || "").trim();
        if (!val) return;
        [s.id, s.shift_id, s.code, s.name, s.nombre].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) shiftMap.set(key, val);
            if (key) shiftMap.set(key.toUpperCase(), val);
          }
        });
      });

      const matMap = new Map<string, string>();
      dbMaterials.forEach((m: any) => {
        if (!m) return;
        const val = String(m.nombre || m.name || m.description || m.descripcion || "").trim();
        if (!val) return;
        [m.id, m.material_id, m.code, m.nombre, m.name].forEach((k) => {
          if (k !== undefined && k !== null) {
            const key = String(k).trim();
            if (key) matMap.set(key, val);
            if (key) matMap.set(key.toUpperCase(), val);
          }
        });
      });

      data.forEach((item: any) => {
        // Shift enrichment (safe)
        const shiftKey = String(item.shiftId || item.turno_id || item.turno || item.shiftName || "").trim();
        if (shiftKey) {
          const foundShift = shiftMap.get(shiftKey) || shiftMap.get(shiftKey.toUpperCase());
          if (foundShift) {
            item.shiftName = foundShift;
            item["turno"] = foundShift;
          }
        }

        // Machine enrichment (safe)
        if (item.machineId) {
          const machKey = String(item.machineId).trim();
          const pal = dbPalletizers.find((p: any) => p && (String(p.id).trim() === machKey || String(p.name || p.nombre).trim().toUpperCase() === machKey.toUpperCase())) ||
                      dbBaggers.find((b: any) => b && (String(b.id).trim() === machKey || String(b.name || b.nombre).trim().toUpperCase() === machKey.toUpperCase()));
          
          if (pal) {
            const hacPal = dbHacs.find((h: any) => h && (
              String(h.id).trim() === String(pal.hacId).trim() ||
              safeHacMatch(h.hac, pal.hacId)
            ));
            const targetHacId = pal.hacId || pal.hac_id || (hacPal ? hacPal.hac : (pal.id || item.machineId));
            if (targetHacId) {
              item.machineHacText = String(targetHacId);
              item["máquina afectada"] = String(targetHacId);
            }
          }
        }

        // Material enrichment (safe)
        const matKey = String(item.materialId || item.material_id || item.material || item.materialDescription || "").trim();
        if (matKey) {
          const foundMat = matMap.get(matKey) || matMap.get(matKey.toUpperCase());
          if (foundMat) {
            item.materialDescription = foundMat;
            item["material"] = foundMat;
          }
        }

        item.finishDate = item.date || item.fecha;
        item.center = "AMG0";
        if (item.startTime) item.startTime = formatTimeHHMMSS(item.startTime);
        if (item.endTime) item.endTime = formatTimeHHMMSS(item.endTime);
        
        if (item.startTime && item.endTime) {
          const duration = calculateDurationTime(item.startTime, item.endTime);
          item.durationTime = duration;
          item["duración"] = duration;
          item["duracion"] = duration;
        }
      });
    } catch (err) {
      console.error("Error enriching paros:", err);
    }
  }

  static async enrichParosOnRead(list: any[]): Promise<void> {
    if (!list || list.length === 0) return;
    try {
      const [shifts, palletizers, baggers, hacs, materials, causes] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PALETIZADORAV2").catch(() => []),
        GenericRepository.findAll("ENSACADORAV2").catch(() => []),
        GenericRepository.findAll("HACSV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => []),
        GenericRepository.findAll("CAUSASV2").catch(() => []),
      ]);

      // Cause map
      const causeMap = new Map<string, any>();
      causes.forEach((c: any) => {
        if (!c) return;
        if (c.text) causeMap.set(String(c.text).trim().toUpperCase(), c.id);
        if (c.descripcion) causeMap.set(String(c.descripcion).trim().toUpperCase(), c.id);
      });

      // Material map
      const matMap = new Map<string, any>();
      materials.forEach((m: any) => {
        if (!m) return;
        const nameKey = String(m.name || m.nombre || "").trim().toUpperCase();
        if (nameKey) matMap.set(nameKey, m.id);
      });

      // Shift map
      const shiftMap = new Map<string, any>();
      shifts.forEach((s: any) => {
        if (!s) return;
        const nameVal = String(s.name || s.nombre || "").trim().toUpperCase();
        if (nameVal) shiftMap.set(nameVal, s.id);
        if (s.id) shiftMap.set(String(s.id).trim().toUpperCase(), s.id);
      });

      // Prepared machines
      const cleanStr = (v: any) => String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const preparedMachines = [...palletizers, ...baggers].filter(Boolean).map((p: any) => ({
        raw: p,
        id: p.id,
        name: p.name || p.nombre || "",
        cleanId: cleanStr(p.id),
        cleanName: cleanStr(p.name || p.nombre),
        cleanHacId: cleanStr(p.hacId || p.hac_id)
      }));

      list.forEach((item: any) => {
        // Shift lookup
        const targetShiftName = String(item.shiftName || item.turno || "").trim().toUpperCase();
        if (targetShiftName) {
          const foundShiftId = shiftMap.get(targetShiftName);
          if (foundShiftId) {
            item.shiftId = foundShiftId;
          }
        }

        // Machine lookup
        const targetMachineText = String(item.machineHacText || item["máquina afectada"] || "").trim().toUpperCase();
        const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");

        if (cleanTarget) {
          let found = preparedMachines.find(m => m.cleanId === cleanTarget || m.cleanName === cleanTarget || (m.cleanHacId && m.cleanHacId === cleanTarget));
          if (!found) {
            found = preparedMachines.find(m => 
              (m.cleanId && cleanTarget.includes(m.cleanId)) || 
              (m.cleanId && m.cleanId.includes(cleanTarget)) ||
              (m.cleanName && cleanTarget.includes(m.cleanName)) || 
              (m.cleanName && m.cleanName.includes(cleanTarget))
            );
          }

          if (found) {
            item.machineId = found.id;
            item.machineName = found.name;
          }
        }

        // Material Fast Match
        const matDesc = String(item.materialDescription || item.material || "").trim().toUpperCase();
        if (matDesc) {
          const foundMatId = matMap.get(matDesc);
          if (foundMatId) item.materialId = foundMatId;
        }

        // Cause Fast Match
        const causeTxt = String(item.causeText || item["texto de causa"] || "").trim().toUpperCase();
        if (causeTxt) {
          const foundCauseId = causeMap.get(causeTxt);
          if (foundCauseId) item.causeId = foundCauseId;
        }

        // durationMinutes & Time Formats
        if (item.durationTime) {
          item.durationMinutes = durationMinutesFromHHMMSS(item.durationTime);
        }
        if (item.startTime && item.startTime.length === 8) item.startTime = item.startTime.slice(0, 5);
        if (item.endTime && item.endTime.length === 8) item.endTime = item.endTime.slice(0, 5);
      });
    } catch (err) {
      console.error("Error enriching PAROSV2 on read:", err);
    }
  }
}
