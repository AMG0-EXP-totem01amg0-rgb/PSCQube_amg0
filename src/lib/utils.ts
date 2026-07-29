import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeDateStr(val: any): string {
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
}

export function matchDateFlexible(recordDateVal: any, targetDateVal: any): boolean {
  if (!targetDateVal) return true;
  const d1 = normalizeDateStr(recordDateVal);
  const d2 = normalizeDateStr(targetDateVal);
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  if (d1.split('-').reverse().join('/') === d2) return true;
  if (d2.split('-').reverse().join('/') === d1) return true;
  return false;
}

export function cleanShiftKey(val: any): string {
  if (!val) return "";
  let s = String(val).trim().toLowerCase();
  return s.replace(/^shi-/, "").replace(/^turno\s*/, "").trim();
}

export function isStopForMachine(stop: any, machine: any, mastersAvailable?: any): boolean {
  if (!stop || !machine) return false;

  let selId = '';
  let selHacText = '';
  let selDescription = '';

  if (typeof machine === 'object' && machine !== null) {
    selId = String(machine.id || '').trim().toUpperCase();
    selHacText = String(machine.hacText || machine.hacId || machine.hac_id || machine.machineHacText || '').trim().toUpperCase();
    selDescription = String(machine.description || machine.descripcion || machine.name || machine.nombre || '').trim().toUpperCase();
  } else {
    selId = String(machine).trim().toUpperCase();
    if (mastersAvailable) {
      const found = (mastersAvailable.palletizers || []).find((p: any) => p && (
        String(p.id).trim().toUpperCase() === selId ||
        String(p.hacId || p.hac_id || '').trim().toUpperCase() === selId ||
        String(p.name || p.nombre || '').trim().toUpperCase() === selId
      )) || (mastersAvailable.baggers || []).find((b: any) => b && (
        String(b.id).trim().toUpperCase() === selId ||
        String(b.hacId || b.hac_id || '').trim().toUpperCase() === selId ||
        String(b.name || b.nombre || '').trim().toUpperCase() === selId
      ));
      if (found) {
        selId = String(found.id || '').trim().toUpperCase();
        selHacText = String(found.hacId || found.hac_id || found.hacText || '').trim().toUpperCase();
        selDescription = String(found.name || found.nombre || found.description || '').trim().toUpperCase();
      }
    }
  }

  const stopMachineHacText = String(stop.machineHacText || stop.hacId || stop.hac_id || '').trim().toUpperCase();
  const stopMachineId = String(stop.machineId || stop.palletizerId || stop.maquina_id || stop.equipo_id || '').trim().toUpperCase();
  const stopMachineName = String(stop.machineName || stop.equipoDescription || stop.description || '').trim().toUpperCase();

  // 1. Direct comparisons (Rule 2)
  if (selHacText && stopMachineHacText === selHacText) return true;
  if (selId && stopMachineId === selId) return true;
  if (selDescription && stopMachineHacText === selDescription) return true;
  if (selDescription && stopMachineName === selDescription) return true;
  if (selHacText && stopMachineId === selHacText) return true;
  if (selId && stopMachineHacText === selId) return true;

  // 2. Inclusion & Substring
  if (selHacText && stopMachineHacText && (stopMachineHacText.includes(selHacText) || selHacText.includes(stopMachineHacText))) return true;
  if (selHacText && stopMachineId && (stopMachineId.includes(selHacText) || selHacText.includes(stopMachineId))) return true;

  // 3. Clean alphanumeric match
  const clean = (s: string) => s.replace(/[^A-Z0-9]/g, '');
  const cStopHac = clean(stopMachineHacText);
  const cSelHac = clean(selHacText);
  const cStopId = clean(stopMachineId);
  const cSelId = clean(selId);
  const cStopName = clean(stopMachineName);
  const cSelDesc = clean(selDescription);

  if (cStopHac && cSelHac && cStopHac === cSelHac) return true;
  if (cStopId && cSelId && cStopId === cSelId) return true;
  if (cStopHac && cSelDesc && cStopHac === cSelDesc) return true;
  if (cStopName && cSelDesc && cStopName === cSelDesc) return true;

  return false;
}

export function isStopForShift(stop: any, shiftId: string | null | undefined, mastersAvailable?: any): boolean {
  if (!stop) return false;
  if (!shiftId) return true;

  const targetId = String(shiftId).trim().toLowerCase();
  const cleanTargetId = cleanShiftKey(shiftId);

  const stopShiftId = String(stop.shiftId || stop.shift_id || stop.id_turno || '').trim().toLowerCase();
  const cleanStopShiftId = cleanShiftKey(stopShiftId);

  const stopShiftName = String(stop.shiftName || stop.shiftDescription || stop.turno || '').trim().toLowerCase();
  const cleanStopShiftName = cleanShiftKey(stopShiftName);

  if (stopShiftId && (stopShiftId === targetId || cleanStopShiftId === cleanTargetId)) return true;

  if (mastersAvailable && mastersAvailable.shifts) {
    const selectedS = (mastersAvailable.shifts || []).find((s: any) => s && (
      String(s.id || '').trim().toLowerCase() === targetId ||
      cleanShiftKey(s.id) === cleanTargetId ||
      String(s.code || s.shift_id || '').trim().toLowerCase() === targetId
    ));

    if (selectedS) {
      const sId = String(selectedS.id || '').trim().toLowerCase();
      const sCleanId = cleanShiftKey(selectedS.id);
      const sName = String(selectedS.name || selectedS.nombre || '').trim().toLowerCase();
      const sCleanName = cleanShiftKey(sName);

      if (stopShiftId === sId || cleanStopShiftId === sCleanId) return true;
      if (stopShiftName === sName || cleanStopShiftName === sCleanName) return true;
      if (sName && stopShiftName && (stopShiftName.includes(sName) || sName.includes(stopShiftName))) return true;
      if (sCleanName && cleanStopShiftName && (cleanStopShiftName.includes(sCleanName) || sCleanName.includes(cleanStopShiftName))) return true;
    }
  }

  return false;
}

