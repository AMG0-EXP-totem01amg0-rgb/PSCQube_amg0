import { useState, useMemo, useCallback } from 'react';
import {
  HSObjectType,
  HSSector,
  HSObject,
  HSChecklistItem,
  HSInspection,
  HSActionPlan,
  HSObjectStatus,
  HSActionPlanStatus,
  HSChecklistAnswerStatus
} from './types';

// Mock Data Inicial
const INITIAL_OBJECT_TYPES: HSObjectType[] = [
  {
    id: 'ot-1',
    name: 'Extintor PQS / CO2',
    code: 'EXT',
    description: 'Extintores portátiles de polvo químico seco o CO2',
    inspectionFrequencyDays: 30,
    iconName: 'ShieldAlert'
  },
  {
    id: 'ot-2',
    name: 'Botiquín de Primeros Auxilios',
    code: 'BOT',
    description: 'Estaciones de primeros auxilios fijas y portátiles',
    inspectionFrequencyDays: 15,
    iconName: 'Cross'
  },
  {
    id: 'ot-3',
    name: 'Nicho Hidrante',
    code: 'HID',
    description: 'Gabinete con manguera, lanza y válvula de incendio',
    inspectionFrequencyDays: 30,
    iconName: 'Flame'
  },
  {
    id: 'ot-4',
    name: 'Ducha y Lavaojos de Emergencia',
    code: 'DUCH',
    description: 'Estaciones lavaojos y duchas de descontaminación',
    inspectionFrequencyDays: 7,
    iconName: 'Droplet'
  },
  {
    id: 'ot-5',
    name: 'Camilla de Emergencia',
    code: 'CAM',
    description: 'Camilla rígida con sujetadores y cuello ortopédico',
    inspectionFrequencyDays: 30,
    iconName: 'Activity'
  }
];

const INITIAL_SECTORS: HSSector[] = [
  {
    id: 'sec-1',
    name: 'Sector Ensacado',
    code: 'ENS',
    responsiblePerson: 'Carlos Gómez',
    locationDetails: 'Nave Central - Líneas 1 a 4'
  },
  {
    id: 'sec-2',
    name: 'Sector Paletizado',
    code: 'PAL',
    responsiblePerson: 'Roberto Martínez',
    locationDetails: 'Nave Sur - Celdas de Paletizado'
  },
  {
    id: 'sec-3',
    name: 'Sector Molienda y Hornos',
    code: 'MOL',
    responsiblePerson: 'Juan Perez',
    locationDetails: 'Edificio de Procesos - Piso 1 y 2'
  },
  {
    id: 'sec-4',
    name: 'Almacén de Producto Terminado',
    code: 'ALM',
    responsiblePerson: 'Mariana López',
    locationDetails: 'Depósito General y Playa de Carga'
  },
  {
    id: 'sec-5',
    name: 'Taller Mantenimiento Central',
    code: 'MNT',
    responsiblePerson: 'Esteban Morales',
    locationDetails: 'Sector Mecánico y Eléctrico'
  }
];

