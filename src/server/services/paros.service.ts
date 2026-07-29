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

      const cleanShiftKey = (val: any) => {
        if (!val) return "";
        let s = String(val).trim().toLowerCase();
        return s.replace(/^shi-/, "").replace(/^turno\s*/, "").trim();
      };

      const normalizeDateStr = (val: any) => {
        if (!val) return "";
        let s = String(val).trim();
        if (s.includes("T")) s = s.split("T")[0];
        if (s.includes(" ")) s = s.split(" ")[0];
        if (s.includes("/")) {
          const parts = s.split("/");
          if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        if (s.includes("-")) {
          const parts = s.split("-");
          if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        return s;
      };

      const shiftMap = new Map<string, string>();
      const shiftIdMap = new Map<string, any>();
      shifts.forEach((s: any) => {
        if (!s) return;
        const name = String(s.name || s.nombre || s.description || s.descripcion || "").trim();
        [s.id, s.shift_id, s.code].forEach(k => {
          if (k !== undefined && k !== null) {
            const rawKey = String(k).trim().toLowerCase();
            const cleanKey = cleanShiftKey(k);
            if (name) {
              if (rawKey) shiftMap.set(rawKey, name);
              if (cleanKey) shiftMap.set(cleanKey, name);
            }
            if (s.id) {
              if (rawKey) shiftIdMap.set(rawKey, s.id);
              if (cleanKey) shiftIdMap.set(cleanKey, s.id);
            }
          }
        });
        if (name && s.id) {
          shiftIdMap.set(name.toLowerCase(), s.id);
          shiftIdMap.set(cleanShiftKey(name), s.id);
        }
      });

      const machineMap = new Map<string, string>();
      [...palletizers, ...baggers].forEach((m: any) => {
        if (!m) return;
        const name = String(m.name || m.nombre || m.description || m.descripcion || "").trim();
        [m.id, m.machine_id, m.hacId, m.hac_id].forEach(k => {
          if (k !== undefined && k !== null) {
            const rawKey = String(k).trim().toLowerCase();
            if (name && rawKey) machineMap.set(rawKey, name);
          }
        });
      });

      // Prepared machines for fuzzy machineId matching
      const cleanStr = (v: any) => String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const preparedMachines = [...palletizers, ...baggers].filter(Boolean).map((p: any) => ({
        raw: p,
        id: p.id,
        name: p.name || p.nombre || "",
        cleanId: cleanStr(p.id),
        cleanName: cleanStr(p.name || p.nombre),
        cleanHacId: cleanStr(p.hacId || p.hac_id)
      }));

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

      list.forEach((p: any) => {
        const normD = normalizeDateStr(p.date || p.fecha || p.finishDate);
        if (normD) {
          p.date = normD;
          p.fecha = normD;
        }

        const durMins = Number(p.durationMinutes || p.duracion_minutos || p.duration || (p.durationTime ? durationMinutesFromHHMMSS(p.durationTime) : 0));
        p.durationMinutes = durMins;
        p.duracion_minutos = durMins;
        p.duration = durMins;

        const shiftRawKey = String(p.shiftId || p.shift_id || p.id_turno || "").trim().toLowerCase();
        const shiftCleanKey = cleanShiftKey(p.shiftId || p.shift_id || p.id_turno || p.shiftName || p.turno);
        const resolvedShiftName = shiftMap.get(shiftRawKey) || shiftMap.get(shiftCleanKey);
        if (resolvedShiftName && resolvedShiftName.trim() !== "") {
          if (!p.shiftDescription) p.shiftDescription = resolvedShiftName;
          if (!p.shiftName) p.shiftName = resolvedShiftName;
          if (!p.turno) p.turno = resolvedShiftName;
        }

        const macKey = String(p.machineId || p.maquina_id || p.palletizerId || p.palletizadora_id || "").trim().toLowerCase();
        const resolvedMacName = machineMap.get(macKey);
        if (resolvedMacName && resolvedMacName.trim() !== "") {
          if (!p.machineName) p.machineName = resolvedMacName;
          if (!p.equipoDescription) p.equipoDescription = resolvedMacName;
        }

        // Shift ID lookup if missing or unmapped
        if (!p.shiftId || String(p.shiftId).trim() === "") {
          const targetShiftName = String(p.shiftName || p.shiftDescription || p.turno || "").trim().toLowerCase();
          const cleanTarget = cleanShiftKey(targetShiftName);
          const foundShiftId = shiftIdMap.get(targetShiftName) || shiftIdMap.get(cleanTarget);
          if (foundShiftId) p.shiftId = foundShiftId;
        }

        // Machine ID lookup if missing
        if (!p.machineId || String(p.machineId).trim() === "") {
          const targetMachineText = String(p.machineHacText || p["máquina afectada"] || p.machineName || p.equipoDescription || "").trim().toUpperCase();
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
              p.machineId = found.id;
              if (!p.machineName) p.machineName = found.name;
              if (!p.equipoDescription) p.equipoDescription = found.name;
            }
          }
        }

        // Material Fast Match
        const matDesc = String(p.materialDescription || p.material || "").trim().toUpperCase();
        if (matDesc) {
          const foundMatId = matMap.get(matDesc);
          if (foundMatId) p.materialId = foundMatId;
        }

        // Cause Fast Match
        const causeTxt = String(p.causeText || p["texto de causa"] || "").trim().toUpperCase();
        if (causeTxt) {
          const foundCauseId = causeMap.get(causeTxt);
          if (foundCauseId) p.causeId = foundCauseId;
        }

        if (p.startTime && p.startTime.length === 8) p.startTime = p.startTime.slice(0, 5);
        if (p.endTime && p.endTime.length === 8) p.endTime = p.endTime.slice(0, 5);
      });
    } catch (err) {
      console.error("Error enriching PAROSV2 on read:", err);
    }
  }
}
