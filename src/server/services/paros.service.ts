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

      list.forEach((item: any) => {
        // 1. Shift Mapping
        const targetShiftName = String(item.shiftName || "").trim().toUpperCase();
        const shift = shifts.find((s: any) => 
          s && (
            String(s.name || "").trim().toUpperCase() === targetShiftName ||
            String(s.nombre || "").trim().toUpperCase() === targetShiftName ||
            String(s.id || "").trim().toUpperCase() === targetShiftName
          )
        );
        if (shift) {
          item.shiftId = shift.id;
        } else {
          // Try loose check
          const looseShift = shifts.find((s: any) => 
            s && (
              String(s.name || "").trim().toUpperCase().includes(targetShiftName) ||
              targetShiftName.includes(String(s.name || "").trim().toUpperCase())
            )
          );
          item.shiftId = looseShift ? looseShift.id : (item.shiftName || "");
        }

        // 2. Machine Affected (Palletizer / Bagger)
        const allMachines = [...palletizers, ...baggers];
        const targetMachineText = String(item.machineHacText || "").trim().toUpperCase();

        let pal = null;

        // Tier 1
        pal = allMachines.find((p: any) => {
          if (!p) return false;
          const pId = String(p.id || "").trim().toUpperCase();
          const pName = String(p.name || p.nombre || "").trim().toUpperCase();
          const pHacId = String(p.hacId || p.hac_id || "").trim().toUpperCase();
          return pId === targetMachineText || pName === targetMachineText || (pHacId && pHacId === targetMachineText);
        });

        // Tier 2: Alphanumeric match
        if (!pal) {
          const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
          pal = allMachines.find((p: any) => {
            if (!p) return false;
            const cleanId = String(p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cleanName = String(p.name || p.nombre || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cleanHacId = String(p.hacId || p.hac_id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            return cleanId === cleanTarget || cleanName === cleanTarget || (cleanHacId && cleanHacId === cleanTarget);
          });
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
            pal = allMachines.find((p: any) => {
              if (!p) return false;
              const pHacId = String(p.hacId || p.hac_id || "").trim().toUpperCase();
              const hId = String(hacForPal.id || "").trim().toUpperCase();
              const hHac = String(hacForPal.hac || "").trim().toUpperCase();
              return (
                pHacId === hId || 
                pHacId === hHac || 
                safeHacMatch(pHacId, hId) || 
                safeHacMatch(pHacId, hHac)
              );
            });
          }
        }

        // Tier 4: Substring
        if (!pal) {
          const cleanTarget = targetMachineText.replace(/[^A-Z0-9]/g, "");
          pal = allMachines.find((p: any) => {
            if (!p) return false;
            const cleanId = String(p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cleanName = String(p.name || p.nombre || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            return (
              (cleanId && cleanTarget.includes(cleanId)) || 
              (cleanTarget && cleanId.includes(cleanTarget)) ||
              (cleanName && cleanTarget.includes(cleanName)) || 
              (cleanTarget && cleanName.includes(cleanTarget))
            );
          });
        }

        // Tier 5: Split token match
        if (!pal) {
          pal = allMachines.find((p: any) => {
            if (!p) return false;
            const pName = String(p.name || p.nombre || "").trim().toUpperCase();
            return safeHacMatch(pName, targetMachineText);
          });
        }

        if (pal) {
          item.machineId = pal.id;
          item.machineName = pal.name || pal.nombre || "";
        } else {
          item.machineId = item.machineHacText || "";
          item.machineName = item.machineHacText || "";
        }

        // 3. Material
        const mat = materials.find((m: any) => m && m.name === item.materialDescription);
        if (mat) {
          item.materialId = mat.id;
        } else {
          item.materialId = item.materialDescription || "";
        }

        // 4. HAC
        const hacObj = hacs.find((h: any) => h && h.hac && safeHacMatch(h.hac, item.hacName));
        if (hacObj) {
          item.hacId = hacObj.id;
        } else {
          item.hacId = item.hacName || "";
        }

        // 5. Cause
        const causeObj = causes.find((c: any) => c && (c.text === item.causeText || c.descripcion === item.causeText));
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
      });
    } catch (err) {
      console.error("Error enriching PAROSV2 on read:", err);
    }
  }
}