const INITIAL_OBJECTS: HSObject[] = [
  {
    id: 'obj-1',
    qrCode: 'QR-EXT-001',
    name: 'Extintor PQS 10kg - Ensacado L1',
    typeId: 'ot-1',
    sectorId: 'sec-1',
    locationDetail: 'Junto a columna C-12 cerca de Ensacadora 1',
    status: 'OK',
    lastInspectedAt: '2026-08-01',
    lastInspectedBy: 'Carlos Gómez',
    nextInspectionDue: '2026-08-31',
    notes: 'Manómetro en rango verde. Precinto intacto.'
  },
  {
    id: 'obj-2',
    qrCode: 'QR-EXT-002',
    name: 'Extintor CO2 5kg - Paletizado Celda 2',
    typeId: 'ot-1',
    sectorId: 'sec-2',
    locationDetail: 'Panel principal Celda 2 Paletizadora',
    status: 'NO_OK',
    lastInspectedAt: '2026-08-10',
    lastInspectedBy: 'Roberto Martínez',
    nextInspectionDue: '2026-08-15',
    notes: 'Manómetro fuera de rango y manguera agrietada.',
    observations: 'Sin presión (en rojo) y fisura visible en base de acople.'
  },
  {
    id: 'obj-3',
    qrCode: 'QR-BOT-001',
    name: 'Botiquín de Primeros Auxilios - Ensacado',
    typeId: 'ot-2',
    sectorId: 'sec-1',
    locationDetail: 'Oficina de supervisores Ensacado',
    status: 'NO_OK',
    lastInspectedAt: '2026-08-05',
    lastInspectedBy: 'Carlos Gómez',
    nextInspectionDue: '2026-08-20',
    notes: 'Falta reposición de insumos básicos.',
    observations: 'Insumos básicos incompletos (sin gasas ni vendas).'
  },
  {
    id: 'obj-4',
    qrCode: 'QR-HID-001',
    name: 'Nicho Hidrante N° 1 - Molienda',
    typeId: 'ot-3',
    sectorId: 'sec-3',
    locationDetail: 'Acceso principal Hornos PB',
    status: 'OK',
    lastInspectedAt: '2026-07-28',
    lastInspectedBy: 'Juan Perez',
    nextInspectionDue: '2026-08-28',
    notes: 'Manguera plegada y presurizada correctamente.'
  },
  {
    id: 'obj-5',
    qrCode: 'QR-DUCH-001',
    name: 'Ducha Lavaojos - Laboratorio Molienda',
    typeId: 'ot-4',
    sectorId: 'sec-3',
    locationDetail: 'Pasillo externo Lab Química',
    status: 'PENDING',
    lastInspectedAt: '2026-07-15',
    lastInspectedBy: 'Juan Perez',
    nextInspectionDue: '2026-08-12',
    notes: 'Inspección periódica pendiente.'
  }
];

const INITIAL_CHECKLIST_ITEMS: HSChecklistItem[] = [
  // Extintores
  { id: 'cli-1', objectTypeId: 'ot-1', label: 'Acceso y visibilidad despejada', description: 'Sin obstáculos para alcanzar el equipo rápidamente', category: 'Ubicación', isCritical: false, isEnabled: true },
  { id: 'cli-2', objectTypeId: 'ot-1', label: 'Manómetro en rango de presión correcto', description: 'La aguja debe estar en la zona verde de servicio', category: 'Presión', isCritical: true, isEnabled: true },
  { id: 'cli-3', objectTypeId: 'ot-1', label: 'Precinto y pasador de seguridad intacto', description: 'Verificar que no haya sido accionado o alterado', category: 'Seguridad', isCritical: true, isEnabled: true },
  { id: 'cli-4', objectTypeId: 'ot-1', label: 'Manguera y boquilla en buen estado', description: 'Sin fisuras, obstrucciones ni rajaduras', category: 'Estructura', isCritical: false, isEnabled: true },
  { id: 'cli-5', objectTypeId: 'ot-1', label: 'Tarjeta de inspección vigente', description: 'Con la fecha del último control registrada', category: 'Documentación', isCritical: false, isEnabled: true },

  // Botiquines
  { id: 'cli-6', objectTypeId: 'ot-2', label: 'Gabinete limpio, cerrado y señalizado', description: 'Identificación clara y libre de suciedad', category: 'Gabinete', isCritical: false, isEnabled: true },
  { id: 'cli-7', objectTypeId: 'ot-2', label: 'Stock completo de insumos básicos (Gasas, Guantes, Vendas)', description: 'Verificar vencimiento e integridad de empaques', category: 'Insumos', isCritical: true, isEnabled: true },
  { id: 'cli-8', objectTypeId: 'ot-2', label: 'Antisépticos y solución fisiológica vigentes', description: 'Fechas de caducidad visibles', category: 'Insumos', isCritical: true, isEnabled: true },

  // Nicho Hidrante
  { id: 'cli-9', objectTypeId: 'ot-3', label: 'Manguera doblada correctamente y sin roturas', description: 'Acomodada en la devanadera o cuna', category: 'Manguera', isCritical: true, isEnabled: true },
  { id: 'cli-10', objectTypeId: 'ot-3', label: 'Lanza y boquilla conectada', description: 'Rosca limpia y lista para operar', category: 'Accesorios', isCritical: true, isEnabled: true },
  { id: 'cli-11', objectTypeId: 'ot-3', label: 'Llave de ajuste presente en el gabinete', description: 'Llave tipo Spanner disponible', category: 'Accesorios', isCritical: false, isEnabled: true },

  // Ducha y Lavaojos
  { id: 'cli-12', objectTypeId: 'ot-4', label: 'Accionamiento suave de palanca y pedal', description: 'Prueba de flujo sin trabas mecánicas', category: 'Funcionamiento', isCritical: true, isEnabled: true },
  { id: 'cli-13', objectTypeId: 'ot-4', label: 'Flujo y presión de agua constante', description: 'Agua limpia y chorro continuo lavaojos', category: 'Hidráulica', isCritical: true, isEnabled: true },
  { id: 'cli-14', objectTypeId: 'ot-4', label: 'Drenaje sin obstrucciones', description: 'Rejilla de desagüe limpia', category: 'Infraestructura', isCritical: false, isEnabled: true }
];

