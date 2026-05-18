export type ShiftName = 'T1' | 'T2' | 'T3';

export interface Shift {
  id: string;
  name: ShiftName;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationHours: number;
}

export interface Machine {
  id: string;
  type: 'PALLETIZADORA' | 'ENSACADORA';
  name: string;
  hacId?: string;
  nozzles?: number; // solo para ensacadoras
}

export interface HAC {
  id: string; // idhac automático
  hac: string; // HAC asignado
  detail: string; // Detalle HAC (Descripción)
  gpoCodObjeto: string; // GPO.CÓD. OBJETO (SAP)
  equipment: string; // EQUIPO (SAP)
}

export interface Cause {
  id: string; // idparo automático
  hac: string; // HAC (Consultado de equipos)
  text: string; // Texto de causa
  partObject: string; // Parte Objeto (SAP)
  symptomGroup: string; // GPO.CÓD. SÍNTOMA (SAP)
  symptomCode: string; // CÓD. SÍNTOMA (SAP)
  sapCause: string; // CAUSA SAP (SAP)
  causeGroup: string; // GPO.COD. CAUSA (SAP)
  causeCode: string; // CÓDIGO CAUSA (SAP)
  stopType: 'INTERNO' | 'EXTERNO';
}

export interface Material {
  id: string;
  name: string;      // Descripción
  code?: string;      // Código SAP
  packingWeight: number; // Peso Embalaje (pallet)
  bagWeight: number;     // Peso bolsa
  isPallet: boolean;     // Es tarima?
  isProductive: boolean; // Es productivo?
  isSupply: boolean;     // Es insumo?
  isBigBag: boolean;     // Es bigbag?
}

export interface CapacityBDP {
  id: string;
  baggerId: string;
  palletizerId: string;
  materialId: string;
  bdp: number; // Toneladas por hora teóricas
}

export interface MachineStop {
  id: string;
  date: string; // ISO date
  finishDate?: string;
  machineId: string; // Palletizadora afectada
  shiftId: string;
  materialId: string;
  startTime: string; // HH:mm
  endTime?: string;   // HH:mm
  durationMinutes: number;
  hacId: string;
  causeId: string;
  user: string;
  workCenter: string;
  center: string;
}

export interface NozzleNews {
  id: string;
  nozzleNumber: number;
  startTime: string;
  endTime: string;
  isAllShift: boolean;
  observation?: string;
}

export interface ProductionReport {
  id: string;
  date: string;
  shiftId: string;
  palletizerId: string;
  baggerId: string;
  materialId: string;
  bagsProduced: number;
  tonsProduced: number;
  bdp: number;
  // Nuevos campos operativos
  availableNozzlesShift: number;
  bagProvider: string;
  discardedBagsBagger: number;
  notNozzledBags: number;
  discardedBagsVentocheck: number;
  discardedBagsTransport: number;
  nozzleNews: NozzleNews[];
}

export interface DaterControl {
  id: string; // IDCTRLFECHADOR
  date: string; // FECHA (ISO)
  userId: string; // MAQUINISTA (ID)
  userName: string; // DESCRIPCIÓN MAQUINISTA (Nombre)
  shiftId: string; // TURNO
  hac: string; // HAC del fechador
  purge: 'SI' | 'NO'; // PURGA
  containerLevel: 'COMPLETO' | 'MEDIO' | 'VACÍO'; // NIVEL RECIPIENTE
  printQuality: 'BUENO' | 'REGULAR' | 'DEFICIENTE'; // CALIDAD IMPRESION
  inkStock: number; // STOCK TINTA
  solventStock: number; // STOCK SOLVENTE
  headsStock: number; // STOCK CABEZALES
  observations: string; // OBSERVACIONES
}

export interface ScaleControl {
  id: string; // IDCRTLBALANZA
  date: string; // FECHA
  userId: string; // MAQUINISTA (ID)
  userName: string; // DESCRIPCIÓN MAQUINISTA (Nombre)
  shiftId: string; // TURNO
  hac: string; // HAC de la balanza
  weight1: number; // PESO #1
  weight2: number; // PESO #2
  weight3: number; // PESO #3
  patternWeight: number; // PESO PATRÓN
  average: number; // MEDIA
  bias: number; // BIAS
  range: number; // RANGO
  observations: string;
}

export interface UserContext {
  role: 'OPERARIO' | 'ADMIN';
  selectedPalletizerId: string | null;
  selectedShiftId: string | null;
  selectedDate: string; // ISO date string YYYY-MM-DD
}

export interface MasterData {
  palletizers: Machine[];
  baggers: Machine[];
  materials: Material[];
  hacs: HAC[];
  causes: Cause[];
  shifts: Shift[];
  capacities: CapacityBDP[];
}
