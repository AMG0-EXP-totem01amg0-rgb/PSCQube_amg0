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
  if (!stop) return false;
  if (!machine || machine === 'ALL' || machine === 'TODAS' || machine === 'TODOS') return true;

  const clean = (s: any) => String(s || '').trim().toUpperCase();
  const cleanAlpha = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const selValues = new Set<string>();
  const selAlphaValues = new Set<string>();

  const addSelValue = (v: any) => {
    const s = clean(v);
    if (s) {
      selValues.add(s);
      const alpha = cleanAlpha(s);
      if (alpha) selAlphaValues.add(alpha);
    }
  };

  if (typeof machine === 'object' && machine !== null) {
    addSelValue(machine.id);
    addSelValue(machine.name || machine.nombre || machine.description || machine.descripcion);
    addSelValue(machine.hacId || machine.hac_id || machine.hacText || machine.hac || machine.machineHacText);
    addSelValue(machine.linea || machine.equipo);
  } else {
    addSelValue(machine);
  }

  if (mastersAvailable) {
    const allMachines = [
      ...(mastersAvailable.palletizers || []),
      ...(mastersAvailable.baggers || []),
      ...(mastersAvailable.lines || []),
      ...(mastersAvailable.maquinas || []),
      ...(mastersAvailable.equipos || [])
    ];
    
    // Find matching machine in masters by any current selValue
    const foundMachines = allMachines.filter((p: any) => {
      if (!p) return false;
      const pId = clean(p.id);
      const pName = clean(p.name || p.nombre || p.description || p.descripcion);
      const pHac = clean(p.hacId || p.hac_id || p.hacText || p.hac);
      return selValues.has(pId) || selValues.has(pName) || selValues.has(pHac) ||
             selAlphaValues.has(cleanAlpha(pId)) || selAlphaValues.has(cleanAlpha(pName)) || selAlphaValues.has(cleanAlpha(pHac));
    });

    foundMachines.forEach((p: any) => {
      addSelValue(p.id);
      addSelValue(p.name || p.nombre || p.description || p.descripcion);
      addSelValue(p.hacId || p.hac_id || p.hacText || p.hac);
      addSelValue(p.linea || p.equipo);
    });

    // Also check masters.hacs for linked HAC details
    (mastersAvailable.hacs || []).forEach((h: any) => {
      if (!h) return;
      const hId = clean(h.id);
      const hHac = clean(h.hac);
      const hDetail = clean(h.detail || h.detalle);
      if (selValues.has(hId) || selValues.has(hHac) || selValues.has(hDetail) ||
          selAlphaValues.has(cleanAlpha(hId)) || selAlphaValues.has(cleanAlpha(hHac)) || selAlphaValues.has(cleanAlpha(hDetail))) {
        addSelValue(h.id);
        addSelValue(h.hac);
        addSelValue(h.detail || h.detalle);
      }
    });
  }

  // Extract all potential machine identifier fields from the stop record
  const stopValues = new Set<string>();
  const stopAlphaValues = new Set<string>();

  const addStopValue = (v: any) => {
    const s = clean(v);
    if (s) {
      stopValues.add(s);
      const alpha = cleanAlpha(s);
      if (alpha) stopAlphaValues.add(alpha);
    }
  };

  addStopValue(stop.machineId);
  addStopValue(stop.palletizerId);
  addStopValue(stop.maquina_id);
  addStopValue(stop.equipo_id);
  
  addStopValue(stop.machineName);
  addStopValue(stop.nombre_maquina);
  addStopValue(stop.maquina_afectada);
  addStopValue(stop.maquinaAfectada);
  addStopValue(stop['máquina afectada']);
  addStopValue(stop.equipoDescription);
  addStopValue(stop.description);
  addStopValue(stop.linea);
  addStopValue(stop.equipo);
  addStopValue(stop.equipment);
  
  addStopValue(stop.machineHacText);
  addStopValue(stop.maquina_hac);
  addStopValue(stop.hacName);
  addStopValue(stop.hac);
  addStopValue(stop['hac']);
  addStopValue(stop.hacId);
  addStopValue(stop.hac_id);
  addStopValue(stop.hac_text);
  addStopValue(stop['detalle hac']);
  addStopValue(stop.hacDetail);

  // Direct exact match between any stop value and any selected machine value
  for (const sv of stopValues) {
    if (selValues.has(sv)) return true;
  }

  // Alphanumeric clean match
  for (const sav of stopAlphaValues) {
    if (selAlphaValues.has(sav)) return true;
  }

  // Substring / inclusion match for descriptive strings
  for (const sv of stopValues) {
    for (const selV of selValues) {
      if (sv.length >= 3 && selV.length >= 3) {
        if (sv.includes(selV) || selV.includes(sv)) return true;
      }
    }
  }

  return false;
}

export function isStopForShift(stop: any, shiftId: string | null | undefined, mastersAvailable?: any): boolean {
  if (!stop) return false;
  if (!shiftId) return true;

  const targetId = String(shiftId).trim().toLowerCase();
  const cleanTargetId = cleanShiftKey(shiftId);

  const stopShiftId = String(stop.shiftId || stop.shift_id || stop.id_turno || '').trim().toLowerCase();
  const cleanStopShiftId = cleanShiftKey(stopShiftId);

  const stopShiftName = String(stop.shiftName || stop.shiftDescription || stop.turno || stop['turno'] || '').trim().toLowerCase();
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

export function ensureHhMm(val: any): string {
  if (!val) return "00:00";
  let s = String(val).trim();
  if (s.includes("T")) s = s.split("T")[1];
  if (s.includes(" ")) {
    const parts = s.split(" ");
    s = parts.find(p => p.includes(":")) || parts[parts.length - 1];
  }
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].padStart(2, "0");
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  if (s.length >= 5 && s.includes(":")) {
    return s.substring(0, 5);
  }
  return s || "00:00";
}

export function ensureHhMmSs(val: any): string {
  if (!val) return "00:00:00";
  let s = String(val).trim();
  if (s.includes("T")) s = s.split("T")[1];
  if (s.includes(" ")) {
    const parts = s.split(" ");
    s = parts.find(p => p.includes(":")) || parts[parts.length - 1];
  }
  const match = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hh = match[1].padStart(2, "0");
    const mm = match[2];
    const ss = match[3] ? match[3].padStart(2, "0") : "00";
    return `${hh}:${mm}:${ss}`;
  }
  if (s.length === 5 && s.includes(":")) {
    return `${s}:00`;
  }
  return s || "00:00:00";
}