const INITIAL_INSPECTIONS: HSInspection[] = [
  {
    id: 'insp-101',
    objectId: 'obj-2',
    objectName: 'Extintor CO2 5kg - Paletizado Celda 2',
    objectQrCode: 'QR-EXT-002',
    sectorName: 'Sector Paletizado',
    operatorDni: '20-33445566-7',
    operatorName: 'Roberto Martínez',
    date: '2026-08-10 14:30',
    overallResult: 'NO_CONFORME_CRITICA',
    comments: 'Se detectó manómetro fuera de presión y manguera fisurada.',
    actionPlanGenerated: true,
    answers: [
      { checklistItemId: 'cli-1', checklistItemLabel: 'Acceso y visibilidad despejada', status: 'OK', isCriticalFinding: false },
      {
        checklistItemId: 'cli-2',
        checklistItemLabel: 'Manómetro en rango de presión correcto',
        status: 'NO_OK',
        observation: 'Sin presión (aguja en zona roja por debajo de los 10 bar)',
        actionPlan: 'Reemplazo inmediato del manómetro y prueba de estanqueidad en taller.',
        isCriticalFinding: true
      },
      { checklistItemId: 'cli-3', checklistItemLabel: 'Precinto y pasador de seguridad intacto', status: 'OK', isCriticalFinding: false },
      {
        checklistItemId: 'cli-4',
        checklistItemLabel: 'Manguera y boquilla en buen estado',
        status: 'NO_OK',
        observation: 'Fisura visible en base de acople de manguera',
        actionPlan: 'Sustitución de manguera por repuesto homologado.',
        isCriticalFinding: false
      }
    ]
  },
  {
    id: 'insp-100',
    objectId: 'obj-1',
    objectName: 'Extintor PQS 10kg - Ensacado L1',
    objectQrCode: 'QR-EXT-001',
    sectorName: 'Sector Ensacado',
    operatorDni: '20-11223344-5',
    operatorName: 'Carlos Gómez',
    date: '2026-08-01 09:15',
    overallResult: 'CONFORME',
    comments: 'Extintor en impecables condiciones operativas.',
    actionPlanGenerated: false,
    answers: [
      { checklistItemId: 'cli-1', checklistItemLabel: 'Acceso y visibilidad despejada', status: 'OK', isCriticalFinding: false },
      { checklistItemId: 'cli-2', checklistItemLabel: 'Manómetro en rango de presión correcto', status: 'OK', isCriticalFinding: false },
      { checklistItemId: 'cli-3', checklistItemLabel: 'Precinto y pasador de seguridad intacto', status: 'OK', isCriticalFinding: false },
      { checklistItemId: 'cli-4', checklistItemLabel: 'Manguera y boquilla en buen estado', status: 'OK', isCriticalFinding: false }
    ]
  }
];

