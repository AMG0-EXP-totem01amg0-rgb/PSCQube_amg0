import { useState, useMemo, useCallback, useEffect } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import {
  HSObjectType,
  HSSector,
  HSObject,
  HSChecklistItem,
  HSInspection,
  HSActionPlan,
  HSObjectStatus,
  HSActionPlanStatus,
  HSChecklistAnswerStatus,
  HSChecklistModel
} from './types';

// Tipos de Objeto estándar predefinidos
export const DEFAULT_OBJECT_TYPES: HSObjectType[] = [
  {
    id: 'EXT',
    name: 'Extintor PQS / CO2',
    code: 'EXT',
    description: 'Extintores portátiles de polvo químico seco o CO2',
    inspectionFrequencyDays: 30,
    iconName: 'ShieldAlert'
  },
  {
    id: 'BOT',
    name: 'Botiquín de Primeros Auxilios',
    code: 'BOT',
    description: 'Estaciones de primeros auxilios fijas y portátiles',
    inspectionFrequencyDays: 15,
    iconName: 'Cross'
  },
  {
    id: 'HID',
    name: 'Nicho Hidrante',
    code: 'HID',
    description: 'Gabinete con manguera, lanza y válvula de incendio',
    inspectionFrequencyDays: 30,
    iconName: 'Flame'
  },
  {
    id: 'DUCH',
    name: 'Ducha y Lavaojos de Emergencia',
    code: 'DUCH',
    description: 'Estaciones lavaojos y duchas de descontaminación',
    inspectionFrequencyDays: 7,
    iconName: 'Droplet'
  },
  {
    id: 'CAM',
    name: 'Camilla de Emergencia',
    code: 'CAM',
    description: 'Camilla rígida con sujetadores y cuello ortopédico',
    inspectionFrequencyDays: 30,
    iconName: 'Activity'
  }
];

