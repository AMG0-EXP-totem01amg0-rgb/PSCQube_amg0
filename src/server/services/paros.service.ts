import { GenericRepository } from "../repositories/generic.repository.js";
import { safeMatch, safeHacMatch, calculateDurationTime, durationMinutesFromHHMMSS } from "../utils/helpers.js";
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

      data.forEach((item: any) => {
        const shiftId = item.shiftId || item.turno_id;
        const shift = dbShifts.find((s: any) => s && (
          safeMatch(s.id, shiftId) || 
          safeMatch(s.name, shiftId) || 
          safeMatch(s.nombre, shiftId) || 
          safeMatch(s.id, item.shiftId) ||
          safeMatch(s.name, item.shiftId) ||
          safeMatch(s.nombre, item.shiftId)
        ));
        const shiftName = shift ? (shift.name || shift.nombre || "") : "";
        item.shiftName = shiftName;
        item["turno"] = shiftName;

        if (item.machineId) {
          const pal = dbPalletizers.find((p: any) => p && (safeMatch(p.id, item.machineId) || safeMatch(p.name, item.machineId) || safeMatch(p.nombre, item.machineId))) || 
                      dbBaggers.find((b: any) => b && (safeMatch(b.id, item.machineId) || safeMatch(b.name, item.machineId) || safeMatch(b.nombre, item.machineId)));
          const hacPal = dbHacs.find((h: any) => h && (safeMatch(h.id, pal?.hacId) || safeMatch(h.hac, pal?.hacId) || safeHacMatch(h.hac, pal?.hacId)));
          const targetHacId = pal?.hacId || pal?.hac_id || (hacPal ? hacPal.hac : (pal?.id || item.machineId));
          item.machineHacText = targetHacId;
          item["máquina afectada"] = targetHacId;
        }

        const matId = item.materialId || item.material_id;
        const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, matId));
        const matName = mat ? (mat.nombre || mat.name || "") : "";
        item.materialDescription = matName;
        item["material"] = matName;

        item.finishDate = item.date;
        item.center = "AMG0";
        item.startTime = formatTimeHHMMSS(item.startTime);
        item.endTime = formatTimeHHMMSS(item.endTime);
        
        const duration = calculateDurationTime(item.startTime, item.endTime);
        item.durationTime = duration;
        item["duración"] = duration;
        item["duracion"] = duration;
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

      // 1. Pre-indexación en Maps para búsqueda O(1)
      const causeMap = new Map();
      causes.forEach((c: any) => {
        if (c.text) causeMap.set(c.text, c.id);
        if (c.descripcion) causeMap.set(c.descripcion, c.id);
      });

      const matMap = new Map();
      materials.forEach((m: any) => {
        if (m.name) matMap.set(m.name, m.id);
      });

      // Pre-procesar máquinas una sola vez
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
        const targetShiftName = String(item.shiftName || "").trim().toUpperCase();
        const shift = shifts.find((s: any) => 
          s && (
            String(s.name || "").trim().toUpperCase() === targetShiftName ||
            String(s.nombre || "").trim().toUpperCase() === targetShiftName ||
            String(s.id || "").trim().toUpperCase() === targetShiftName
          )
        ) || shifts.find((s: any) => 
          s && (
            String(s.name || "").trim().toUpperCase().includes(targetShiftName) ||
            targetShiftName.includes(String(s.name || "").trim().toUpperCase())
          )
        );
        item.shiftId = shift ? shift.id : (item.shiftName || "");

        // Machine lookup con lista pre-procesada
        const targetMachineText = String(item.machineHacText || "").trim().toUpperCase();
        const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");

        let found = preparedMachines.find(m => m.cleanId === cleanTarget || m.cleanName === cleanTarget || (m.cleanHacId && m.cleanHacId === cleanTarget));
        
        if (!found && cleanTarget) {
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
        } else {
          item.machineId = item.machineHacText || "";
          item.machineName = item.machineHacText || "";
        }

        // Material Fast Match
        item.materialId = matMap.get(item.materialDescription) || item.materialDescription || "";

        // Cause Fast Match
        item.causeId = causeMap.get(item.causeText) || item.causeText || "";

        // durationMinutes & Time Formats
        item.durationMinutes = durationMinutesFromHHMMSS(item.durationTime);
        if (item.startTime && item.startTime.length === 8) item.startTime = item.startTime.slice(0, 5);
        if (item.endTime && item.endTime.length === 8) item.endTime = item.endTime.slice(0, 5);
      });
    } catch (err) {
      console.error("Error enriching PAROSV2 on read:", err);
    }
  }
}