const INITIAL_ACTION_PLANS: HSActionPlan[] = [
  {
    id: 'ap-1',
    inspectionId: 'insp-101',
    objectId: 'obj-2',
    objectName: 'Extintor CO2 5kg - Paletizado Celda 2',
    sectorName: 'Sector Paletizado',
    checklistItemId: 'cli-2',
    title: 'Recarga y cambio de manguera de Extintor QR-EXT-002',
    description: 'El extintor perdió presión total y presenta fisura en la manguera. Requiere reemplazo por extintor de retén y envío a taller.',
    severity: 'CRITICAL',
    assignedTo: 'Esteban Morales (Mantenimiento)',
    dueDate: '2026-08-15',
    status: 'IN_PROGRESS',
    resolutionNotes: 'Extintor sustituido temporalmente por equipo de reserva #R-04.',
    createdAt: '2026-08-10 14:35'
  },
  {
    id: 'ap-2',
    objectId: 'obj-3',
    objectName: 'Botiquín de Primeros Auxilios - Ensacado',
    sectorName: 'Sector Ensacado',
    checklistItemId: 'cli-7',
    title: 'Reposición de Insumos Faltantes en Botiquín QR-BOT-001',
    description: 'Reposición urgente de gasas estériles, curitas y solución antiséptica.',
    severity: 'MEDIUM',
    assignedTo: 'Lic. H&S Laura Varela',
    dueDate: '2026-08-18',
    status: 'OPEN',
    createdAt: '2026-08-05 11:00'
  }
];

