export type HSObjectStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'PENDING';

export type HSInspectionResult = 'CONFORME' | 'NO_CONFORME_MENOR' | 'NO_CONFORME_CRITICA';

export type HSChecklistAnswerStatus = 'OK' | 'NO_OK' | 'N_A';

export type HSActionPlanStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type HSActionPlanSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HSObjectType {
  id: string;
  name: string;
  code: string;
  description: string;
  inspectionFrequencyDays: number;
  iconName: string;
  activeChecklistItemsCount?: number;
}

export interface HSSector {
  id: string;
  name: string;
  code: string;
  responsiblePerson: string;
  locationDetails?: string;
}

export interface HSObject {
  id: string;
  qrCode: string;
  name: string;
  typeId: string;
  typeName?: string;
  sectorId: string;
  sectorName?: string;
  locationDetail: string;
  status: HSObjectStatus;
  lastInspectedAt?: string;
  lastInspectedBy?: string;
  nextInspectionDue: string;
  notes?: string;
}

export interface HSChecklistItem {
  id: string;
  objectTypeId: string;
  label: string;
  description?: string;
  category: string;
  isCritical: boolean;
  isEnabled: boolean;
}

export interface HSInspectionAnswer {
  checklistItemId: string;
  checklistItemLabel: string;
  status: HSChecklistAnswerStatus;
  observation?: string;
  isCriticalFinding: boolean;
}

export interface HSInspection {
  id: string;
  objectId: string;
  objectName: string;
  objectQrCode: string;
  sectorName: string;
  operatorDni: string;
  operatorName: string;
  date: string;
  overallResult: HSInspectionResult;
  comments?: string;
  answers: HSInspectionAnswer[];
  actionPlanGenerated?: boolean;
}

export interface HSActionPlan {
  id: string;
  inspectionId?: string;
  objectId: string;
  objectName: string;
  sectorName: string;
  checklistItemId?: string;
  title: string;
  description: string;
  severity: HSActionPlanSeverity;
  assignedTo: string;
  dueDate: string;
  status: HSActionPlanStatus;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}
