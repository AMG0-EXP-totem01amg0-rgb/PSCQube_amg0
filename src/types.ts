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
  id: string;
  detail: string;
  code: string;
  objectCode: string;
  equipment: string;
}

export interface Cause {
  id: string;
  hacId: string;
  text: string;
  partObject: string;
  symptomGroup: string;
  symptomCode: string;
  sapCause: string;
  causeGroup: string;
  causeCode: string;
  stopType: 'INTERNO' | 'EXTERNO';
}

export interface Material {
  id: string;
  name: string;
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