export function useHSModule() {
  const [objectTypes, setObjectTypes] = useState<HSObjectType[]>(INITIAL_OBJECT_TYPES);
  const [sectors, setSectors] = useState<HSSector[]>(INITIAL_SECTORS);
  const [objects, setObjects] = useState<HSObject[]>(INITIAL_OBJECTS);
  const [checklistItems, setChecklistItems] = useState<HSChecklistItem[]>(INITIAL_CHECKLIST_ITEMS);
  const [inspections, setInspections] = useState<HSInspection[]>(INITIAL_INSPECTIONS);
  const [actionPlans, setActionPlans] = useState<HSActionPlan[]>(INITIAL_ACTION_PLANS);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>('obj-1');

  // Enriquecer objetos con nombres de tipo y sector
  const enrichedObjects = useMemo(() => {
    return objects.map(obj => {
      const type = objectTypes.find(t => t.id === obj.typeId);
      const sector = sectors.find(s => s.id === obj.sectorId);
      return {
        ...obj,
        typeName: type ? type.name : 'Desconocido',
        sectorName: sector ? sector.name : 'Sin Sector'
      };
    });
  }, [objects, objectTypes, sectors]);

  // Objeto seleccionado actualmente
  const selectedObject = useMemo(() => {
    if (!selectedObjectId) return null;
    return enrichedObjects.find(o => o.id === selectedObjectId) || null;
  }, [enrichedObjects, selectedObjectId]);

  // Checklist items para el objeto seleccionado
  const activeChecklistForSelectedObject = useMemo(() => {
    if (!selectedObject) return [];
    return checklistItems.filter(ci => ci.objectTypeId === selectedObject.typeId && ci.isEnabled);
  }, [selectedObject, checklistItems]);

  // Historial de inspecciones para el objeto seleccionado
  const selectedObjectInspectionHistory = useMemo(() => {
    if (!selectedObject) return [];
    return inspections.filter(i => i.objectId === selectedObject.id);
  }, [inspections, selectedObject]);

  // Selección por Código QR
  const selectObjectByQR = useCallback((qrCode: string): boolean => {
    const found = enrichedObjects.find(o => o.qrCode.toUpperCase().trim() === qrCode.toUpperCase().trim());
    if (found) {
      setSelectedObjectId(found.id);
      return true;
    }
    return false;
  }, [enrichedObjects]);

  // Registrar nueva inspección
  const submitInspection = useCallback((
    inspectionData: {
      objectId: string;
      operatorDni: string;
      operatorName: string;
      comments?: string;
      answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string; actionPlan?: string }[];
    }
  ) => {
    const targetObj = enrichedObjects.find(o => o.id === inspectionData.objectId);
    if (!targetObj) return null;

    const answersWithDetails = inspectionData.answers.map(ans => {
      const item = checklistItems.find(c => c.id === ans.checklistItemId);
      const isCriticalFinding = (ans.status === 'NO_OK') && (item?.isCritical ?? false);
      return {
        checklistItemId: ans.checklistItemId,
        checklistItemLabel: item ? item.label : 'Ítem',
        status: ans.status,
        observation: ans.observation,
        actionPlan: ans.actionPlan,
        isCriticalFinding
      };
    });

    const hasAnyNoOk = answersWithDetails.some(a => a.status === 'NO_OK');

    const overallResult: 'CONFORME' | 'NO_CONFORME_MENOR' | 'NO_CONFORME_CRITICA' = hasAnyNoOk
      ? 'NO_CONFORME_CRITICA'
      : 'CONFORME';
    const newObjectStatus: HSObjectStatus = hasAnyNoOk ? 'NO_OK' : 'OK';

    const newInspectionId = `insp-${Date.now()}`;
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newInspection: HSInspection = {
      id: newInspectionId,
      objectId: targetObj.id,
      objectName: targetObj.name,
      objectQrCode: targetObj.qrCode,
      sectorName: targetObj.sectorName || 'Sin Sector',
      operatorDni: inspectionData.operatorDni,
      operatorName: inspectionData.operatorName,
      date: dateStr,
      overallResult,
      comments: inspectionData.comments,
      answers: answersWithDetails,
      actionPlanGenerated: hasAnyNoOk
    };

    setInspections(prev => [newInspection, ...prev]);

    // Actualizar estado del objeto
    const typeObj = objectTypes.find(t => t.id === targetObj.typeId);
    const freqDays = typeObj ? typeObj.inspectionFrequencyDays : 30;
    const nextDueDate = new Date(Date.now() + freqDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const firstFailed = answersWithDetails.find(a => a.status === 'NO_OK');

    setObjects(prev => prev.map(o => {
      if (o.id === targetObj.id) {
        return {
          ...o,
          status: newObjectStatus,
          lastInspectedAt: dateStr.substring(0, 10),
          lastInspectedBy: inspectionData.operatorName,
          nextInspectionDue: nextDueDate,
          notes: inspectionData.comments || o.notes,
          observations: firstFailed ? firstFailed.observation : o.observations
        };
      }
      return o;
    }));

    // Generar Plan de Acción automático si hubo hallazgos
    if (hasAnyNoOk) {
      const failedAnswers = answersWithDetails.filter(a => a.status === 'NO_OK');
      const sectorObj = sectors.find(s => s.id === targetObj.sectorId);
      const responsiblePerson = sectorObj?.responsiblePerson || 'Asignación Pendiente';

      const newPlans: HSActionPlan[] = failedAnswers.map((fail, idx) => ({
        id: `ap-auto-${Date.now()}-${idx}`,
        inspectionId: newInspectionId,
        objectId: targetObj.id,
        objectName: targetObj.name,
        sectorName: targetObj.sectorName || 'Sin Sector',
        checklistItemId: fail.checklistItemId,
        title: `Hallazgo: ${fail.checklistItemLabel}`,
        description: `Detalle del Hallazgo: ${fail.observation || 'Sin detalle'}\nPlan de Acción: ${fail.actionPlan || 'Sin plan redactado'}`,
        severity: fail.isCriticalFinding ? 'CRITICAL' : 'HIGH',
        assignedTo: responsiblePerson,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'OPEN',
        createdAt: dateStr
      }));

      setActionPlans(prev => [...newPlans, ...prev]);
    }

    return newInspection;
  }, [enrichedObjects, checklistItems, objectTypes, sectors]);

  // ABM Maestros
  const addOrUpdateObjectType = useCallback((item: Partial<HSObjectType>) => {
    if (item.id) {
      setObjectTypes(prev => prev.map(t => t.id === item.id ? { ...t, ...item } as HSObjectType : t));
    } else {
      const newItem: HSObjectType = {
        id: `ot-${Date.now()}`,
        name: item.name || 'Nuevo Tipo',
        code: item.code || 'TIP',
        description: item.description || '',
        inspectionFrequencyDays: item.inspectionFrequencyDays || 30,
        iconName: item.iconName || 'ShieldCheck'
      };
      setObjectTypes(prev => [...prev, newItem]);
    }
  }, []);

  const addOrUpdateSector = useCallback((item: Partial<HSSector>) => {
    if (item.id) {
      setSectors(prev => prev.map(s => s.id === item.id ? { ...s, ...item } as HSSector : s));
    } else {
      const newItem: HSSector = {
        id: `sec-${Date.now()}`,
        name: item.name || 'Nuevo Sector',
        code: item.code || 'SEC',
        responsiblePerson: item.responsiblePerson || 'Sin Asignar',
        locationDetails: item.locationDetails || ''
      };
      setSectors(prev => [...prev, newItem]);
    }
  }, []);

  const addOrUpdateObject = useCallback((item: Partial<HSObject>) => {
    if (item.id) {
      setObjects(prev => prev.map(o => o.id === item.id ? { ...o, ...item } as HSObject : o));
    } else {
      const newItem: HSObject = {
        id: `obj-${Date.now()}`,
        qrCode: item.qrCode || `QR-NEW-${Math.floor(Math.random() * 1000)}`,
        name: item.name || 'Nuevo Objeto',
        typeId: item.typeId || objectTypes[0]?.id || 'ot-1',
        sectorId: item.sectorId || sectors[0]?.id || 'sec-1',
        locationDetail: item.locationDetail || '',
        status: 'PENDING',
        nextInspectionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
      setObjects(prev => [...prev, newItem]);
    }
  }, [objectTypes, sectors]);

  // Checklist Items toggle
  const toggleChecklistItem = useCallback((id: string, isEnabled: boolean) => {
    setChecklistItems(prev => prev.map(ci => ci.id === id ? { ...ci, isEnabled } : ci));
  }, []);

  const addChecklistItem = useCallback((item: Partial<HSChecklistItem>) => {
    const newItem: HSChecklistItem = {
      id: `cli-${Date.now()}`,
      objectTypeId: item.objectTypeId || 'ot-1',
      label: item.label || 'Nuevo Ítem',
      description: item.description || '',
      category: item.category || 'General',
      isCritical: item.isCritical ?? false,
      isEnabled: true
    };
    setChecklistItems(prev => [...prev, newItem]);
  }, []);

  // Planes de Acción status update
  const updateActionPlanStatus = useCallback((id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string) => {
    setActionPlans(prev => prev.map(ap => {
      if (ap.id === id) {
        return {
          ...ap,
          status,
          assignedTo: assignedTo || ap.assignedTo,
          resolutionNotes: notes !== undefined ? notes : ap.resolutionNotes,
          resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date().toISOString().substring(0, 16) : ap.resolvedAt
        };
      }
      return ap;
    }));
  }, []);

  return {
    objectTypes,
    sectors,
    objects: enrichedObjects,
    checklistItems,
    inspections,
    actionPlans,
    selectedObject,
    selectedObjectId,
    setSelectedObjectId,
    activeChecklistForSelectedObject,
    selectedObjectInspectionHistory,
    selectObjectByQR,
    submitInspection,
    addOrUpdateObjectType,
    addOrUpdateSector,
    addOrUpdateObject,
    toggleChecklistItem,
    addChecklistItem,
    updateActionPlanStatus
  };
}
