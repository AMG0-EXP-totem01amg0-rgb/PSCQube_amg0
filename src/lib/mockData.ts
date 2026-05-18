import { HAC, Cause, Shift, Machine, Material, CapacityBDP } from '../types';

export const SHIFTS: Shift[] = [
  { id: 'S1', name: 'T1', startTime: '06:00', endTime: '14:00', durationHours: 8 },
  { id: 'S2', name: 'T2', startTime: '14:00', endTime: '22:00', durationHours: 8 },
  { id: 'S3', name: 'T3', startTime: '22:00', endTime: '06:00', durationHours: 8 },
];

export const PALLETIZERS: Machine[] = [
  { id: 'P1', type: 'PALLETIZADORA', name: 'Palletizadora 1' },
  { id: 'P2', type: 'PALLETIZADORA', name: 'Palletizadora 2' },
  { id: 'P3', type: 'PALLETIZADORA', name: 'Palletizadora 3' },
];

export const BAGGERS: Machine[] = [
  { id: 'E1', type: 'ENSACADORA', name: 'Ensacadora 1', nozzles: 4, hacId: 'H1' },
  { id: 'E2', type: 'ENSACADORA', name: 'Ensacadora 2', nozzles: 4, hacId: 'H2' },
  { id: 'E3', type: 'ENSACADORA', name: 'Ensacadora 3', nozzles: 4, hacId: 'H1' },
  { id: 'E4', type: 'ENSACADORA', name: 'Ensacadora 4', nozzles: 4, hacId: 'H3' },
];

export const MATERIALS: Material[] = [
  { 
    id: 'M1', 
    name: 'Cemento 50kg', 
    code: 'SAP-101', 
    packingWeight: 1500, 
    bagWeight: 50, 
    isPallet: false, 
    isProductive: true, 
    isSupply: false, 
    isBigBag: false 
  },
  { 
    id: 'M2', 
    name: 'Tarima Madera', 
    code: 'SAP-102', 
    packingWeight: 25, 
    bagWeight: 0, 
    isPallet: true, 
    isProductive: false, 
    isSupply: true, 
    isBigBag: false 
  },
  { 
    id: 'M3', 
    name: 'Bolson BigBag', 
    code: 'SAP-103', 
    packingWeight: 1000, 
    bagWeight: 1000, 
    isPallet: false, 
    isProductive: true, 
    isSupply: false, 
    isBigBag: true 
  },
];

export const HACS: HAC[] = [
  { id: 'H1', hac: 'HAC-001', detail: 'SISTEMA DE AIRE', gpoCodObjeto: 'OBJ01', equipment: 'COMPRESOR', isDater: false, isScale: false },
  { id: 'H2', hac: 'HAC-002', detail: 'SISTEMA HIDRAULICO', gpoCodObjeto: 'OBJ02', equipment: 'BOMBA HP', isDater: false, isScale: false },
  { id: 'H3', hac: 'HAC-003', detail: 'ELECTRICO', gpoCodObjeto: 'OBJ03', equipment: 'PLC MAIN', isDater: false, isScale: false },
  { id: 'H4', hac: 'HAC-004', detail: 'FECHADOR LINX', gpoCodObjeto: 'OBJ04', equipment: 'FECHADOR', isDater: true, isScale: false },
  { id: 'H5', hac: 'HAC-005', detail: 'FECHADOR VIDEOJET', gpoCodObjeto: 'OBJ05', equipment: 'FECHADOR', isDater: true, isScale: false },
  { id: 'H6', hac: 'HAC-006', detail: 'BALANZA DINAMICA #1', gpoCodObjeto: 'OBJ06', equipment: 'BALANZA', isDater: false, isScale: true },
  { id: 'H7', hac: 'HAC-007', detail: 'BALANZA DINAMICA #2', gpoCodObjeto: 'OBJ07', equipment: 'BALANZA', isDater: false, isScale: true },
];

export const CAUSES: Cause[] = [
  { id: 'C1', hac: 'HAC-001', text: 'FALTA DE PRESION', partObject: 'VALVULA', symptomGroup: 'G1', symptomCode: 'S1', sapCause: 'C-01', causeGroup: 'G1', causeCode: 'CC01', stopType: 'INTERNO' },
  { id: 'C2', hac: 'HAC-001', text: 'FALTA DE ENERGIA (PLANTA)', partObject: 'PLANTA', symptomGroup: 'G2', symptomCode: 'S2', sapCause: 'C-02', causeGroup: 'G2', causeCode: 'CC02', stopType: 'EXTERNO' },
  { id: 'C3', hac: 'HAC-002', text: 'FUGA DE ACEITE', partObject: 'MANGUERA', symptomGroup: 'G3', symptomCode: 'S3', sapCause: 'C-03', causeGroup: 'G3', causeCode: 'CC03', stopType: 'INTERNO' },
];

export const CAPACITIES: CapacityBDP[] = [
  { id: 'B1', baggerId: 'E1', palletizerId: 'P1', materialId: 'M1', bdp: 100 },
  { id: 'B2', baggerId: 'E1', palletizerId: 'P1', materialId: 'M2', bdp: 80 },
  { id: 'B3', baggerId: 'E2', palletizerId: 'P1', materialId: 'M1', bdp: 120 },
];