export function useHSModule() {
  const [objectTypes, setObjectTypes] = useState<HSObjectType[]>([]);
  const [sectors, setSectors] = useState<HSSector[]>([]);
  const [rawObjects, setRawObjects] = useState<any[]>([]);
  const [checklistModels, setChecklistModels] = useState<HSChecklistModel[]>([]);
  const [checklistItems, setChecklistItems] = useState<HSChecklistItem[]>([]);
  const [inspections, setInspections] = useState<HSInspection[]>([]);
  const [actionPlans, setActionPlans] = useState<HSActionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setIsLoading(true);
    try {
      // 1. Tipos de Objeto
      const { data: objectTypesData } = await supabase.from('hs_object_types').select('*').order('name');
      if (objectTypesData) {
        setObjectTypes(objectTypesData.map((ot: any) => ({
          id: ot.id,
          name: ot.name || '',
          code: ot.code || '',
          description: ot.description || '',
          inspectionFrequencyDays: ot.inspection_frequency_days || 30,
          iconName: ot.icon_name || 'ShieldAlert'
        })));
      }

      // 1.5. Sectores
      const { data: sectorsData } = await supabase.from('sectors').select('*').order('name');
      if (sectorsData) {
        // Deduplicar sectores por nombre para evitar repetidos en la UI
        const uniqueSectors = Array.from(new Map(sectorsData.map(s => [s.name.trim().toLowerCase(), s])).values());
        setSectors(uniqueSectors.map((s: any) => ({
          id: s.id,
          name: s.name || '',
          code: s.code || '',
          responsiblePerson: s.responsible_person || '',
          locationDetails: s.location_details || ''
        })));
      }

      // 2. Objetos
      const { data: objectsData } = await supabase.from('hs_objects').select('*').order('name');
      if (objectsData) setRawObjects(objectsData);

      // 3. Modelos
      const { data: modelsData } = await supabase.from('hs_checklist_models').select('*').order('name');
      if (modelsData) {
        setChecklistModels(modelsData.map((m: any) => ({
          id: m.id,
          objectTypeId: m.object_type_id,
          name: m.name || '',
          status: m.status || 'ACTIVE',
          inspectionFrequencyDays: m.inspection_frequency_days || 30,
          createdAt: m.created_at
        })));
      }

      // 4. Items
      const { data: itemsData } = await supabase.from('hs_checklist_items').select('*').order('item_order');
      if (itemsData) {
        setChecklistItems(itemsData.map((i: any) => ({
          id: i.id,
          objectTypeId: i.object_type,
          checklistModelId: i.checklist_model_id,
          label: i.description,
          description: '',
          category: 'General',
          isCritical: Boolean(i.is_critical),
          isEnabled: true
        })));
      }

      // 5. Inspecciones
      const { data: inspectionsData } = await supabase.from('hs_inspections').select('*').order('created_at', { ascending: false });
      const { data: answersData } = await supabase.from('hs_checklist_answers').select('*');
      const { data: actionPlansData } = await supabase.from('hs_action_plans').select('inspection_id, title, description, resolution_notes, checklist_item_id');

      if (inspectionsData) {
        const formattedInspections = inspectionsData.map((i: any) => {
          const matchedObj = (objectsData || []).find((o: any) => o.id === i.object_id);
          const iAnswers = (answersData || []).filter((a: any) => a.inspection_id === i.id);

          return {
            id: i.id,
            objectId: i.object_id,
            objectName: matchedObj?.name || 'Activo',
            objectQrCode: matchedObj?.qr_code || '',
            sectorName: matchedObj?.sector_name || '',
            operatorDni: i.operator_dni || '',
            operatorName: i.operator_name || '',
            date: i.created_at ? new Date(i.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '',
            overallResult: (i.resulting_status || 'HABILITADO'),
            comments: i.comments || '',
            actionPlanGenerated: i.resulting_status === 'NO HABILITADO' || i.resulting_status === 'NO_CONFORME_CRITICA',
            answers: iAnswers.map((a: any) => {
              const matchedItem = (itemsData || []).find((it: any) => it.id === a.checklist_item_id);
              const label = matchedItem ? matchedItem.description : 'Ítem inspeccionado';
              const matchedPlan = (actionPlansData || []).find((ap: any) => ap.inspection_id === i.id && (ap.checklist_item_id === a.checklist_item_id || ap.title === label));

              return {
                checklistItemId: a.checklist_item_id,
                checklistItemLabel: label,
                status: (a.status === 'NA' ? 'N_A' : a.status) as HSChecklistAnswerStatus,
                observation: a.observation || '',
                actionPlan: matchedPlan ? (matchedPlan.resolution_notes || '') : '',
                isCriticalFinding: a.status === 'NO_OK'
              };
            })
          };
        });
        setInspections(formattedInspections);
      }

      // 6. Action Plans
      const { data: plansData } = await supabase.from('hs_action_plans').select('*').order('created_at', { ascending: false });
      if (plansData) {
        setActionPlans(plansData.map((p: any) => ({
          id: p.id,
          inspectionId: p.inspection_id,
          objectId: p.object_id,
          objectName: p.object_name || '',
          sectorName: p.sector_name || '',
          title: p.title || '',
          description: p.description || '',
          severity: p.severity || 'CRITICAL',
          assignedTo: p.assigned_to || '',
          dueDate: p.due_date || '',
          status: p.status || 'OPEN',
          resolutionNotes: p.resolution_notes,
          createdAt: p.created_at ? new Date(p.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '',
        })));
      }

    } catch (err) {
      console.error('[useHSModule] Error al consultar Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const enrichedObjects = useMemo<HSObject[]>(() => {
    return rawObjects.map(obj => {
      const type = objectTypes.find(t => t.id === obj.type || t.code === obj.type);
      const sector = sectors.find(s => s.id === obj.sector_id);

      const objInspections = inspections.filter(i => i.objectId === obj.id);
      const latestInspection = objInspections[0];

      let computedStatus: HSObjectStatus = 'PENDING';
      let lastInspectedAt: string | undefined = undefined;
      let lastInspectedBy: string | undefined = undefined;
      let observations: string | undefined = undefined;

      if (latestInspection) {
        const isOk = latestInspection.overallResult === 'HABILITADO' || latestInspection.overallResult === 'CONFORME';
        computedStatus = isOk ? 'OK' : 'NO_OK';
        lastInspectedAt = latestInspection.date.substring(0, 10);
        lastInspectedBy = latestInspection.operatorName;
        const failedAnswer = latestInspection.answers.find(a => a.status === 'NO_OK');
        observations = failedAnswer?.observation || latestInspection.comments;
      }

      let baseDate = Date.now();
      if (lastInspectedAt) {
        // lastInspectedAt está en formato DD/MM/YYYY debido a toLocaleString('es-AR')
        const parts = lastInspectedAt.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          baseDate = new Date(year, month, day).getTime();
        }
      }
      
      const activeModel = checklistModels.find(m => m.objectTypeId === obj.type && m.status === 'ACTIVE');
      const freqDays = activeModel?.inspectionFrequencyDays || type?.inspectionFrequencyDays || 30;

      const nextInspectionDue = new Date(baseDate + freqDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      return {
        id: obj.id,
        qrCode: obj.qr_code,
        name: obj.name,
        typeId: obj.type,
        typeName: type ? type.name : (obj.type || 'Desconocido'),
        sectorId: obj.sector_id,
        sectorName: obj.sector_name || sector?.name || 'Sin Sector',
        locationDetail: obj.location_detail || '',
        status: computedStatus,
        lastInspectedAt,
        lastInspectedBy,
        nextInspectionDue,
        notes: obj.notes || '',
        observations
      };
    });
  }, [rawObjects, objectTypes, sectors, inspections, checklistModels]);

  const selectedObject = useMemo(() => {
    if (!selectedObjectId) return null;
    return enrichedObjects.find(o => o.id === selectedObjectId) || null;
  }, [selectedObjectId, enrichedObjects]);

  const activeChecklistForSelectedObject = useMemo(() => {
    if (!selectedObject) return [];
    
    const filtered = checklistItems.filter(ci =>
      (ci.objectTypeId === selectedObject.typeId || ci.objectTypeId === selectedObject.typeName) &&
      ci.isEnabled
    );
    
    // Deduplicar por label y modelo
    const uniqueItems: HSChecklistItem[] = [];
    const seenKeys = new Set();
    
    for (const item of filtered) {
      const key = `${item.checklistModelId || 'no-model'}-${item.label.trim().toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    }
    
    return uniqueItems;
  }, [selectedObject, checklistItems]);

  const selectedObjectInspectionHistory = useMemo(() => {
    if (!selectedObject) return [];
    return inspections.filter(i => i.objectId === selectedObject.id);
  }, [selectedObject, inspections]);

  const selectObjectByQR = useCallback((qrCode: string) => {
    const found = enrichedObjects.find(o => o.qrCode.toUpperCase().trim() === qrCode.toUpperCase().trim());
    if (found) {
      setSelectedObjectId(found.id);
      return true;
    }
    return false;
  }, [enrichedObjects]);

  const submitInspection = useCallback(async (inspectionData: any) => {
    const supabase = getSupabase();
    const targetObj = enrichedObjects.find(o => o.id === inspectionData.objectId);
    if (!targetObj || !supabase) return null;

    const hasAnyNoOk = inspectionData.answers.some((a:any) => a.status === 'NO_OK');
    const overallResult = hasAnyNoOk ? 'NO_CONFORME_CRITICA' : 'CONFORME';

    try {
      const { data: insertedInsp, error: inspError } = await supabase
        .from('hs_inspections')
        .insert([{
          object_id: targetObj.id,
          operator_dni: inspectionData.operatorDni,
          operator_name: inspectionData.operatorName,
          resulting_status: overallResult,
          comments: inspectionData.comments || null
        }])
        .select()
        .single();

      if (inspError) return null;

      if (inspectionData.answers.length > 0) {
        const answersToInsert = inspectionData.answers.map((ans:any) => ({
          inspection_id: insertedInsp.id,
          checklist_item_id: ans.checklistItemId,
          status: ans.status === 'N_A' ? 'NA' : ans.status,
          observation: ans.observation || null
        }));
        await supabase.from('hs_checklist_answers').insert(answersToInsert);
      }

      if (hasAnyNoOk) {
        const sectorObj = sectors.find(s => s.id === targetObj.sectorId);
        const plansToInsert = inspectionData.answers.filter((a:any) => a.status === 'NO_OK').map((fail:any) => {
          const matchedItem = checklistItems.find(ci => ci.id === fail.checklistItemId);
          return {
            inspection_id: insertedInsp.id,
            object_id: targetObj.id,
            object_name: targetObj.name,
            sector_name: targetObj.sectorName || sectorObj?.name || 'Sin Sector',
            checklist_item_id: fail.checklistItemId,
            title: matchedItem?.label || `Hallazgo en inspección`,
            description: fail.observation,
            severity: fail.isCriticalFinding ? 'CRITICAL' : 'HIGH',
            status: 'OPEN',
            resolution_notes: fail.actionPlan || null,
            assigned_to: sectorObj?.responsiblePerson || 'Pendiente'
          };
        });
        await supabase.from('hs_action_plans').insert(plansToInsert);
      }

      await fetchAllData();
      return insertedInsp;
    } catch (e) {
      return null;
    }
  }, [enrichedObjects, sectors, fetchAllData]);

  // ABM Funciones
  const addOrUpdateObjectType = useCallback(async (item: Partial<HSObjectType>) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const payload = {
      name: item.name,
      code: item.code,
      description: item.description,
      inspection_frequency_days: item.inspectionFrequencyDays,
      icon_name: item.iconName || 'ShieldAlert'
    };

    // Si tiene ID y NO es uno de los hardcodeados generados manualmente por la app
    // O si lo es, lo actualizamos igual (Supabase lo manejará)
    if (item.id) {
      // update
      await supabase.from('hs_object_types').update(payload).eq('id', item.id);
    } else {
      // insert
      const idToInsert = item.code || `OT-${Math.floor(Math.random()*10000)}`;
      await supabase.from('hs_object_types').insert([{
        id: idToInsert,
        ...payload
      }]);
    }
    await fetchAllData();
  }, [fetchAllData]);

  const deleteObjectType = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('hs_object_types').delete().eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);
  
  const addOrUpdateSector = useCallback(async (item: Partial<HSSector>) => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (item.id && item.id.length > 10) {
      await supabase.from('sectors').update({ 
        name: item.name, 
        code: item.code || '', 
        responsible_person: item.responsiblePerson || null, 
        location_details: item.locationDetails || null 
      }).eq('id', item.id);
    } else {
      await supabase.from('sectors').insert([{ 
        name: item.name, 
        code: item.code || '', 
        responsible_person: item.responsiblePerson || null, 
        location_details: item.locationDetails || null 
      }]);
    }
    await fetchAllData();
  }, [fetchAllData]);

  const deleteSector = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('sectors').delete().eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);

  const addOrUpdateObject = useCallback(async (item: Partial<HSObject>) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const sector = sectors.find(s => s.id === item.sectorId);
    if (item.id && item.id.length > 10) {
      await supabase.from('hs_objects').update({
        name: item.name, 
        qr_code: item.qrCode, 
        type: item.typeId, 
        sector_id: item.sectorId, 
        sector_name: sector?.name,
        location_detail: item.locationDetail || null,
        notes: item.notes || null
      }).eq('id', item.id);
    } else {
      await supabase.from('hs_objects').insert([{
        qr_code: item.qrCode, 
        name: item.name, 
        type: item.typeId, 
        sector_id: item.sectorId, 
        sector_name: sector?.name,
        location_detail: item.locationDetail || null,
        notes: item.notes || null
      }]);
    }
    await fetchAllData();
  }, [sectors, fetchAllData]);

  const deleteObject = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('hs_objects').delete().eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);

  const migrateOrphanedItems = useCallback(async (modelId: string, objectTypeId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await supabase
        .from('hs_checklist_items')
        .update({ checklist_model_id: modelId })
        .eq('object_type', objectTypeId)
        .is('checklist_model_id', null);
      await fetchAllData();
    } catch (err) {
      console.error('[useHSModule] Error migrating items:', err);
    }
  }, [fetchAllData]);

  const toggleChecklistItem = useCallback((id: string, isEnabled: boolean) => {
    setChecklistItems(prev => prev.map(ci => ci.id === id ? { ...ci, isEnabled } : ci));
  }, []);

  const addChecklistModel = useCallback(async (item: Partial<HSChecklistModel>) => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (item.id && item.id.length > 10) {
      await supabase.from('hs_checklist_models').update({ 
        name: item.name, 
        status: item.status,
        inspection_frequency_days: item.inspectionFrequencyDays 
      }).eq('id', item.id);
    } else {
      await supabase.from('hs_checklist_models').insert([{ 
        object_type_id: item.objectTypeId, 
        name: item.name, 
        status: item.status || 'ACTIVE',
        inspection_frequency_days: item.inspectionFrequencyDays || 30
      }]);
    }
    await fetchAllData();
  }, [fetchAllData]);

  const deleteChecklistModel = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('hs_checklist_models').delete().eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);

  const addChecklistItem = useCallback(async (item: Partial<HSChecklistItem>) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const sameTypeCount = checklistItems.filter(ci => (item.checklistModelId ? ci.checklistModelId === item.checklistModelId : ci.objectTypeId === item.objectTypeId)).length;
    await supabase.from('hs_checklist_items').insert([{
      object_type: item.objectTypeId || 'EXT',
      checklist_model_id: item.checklistModelId || null,
      description: item.label || 'Nuevo Ítem',
      item_order: sameTypeCount + 1,
      is_critical: item.isCritical ?? false
    }]);
    await fetchAllData();
  }, [checklistItems, fetchAllData]);

  const deleteChecklistItem = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('hs_checklist_items').delete().eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);

  const updateActionPlanStatus = useCallback(async (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string, dueDate?: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (assignedTo !== undefined) updatePayload.assigned_to = assignedTo;
    if (notes !== undefined) updatePayload.resolution_notes = notes;
    if (dueDate !== undefined) updatePayload.due_date = dueDate;
    await supabase.from('hs_action_plans').update(updatePayload).eq('id', id);
    await fetchAllData();
  }, [fetchAllData]);

  return {
    objectTypes,
    sectors,
    objects: enrichedObjects,
    checklistModels,
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
    deleteObjectType,
    addOrUpdateSector,
    deleteSector,
    addOrUpdateObject,
    deleteObject,
    toggleChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    addChecklistModel,
    deleteChecklistModel,
    migrateOrphanedItems,
    updateActionPlanStatus,
    fetchAllData,
    isLoading
  };
}
