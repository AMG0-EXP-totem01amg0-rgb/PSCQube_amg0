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
  { id: 'M1', name: 'Material A' },
  { id: 'M2', name: 'Material B' },
  { id: 'M3', name: 'Material C' },
];

export const HACS: HAC[] = [
  { id: 'H1', detail: 'SISTEMA DE AIRE', code: 'AIR01', objectCode: 'OBJ01', equipment: 'COMPRESOR' },
  { id: 'H2', detail: 'SISTEMA HIDRAULICO', code: 'HYD01', objectCode: 'OBJ02', equipment: 'BOMBA HP' },
  { id: 'H3', detail: 'ELECTRICO', code: 'ELE01', objectCode: 'OBJ03', equipment: 'PLC MAIN' },
];

export const CAUSES: Cause[] = [
  { id: 'C1', hacId: 'H1', text: 'FALTA DE PRESION', partObject: 'VALVULA', symptomGroup: 'G1', symptomCode: 'S1', sapCause: 'C-01', causeGroup: 'G1', causeCode: 'CC01', stopType: 'INTERNO' },
  { id: 'C2', hacId: 'H1', text: 'FALTA DE ENERGIA (PLANTA)', partObject: 'PLANTA', symptomGroup: 'G2', symptomCode: 'S2', sapCause: 'C-02', causeGroup: 'G2', causeCode: 'CC02', stopType: 'EXTERNO' },
  { id: 'C3', hacId: 'H2', text: 'FUGA DE ACEITE', partObject: 'MANGUERA', symptomGroup: 'G3', symptomCode: 'S3', sapCause: 'C-03', causeGroup: 'G3', causeCode: 'CC03', stopType: 'INTERNO' },
];

export const CAPACITIES: CapacityBDP[] = [
  { id: 'B1', baggerId: 'E1', palletizerId: 'P1', materialId: 'M1', bdp: 100 },
  { id: 'B2', baggerId: 'E1', palletizerId: 'P1', materialId: 'M2', bdp: 80 },
  { id: 'B3', baggerId: 'E2', palletizerId: 'P1', materialId: 'M1', bdp: 120 },
];
