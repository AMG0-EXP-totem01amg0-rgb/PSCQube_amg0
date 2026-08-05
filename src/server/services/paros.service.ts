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

      // Pre-index Palletizers and Baggers by ID, name, and nombre for fast lookup
      const machinesList = [...dbPalletizers, ...dbBaggers];
      const machineMap = new Map<string, any>();
      for (let i = 0; i < machinesList.length; i++) {
        const m = machinesList[i];
        if (!m) continue;
        if (m.id) machineMap.set(String(m.id).trim().toUpperCase(), m);
        if (m.name) machineMap.set(String(m.name).trim().toUpperCase(), m);
        if (m.nombre) machineMap.set(String(m.nombre).trim().toUpperCase(), m);
      }

      // Pre-index HACs by ID and HAC text
      const hacMap = new Map<string, any>();
      for (let i = 0; i < dbHacs.length; i++) {
        const h = dbHacs[i];
        if (!h) continue;
        if (h.id) hacMap.set(String(h.id).trim().toUpperCase(), h);
        if (h.hac) hacMap.set(String(h.hac).trim().toUpperCase(), h);
      }

      // Pre-index Materials
      const materialMap = new Map<string, any>();
      for (let i = 0; i < dbMaterials.length; i++) {
        const m = dbMaterials[i];
        if (!m) continue;
        if (m.id) materialMap.set(String(m.id).trim().toUpperCase(), m);
      }

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item) continue;

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
          const macKey = String(item.machineId).trim().toUpperCase();
          const pal = machineMap.get(macKey) || dbPalletizers.find((p: any) => p && (safeMatch(p.id, item.machineId) || safeMatch(p.name, item.machineId) || safeMatch(p.nombre, item.machineId))) || 
                      dbBaggers.find((b: any) => b && (safeMatch(b.id, item.machineId) || safeMatch(b.name, item.machineId) || safeMatch(b.nombre, item.machineId)));
          
          const hacPalKey = pal ? String(pal.hacId || "").trim().toUpperCase() : "";
          const hacPal = hacPalKey ? hacMap.get(hacPalKey) || dbHacs.find((h: any) => h && (safeMatch(h.id, pal?.hacId) || safeMatch(h.hac, pal?.hacId) || safeHacMatch(h.hac, pal?.hacId))) : null;
          
          const targetHacId = pal?.hacId || pal?.hac_id || (hacPal ? hacPal.hac : (pal?.id || item.machineId));
          item.machineHacText = targetHacId;
          item["máquina afectada"] = targetHacId;
        }

        const matId = item.materialId || item.material_id;
        const matKey = matId ? String(matId).trim().toUpperCase() : "";
        const mat = matKey ? materialMap.get(matKey) || dbMaterials.find((m: any) => m && safeMatch(m.id, matId)) : null;
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
      }
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

      // 1. Pre-index Shifts
      const shiftMap = new Map<string, any>();
      for (let i = 0; i < shifts.length; i++) {
        const s = shifts[i];
        if (!s) continue;
        if (s.name) shiftMap.set(String(s.name).trim().toUpperCase(), s);
        if (s.nombre) shiftMap.set(String(s.nombre).trim().toUpperCase(), s);
        if (s.id) shiftMap.set(String(s.id).trim().toUpperCase(), s);
      }

      // 2. Pre-process Machine metadata (Tiers 1, 2, 3)
      const allMachines = [...palletizers, ...baggers];
      const preparedMachines = new Array(allMachines.length);
      for (let i = 0; i < allMachines.length; i++) {
        const p = allMachines[i];
        if (!p) continue;
        const pId = String(p.id || "").trim().toUpperCase();
        const pName = String(p.name || p.nombre || "").trim().toUpperCase();
        const pHacId = String(p.hacId || p.hac_id || "").trim().toUpperCase();
        preparedMachines[i] = {
          raw: p,
          pId,
          pName,
          pHacId,
          cleanId: pId.replace(/[^A-Z0-9]/g, ""),
          cleanName: pName.replace(/[^A-Z0-9]/g, ""),
          cleanHacId: pHacId.replace(/[^A-Z0-9]/g, "")
        };
      }

      // 3. Pre-index Materials by Name
      const materialByNameMap = new Map<string, any>();
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        if (m && m.name) materialByNameMap.set(String(m.name).trim(), m);
      }

      // 4. Pre-index HACs by cleaned HAC string
      const hacCleanMap = new Map<string, any>();
      for (let i = 0; i < hacs.length; i++) {
        const h = hacs[i];
        if (!h || !h.hac) continue;
        const cleanH = String(h.hac).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        hacCleanMap.set(cleanH, h);
      }

      // 5. Pre-index Causes by text and descripcion
      const causeByTextMap = new Map<string, any>();
      for (let i = 0; i < causes.length; i++) {
        const c = causes[i];
        if (!c) continue;
        if (c.text) causeByTextMap.set(String(c.text).trim(), c);
        if (c.descripcion) causeByTextMap.set(String(c.descripcion).trim(), c);
      }

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item) continue;

        // 1. Shift Mapping
        const targetShiftName = String(item.shiftName || "").trim().toUpperCase();
        let shift = shiftMap.get(targetShiftName);
        if (shift) {
          item.shiftId = shift.id;
        } else {
          const looseShift = shifts.find((s: any) => 
            s && (
              String(s.name || "").trim().toUpperCase().includes(targetShiftName) ||
              targetShiftName.includes(String(s.name || "").trim().toUpperCase())
            )
          );
          item.shiftId = looseShift ? looseShift.id : (item.shiftName || "");
        }

        // 2. Machine Affected (Palletizer / Bagger)
        const targetMachineText = String(item.machineHacText || "").trim().toUpperCase();
        let pal = null;

        // Tier 1
        for (let j = 0; j < preparedMachines.length; j++) {
          const pm = preparedMachines[j];
          if (!pm) continue;
          if (pm.pId === targetMachineText || pm.pName === targetMachineText || (pm.pHacId && pm.pHacId === targetMachineText)) {
            pal = pm.raw;
            break;
          }
        }

        // Tier 2: Alphanumeric match
        if (!pal) {
          const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
          for (let j = 0; j < preparedMachines.length; j++) {
            const pm = preparedMachines[j];
            if (!pm) continue;
            if (pm.cleanId === cleanTarget || pm.cleanName === cleanTarget || (pm.cleanHacId && pm.cleanHacId === cleanTarget)) {
              pal = pm.raw;
              break;
            }
          }
        }

        // Tier 3: HAC table
        if (!pal) {
          const hacForPal = hacs.find((h: any) => 
            h && h.hac && (
              String(h.hac).trim().toUpperCase() === targetMachineText ||
              safeHacMatch(h.hac, targetMachineText)
            )
          );
          if (hacForPal) {
            const hId = String(hacForPal.id || "").trim().toUpperCase();
            const hHac = String(hacForPal.hac || "").trim().toUpperCase();
            for (let j = 0; j < preparedMachines.length; j++) {
              const pm = preparedMachines[j];
              if (!pm) continue;
              if (
                pm.pHacId === hId || 
                pm.pHacId === hHac || 
                safeHacMatch(pm.pHacId, hId) || 
                safeHacMatch(pm.pHacId, hHac)
              ) {
                pal = pm.raw;
                break;
              }
            }
          }
        }

        // Tier 4: Substring
        if (!pal) {
          const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
          for (let j = 0; j < preparedMachines.length; j++) {
            const pm = preparedMachines[j];
            if (!pm) continue;
            if (
              (pm.cleanId && cleanTarget.includes(pm.cleanId)) || 
              (cleanTarget && pm.cleanId.includes(cleanTarget)) ||
              (pm.cleanName && cleanTarget.includes(pm.cleanName)) || 
              (cleanTarget && pm.cleanName.includes(cleanTarget))
            ) {
              pal = pm.raw;
              break;
            }
          }
        }

        // Tier 5: Split token match
        if (!pal) {
          for (let j = 0; j < preparedMachines.length; j++) {
            const pm = preparedMachines[j];
            if (!pm) continue;
            if (safeHacMatch(pm.pName, targetMachineText)) {
              pal = pm.raw;
              break;
            }
          }
        }

        if (pal) {
          item.machineId = pal.id;
          item.machineName = pal.name || pal.nombre || "";
        } else {
          item.machineId = item.machineHacText || "";
          item.machineName = item.machineHacText || "";
        }

        // 3. Material
        const mat = item.materialDescription ? materialByNameMap.get(String(item.materialDescription).trim()) : null;
        if (mat) {
          item.materialId = mat.id;
        } else {
          item.materialId = item.materialDescription || "";
        }

        // 4. HAC
        const cleanHacName = String(item.hacName || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        let hacObj = hacCleanMap.get(cleanHacName);

        if (!hacObj) {
          hacObj = hacs.find((h: any) => h && h.hac && safeHacMatch(h.hac, item.hacName));
        }

        if (hacObj) {
          item.hacId = hacObj.id;
        } else {
          item.hacId = item.hacName || "";
        }

        // 5. Cause
        const causeObj = item.causeText ? causeByTextMap.get(String(item.causeText).trim()) : null;
        if (causeObj) {
          item.causeId = causeObj.id;
        } else {
          item.causeId = item.causeText || "";
        }

        // 6. durationMinutes
        item.durationMinutes = durationMinutesFromHHMMSS(item.durationTime);

        // 7. Format time for Form (HH:mm)
        if (item.startTime && item.startTime.length === 8) {
          item.startTime = item.startTime.slice(0, 5);
        }
        if (item.endTime && item.endTime.length === 8) {
          item.endTime = item.endTime.slice(0, 5);
        }
      }
    } catch (err) {
      console.error("Error enriching PAROSV2 on read:", err);
    }
  }
}