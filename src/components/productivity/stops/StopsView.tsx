import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Pencil, Trash2, XCircle, Clock, ShieldAlert, Download, FileSpreadsheet, Layers, Plus } from 'lucide-react';
import { format, parse, differenceInMinutes, isBefore, isAfter, isEqual } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal, GlassSearchableSelect, Modal } from '../../ui/GlassUI';
import { ShiftTimeline } from '../dashboard';
import { MasterData, MachineStop, Shift, AppUser } from '../../../types';
import { cn } from '../../../lib/utils';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import * as XLSX from 'xlsx';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (stop: MachineStop) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: MachineStop[];
  allStops?: MachineStop[];
  onSaveMultiple?: (stops: MachineStop[]) => void;
}

function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  const strA = String(hacA).trim().toUpperCase();
  const strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  return strA === strB;
}

export default function StopsView({ masters, currentUser, onSave, onDelete, palletizerId, shiftId, selectedDate, history, allStops, onSaveMultiple }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'PAROS');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  const [formData, setFormData] = useState({ 
    materialId: '', 
    startTime: '', 
    endTime: '', 
    hacId: '', 
    causeId: '',
    noticeText: ''
  });
  
  const [error, setError] = useState<string | null>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(selectedDate);
  const [exportEndDate, setExportEndDate] = useState(selectedDate);
  const [exportError, setExportError] = useState<string | null>(null);

  // States for Batching / Grouping Stops
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchMaterialId, setBatchMaterialId] = useState('');
  const [batchHacId, setBatchHacId] = useState('');
  const [batchCauseId, setBatchCauseId] = useState('');
  const [batchNoticeText, setBatchNoticeText] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);

  interface BatchStopItem {
    id: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }

  const [batchStopsList, setBatchStopsList] = useState<BatchStopItem[]>([]);
  const [newBatchStartTime, setNewBatchStartTime] = useState('');
  const [newBatchEndTime, setNewBatchEndTime] = useState('');
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);

  const canExport = useMemo(() => {
    return currentUser?.profile === 'Administrativo' || currentUser?.profile === 'Administrador';
  }, [currentUser]);

  const formatToSpanishDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }
    return dateStr;
  };

  const formatToHhMmSs = (timeStr: string): string => {
    if (!timeStr) return '';
    const cleaned = timeStr.trim();
    if (cleaned.match(/^\d{2}:\d{2}$/)) {
      return `${cleaned}:00`;
    }
    return cleaned;
  };

  const handleExportExcel = () => {
    setExportError(null);
    if (!exportStartDate || !exportEndDate) {
      setExportError("Por favor selecciona un rango de fechas.");
      return;
    }
    if (exportStartDate > exportEndDate) {
      setExportError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    const stopsSource = allStops || [];
    const filteredStops = stopsSource.filter(stop => {
      if (!stop || !stop.date) return false;
      return stop.date >= exportStartDate && stop.date <= exportEndDate;
    });

    if (filteredStops.length === 0) {
      setExportError("No se encontraron registros de paros para el rango de fechas seleccionado.");
      return;
    }

    const headers = [
      'TEXTO DE CAUSA',
      'PUESTO DE TRABAJO',
      'CENTRO',
      'USUARIO',
      'HAC',
      'EQUIPO',
      'FECHA',
      'INICIO',
      'FECHAFIN',
      'FIN',
      'MÁQUINA AFECTADA',
      'GPO.CÓD. OBJETO',
      'PARTE OBJETO',
      'GPO.CÓD. SINTOMA',
      'CÓD. SINTOMA',
      'TEXTO SÍNTOMA',
      'TEXTO DE CAUSA',
      'GPO.COD. CAUSA',
      'CÓDIGO CAUSA'
    ];

    const dataRows = filteredStops.map(stop => {
      const hacObj = masters.hacs.find(h => h.id === stop.hacId || h.hac === stop.hacId || h.hac === stop.hacName);
      const causeObj = masters.causes.find(c => c.id === stop.causeId || c.text === stop.causeText);

      const txtCausa = stop.causeText || causeObj?.text || '';
      const workCenter = stop.workCenter || 'OPEREXP';
      const center = stop.center || 'AMG0';
      const usuario = stop.user || '';
      const hacVal = stop.hacName || hacObj?.hac || '';
      const equipo = stop.equipment || hacObj?.equipment || '';
      const fecha = formatToSpanishDate(stop.date);
      const inicio = formatToHhMmSs(stop.startTime);
      const fechaFin = formatToSpanishDate(stop.finishDate || stop.date);
      const fin = formatToHhMmSs(stop.endTime || '');
      const maqAfectada = stop.machineHacText || stop.machineId || '';
      const gpoCodObjeto = stop.gpoCodObjeto || hacObj?.gpoCodObjeto || '';
      const parteObjeto = stop.partObject || causeObj?.partObject || '';
      const gpoCodSintoma = stop.symptomGroup || causeObj?.symptomGroup || '';
      const codSintoma = stop.symptomCode || causeObj?.symptomCode || '';
      const txtSintoma = stop.symptomText || '';
      const gpoCodCausa = stop.causeGroup || causeObj?.causeGroup || '';
      const codCausa = stop.causeCode || causeObj?.causeCode || '';

      return [
        txtCausa,
        workCenter,
        center,
        usuario,
        hacVal,
        equipo,
        fecha,
        inicio,
        fechaFin,
        fin,
        maqAfectada,
        gpoCodObjeto,
        parteObjeto,
        gpoCodSintoma,
        codSintoma,
        txtSintoma,
        txtCausa,
        gpoCodCausa,
        codCausa
      ];
    });

    const worksheetData = [headers, ...dataRows];
    
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paros");
    
    const startFormatted = exportStartDate.replace(/-/g, '');
    const endFormatted = exportEndDate.replace(/-/g, '');
    XLSX.writeFile(wb, `Reporte_Paros_${startFormatted}_${endFormatted}.xlsx`);

    setIsExportModalOpen(false);
  };

  const selectedShift = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId),
    [masters.shifts, shiftId]
  );

  const calculatedDuration = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return null;
    try {
      const start = parse(formData.startTime, 'HH:mm', new Date());
      let end = parse(formData.endTime, 'HH:mm', new Date());
      let crossedMidnight = false;
      if (formData.endTime <= formData.startTime) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        crossedMidnight = true;
      }
      const mins = differenceInMinutes(end, start);
      
      const shiftDurationMinutes = (selectedShift?.durationHours || 8) * 60;
      if (mins > shiftDurationMinutes) {
        return { 
          text: `La duración (${mins} min) no puede superar la duración del turno (${shiftDurationMinutes} min)`, 
          isError: true, 
          mins: 0 
        };
      }

      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      let text = '';
      if (crossedMidnight) {
        text += '(Cruza medianoche) ';
      }
      if (hrs > 0) {
        text += `${hrs} h ${remainingMins} min (${mins} min total)`;
      } else {
        text += `${mins} min`;
      }
      return { text, isError: false, mins };
    } catch {
      return null;
    }
  }, [formData.startTime, formData.endTime, selectedShift]);

  const isTimeInShift = (timeStr: string, shift: Shift) => {
    if (!timeStr) return true;
    const time = parse(timeStr, 'HH:mm', new Date());
    const start = parse(shift.startTime, 'HH:mm', new Date());
    const end = parse(shift.endTime, 'HH:mm', new Date());

    if (shift.startTime < shift.endTime) {
      return (isAfter(time, start) || isEqual(time, start)) && (isBefore(time, end) || isEqual(time, end));
    } else {
      // Midnight wrap
      return (isAfter(time, start) || isEqual(time, start)) || (isBefore(time, end) || isEqual(time, end));
    }
  };

  const validateTimes = (startStr: string, endStr: string, shift: Shift | null) => {
    if (!startStr || !endStr) return true;
    const start = parse(startStr, 'HH:mm', new Date());
    let end = parse(endStr, 'HH:mm', new Date());
    if (endStr <= startStr) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const duration = differenceInMinutes(end, start);
    if (duration <= 0) return false;

    const shiftDurationMinutes = (shift?.durationHours || 8) * 60;
    if (duration > shiftDurationMinutes) return false;

    return true;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedShift) {
      setError("No hay un turno seleccionado para contextualizar el reporte.");
      return;
    }

    // Shift Hour Validation
    if (!isTimeInShift(formData.startTime, selectedShift) || !isTimeInShift(formData.endTime, selectedShift)) {
      setError("El rango de tiempo debe estar dentro del horario del turno: " + selectedShift.startTime + " - " + selectedShift.endTime);
      return;
    }

    // Logic Validation
    if (!validateTimes(formData.startTime, formData.endTime, selectedShift)) {
      setError("La hora de fin no es válida o la duración excede la duración del turno.");
      return;
    }

    if(!formData.startTime || !formData.endTime || !formData.causeId || !formData.materialId || !palletizerId || !shiftId) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
    
    const start = parse(formData.startTime, 'HH:mm', new Date());
    let end = parse(formData.endTime, 'HH:mm', new Date());
    if (formData.endTime <= formData.startTime) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const duration = differenceInMinutes(end, start);

    // Lookups for technical fields
    const hacObj = masters.hacs.find(h => h && h.hac && safeHacMatch(h.hac, formData.hacId));
    const causeObj = masters.causes.find(c => c.id === formData.causeId);

    if (!hacObj || !causeObj) {
      setError("Error interno: No se encontró la referencia de HAC o Causa.");
      return;
    }

    const machineObj = masters.palletizers.find(p => p.id === palletizerId) || masters.baggers.find(b => b.id === palletizerId);
    const machineName = machineObj?.name || palletizerId || '';
    const machineHacText = machineObj?.hacId || machineName; // 'máquina afectada' column stores the machine's hac_id
    const shiftName = selectedShift?.name || '';

    onSave({
      id: editingId || `STP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: selectedDate,
      finishDate: selectedDate, // Igual a fecha de registro (FECHAFIN = FECHA)
      machineId: palletizerId || '', 
      machineName: machineName, // MÁQUINA AFECTADA es el nombre de la paletizadora creada en MAQUINAS
      machineHacText: machineHacText, // HAC o Nombre de la máquina afectada
      shiftId: shiftId || '',
      shiftName: shiftName, // TURNO de la carga del paro
      materialId: formData.materialId,
      startTime: formData.startTime,
      endTime: formData.endTime,
      durationMinutes: duration, // duración es la resta de FIN e INICIO
      
      // Lookups
      hacId: hacObj.id,
      hacName: hacObj.hac,
      hacDetail: hacObj.detail,
      equipment: hacObj.equipment,
      
      causeId: causeObj.id,
      causeText: causeObj.text, // TEXTO DE CAUSA es la causa del maestro
      noticeText: causeObj.text, // TEXTO AVISO es idem a TEXTO DE CAUSA
      symptomText: formData.noticeText, // TEXTO SÍNTOMA viene del campo TEXTO AVISO del formulario
      
      sapCause: causeObj.sapCause,
      causeGroup: causeObj.causeGroup,
      causeCode: causeObj.causeCode,
      stopType: causeObj.stopType,
      
      gpoCodObjeto: hacObj.gpoCodObjeto,
      partObject: causeObj.partObject,
      symptomGroup: causeObj.symptomGroup,
      symptomCode: causeObj.symptomCode,
      
      user: currentUser.sapUser, // usuario se toma de sapUser de la tabla USUARIO2
      userName: currentUser.name, 
      workCenter: 'OPEREXP', // puesto de trabajo OPEREXP
      center: 'AMG0' // Centro siempre AMG0
    });

    // Reset Form
    setFormData({ 
      materialId: formData.materialId, 
      startTime: formData.endTime,      
      endTime: '', 
      hacId: '', 
      causeId: '',
      noticeText: ''
    });
    setEditingId(null);
  };

  const handleEdit = (stop: MachineStop) => {
    setEditingId(stop.id);
    
    // Find back the HAC object from the masters using the stop.hacId or other fields in an ultra-robust way
    let hacObj = masters.hacs.find(h => h && h.id && stop.hacId && String(h.id).trim().toUpperCase() === String(stop.hacId).trim().toUpperCase());
    
    if (!hacObj) {
      hacObj = masters.hacs.find(h => h && h.hac && stop.hacId && String(h.hac).trim().toUpperCase() === String(stop.hacId).trim().toUpperCase());
    }
    
    if (!hacObj && (stop as any).hacName) {
      hacObj = masters.hacs.find(h => h && h.hac && (stop as any).hacName && String(h.hac).trim().toUpperCase() === String((stop as any).hacName).trim().toUpperCase());
    }
    
    // Fallback normalising special characters if no exact match (removes spaces, hyphens, and other symbols)
    if (!hacObj) {
      const cleanStopHacId = String(stop.hacId || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
      const cleanStopHacName = String((stop as any).hacName || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
      hacObj = masters.hacs.find(h => {
        if (!h || !h.hac) return false;
        const cleanH = String(h.hac).replace(/[^A-Z0-9]/g, "").toUpperCase();
        return cleanH === cleanStopHacId || cleanH === cleanStopHacName;
      });
    }

    // Find back the Cause object from the masters in an ultra-robust way
    let causeObj = masters.causes.find(c => c && c.id && stop.causeId && String(c.id).trim().toUpperCase() === String(stop.causeId).trim().toUpperCase());
    
    if (!causeObj) {
      causeObj = masters.causes.find(c => {
        if (!c) return false;
        const stopCauseText = String(stop.causeId || "").trim().toUpperCase();
        const cText = String(c.text || (c as any).descripcion || "").trim().toUpperCase();
        return cText === stopCauseText;
      });
    }

    if (!causeObj && (stop as any).causeText) {
      causeObj = masters.causes.find(c => {
        if (!c) return false;
        const stopCauseText = String((stop as any).causeText || "").trim().toUpperCase();
        const cText = String(c.text || (c as any).descripcion || "").trim().toUpperCase();
        return cText === stopCauseText;
      });
    }
    
    setFormData({
      materialId: stop.materialId,
      startTime: stop.startTime,
      endTime: stop.endTime || '',
      hacId: hacObj?.hac || stop.hacId || (stop as any).hacName || '',
      causeId: causeObj?.id || stop.causeId || '',
      noticeText: stop.symptomText || '' 
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentBatchItemDuration = useMemo(() => {
    if (!newBatchStartTime || !newBatchEndTime) return null;
    try {
      const start = parse(newBatchStartTime, 'HH:mm', new Date());
      let end = parse(newBatchEndTime, 'HH:mm', new Date());
      let crossedMidnight = false;
      if (newBatchEndTime <= newBatchStartTime) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        crossedMidnight = true;
      }
      const mins = differenceInMinutes(end, start);
      
      const shiftDurationMinutes = (selectedShift?.durationHours || 8) * 60;
      if (mins > shiftDurationMinutes) {
        return { 
          text: `La duración (${mins} min) no puede superar la duración del turno (${shiftDurationMinutes} min)`, 
          isError: true, 
          mins: 0 
        };
      }

      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      let text = '';
      if (crossedMidnight) {
        text += '(Cruza medianoche) ';
      }
      if (hrs > 0) {
        text += `${hrs} h ${remainingMins} min (${mins} min total)`;
      } else {
        text += `${mins} min`;
      }
      return { text, isError: false, mins };
    } catch {
      return null;
    }
  }, [newBatchStartTime, newBatchEndTime, selectedShift]);

  const addBatchStopItem = () => {
    setBatchError(null);
    if (!selectedShift) {
      setBatchError("No hay un turno seleccionado para contextualizar el reporte.");
      return;
    }
    if (!newBatchStartTime || !newBatchEndTime) {
      setBatchError("Por favor ingresa hora de inicio y fin.");
      return;
    }

    if (!isTimeInShift(newBatchStartTime, selectedShift) || !isTimeInShift(newBatchEndTime, selectedShift)) {
      setBatchError(`Las horas deben estar dentro del horario del turno: ${selectedShift.startTime} - ${selectedShift.endTime}`);
      return;
    }

    if (!validateTimes(newBatchStartTime, newBatchEndTime, selectedShift)) {
      setBatchError("La hora de fin no es válida o la duración excede la duración del turno.");
      return;
    }

    const start = parse(newBatchStartTime, 'HH:mm', new Date());
    let end = parse(newBatchEndTime, 'HH:mm', new Date());
    if (newBatchEndTime <= newBatchStartTime) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const mins = differenceInMinutes(end, start);

    if (editingBatchItemId) {
      setBatchStopsList(prev => prev.map(item => 
        item.id === editingBatchItemId 
          ? { ...item, startTime: newBatchStartTime, endTime: newBatchEndTime, durationMinutes: mins } 
          : item
      ));
      setEditingBatchItemId(null);
    } else {
      const newItem: BatchStopItem = {
        id: `TMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        startTime: newBatchStartTime,
        endTime: newBatchEndTime,
        durationMinutes: mins
      };
      setBatchStopsList(prev => [...prev, newItem].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }

    setNewBatchStartTime('');
    setNewBatchEndTime('');
  };

  const editBatchStopItem = (item: BatchStopItem) => {
    setEditingBatchItemId(item.id);
    setNewBatchStartTime(item.startTime);
    setNewBatchEndTime(item.endTime);
  };

  const cancelEditBatchStopItem = () => {
    setEditingBatchItemId(null);
    setNewBatchStartTime('');
    setNewBatchEndTime('');
  };

  const saveBatchStops = () => {
    setBatchError(null);
    if (!selectedShift) {
      setBatchError("No hay un turno seleccionado para contextualizar el reporte.");
      return;
    }
    if (!batchMaterialId || !batchHacId || !batchCauseId) {
      setBatchError("Por favor completa todos los campos comunes obligatorios.");
      return;
    }
    if (batchStopsList.length === 0) {
      setBatchError("Debes agregar al menos un paro al lote.");
      return;
    }

    // Lookups for technical fields
    const hacObj = masters.hacs.find(h => h && h.hac && safeHacMatch(h.hac, batchHacId));
    const causeObj = masters.causes.find(c => c.id === batchCauseId);

    if (!hacObj || !causeObj) {
      setBatchError("Error interno: No se encontró la referencia de HAC o Causa.");
      return;
    }

    const machineObj = masters.palletizers.find(p => p.id === palletizerId) || masters.baggers.find(b => b.id === palletizerId);
    const machineName = machineObj?.name || palletizerId || '';
    const machineHacText = machineObj?.hacId || machineName;
    const shiftName = selectedShift?.name || '';

    const newStops: MachineStop[] = batchStopsList.map(item => {
      return {
        id: `STP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        date: selectedDate,
        finishDate: selectedDate,
        machineId: palletizerId || '',
        machineName: machineName,
        machineHacText: machineHacText,
        shiftId: shiftId || '',
        shiftName: shiftName,
        materialId: batchMaterialId,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        
        hacId: hacObj.id,
        hacName: hacObj.hac,
        hacDetail: hacObj.detail,
        equipment: hacObj.equipment,
        
        causeId: causeObj.id,
        causeText: causeObj.text,
        noticeText: causeObj.text,
        symptomText: batchNoticeText || '',
        
        sapCause: causeObj.sapCause,
        causeGroup: causeObj.causeGroup,
        causeCode: causeObj.causeCode,
        stopType: causeObj.stopType,
        
        gpoCodObjeto: hacObj.gpoCodObjeto,
        partObject: causeObj.partObject,
        symptomGroup: causeObj.symptomGroup,
        symptomCode: causeObj.symptomCode,
        
        user: currentUser.sapUser,
        userName: currentUser.name,
        workCenter: 'OPEREXP',
        center: 'AMG0'
      };
    });

    if (onSaveMultiple) {
      onSaveMultiple(newStops);
    } else {
      newStops.forEach(s => onSave(s));
    }

    // Reset batch states and close modal
    setIsBatchModalOpen(false);
    setBatchMaterialId('');
    setBatchHacId('');
    setBatchCauseId('');
    setBatchStopsList([]);
    setNewBatchStartTime('');
    setNewBatchEndTime('');
    setEditingBatchItemId(null);
    setBatchNoticeText('');
    setBatchError(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="layout-container py-8 space-y-10"
    >
      {/* Top Actions Section (Export & Batch stops) */}
      {(canExport || canEdit) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {canExport && (
            <GlassCard className="p-6 h-full flex items-center">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="flex-1">
                  <h3 className="text-md font-bold text-text-main flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-primary" /> Exportar Datos de Paros
                  </h3>
                  <p className="text-xs text-text-muted mt-1">Descarga el historial de paros en formato Excel para un rango de fechas seleccionado.</p>
                </div>
                <GlassButton 
                  onClick={() => {
                    setExportStartDate(selectedDate);
                    setExportEndDate(selectedDate);
                    setExportError(null);
                    setIsExportModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-hover text-white gap-2 h-10 px-5 text-xs font-bold shrink-0 self-start sm:self-center uppercase tracking-wider"
                >
                  <Download size={14} /> Exportar
                </GlassButton>
              </div>
            </GlassCard>
          )}

          {canEdit && (
            <GlassCard className="p-6 h-full flex items-center">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="flex-1">
                  <h3 className="text-md font-bold text-text-main flex items-center gap-2">
                    <Layers size={18} className="text-primary" /> Agrupamiento de Paros
                  </h3>
                  <p className="text-xs text-text-muted mt-1">Registra múltiples micro-paros individuales con la misma causa y equipo en un solo paso.</p>
                </div>
                <GlassButton 
                  onClick={() => {
                    setBatchMaterialId(formData.materialId || (masters.materials?.filter((m: any) => m && m.isProductive === true)?.[0]?.id || ''));
                    setBatchHacId('');
                    setBatchCauseId('');
                    setBatchStopsList([]);
                    setNewBatchStartTime('');
                    setNewBatchEndTime('');
                    setEditingBatchItemId(null);
                    setBatchNoticeText('');
                    setBatchError(null);
                    setIsBatchModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-hover text-white gap-2 h-10 px-5 text-xs font-bold shrink-0 self-start sm:self-center uppercase tracking-wider"
                >
                  <Layers size={14} /> Cargar Lote
                </GlassButton>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Exportar Paros a Excel"
        className="max-w-md"
      >
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Fecha Inicio"
              type="date"
              value={exportStartDate}
              onChange={(e: any) => setExportStartDate(e.target.value)}
            />
            <GlassInput
              label="Fecha Fin"
              type="date"
              value={exportEndDate}
              onChange={(e: any) => setExportEndDate(e.target.value)}
            />
          </div>

          {exportError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <XCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-400 font-medium">{exportError}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <GlassButton
              variant="secondary"
              onClick={() => setIsExportModalOpen(false)}
              className="h-10 px-4 text-xs font-bold"
            >
              Cancelar
            </GlassButton>
            <GlassButton
              onClick={handleExportExcel}
              className="h-10 px-4 text-xs font-bold uppercase tracking-wider gap-2"
            >
              <Download size={14} /> Descargar Excel
            </GlassButton>
          </div>
        </div>
      </Modal>

      {/* Shift Timeline Visualization */}
      {selectedShift && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Clock size={16} />
              </div>
              <div>
                 <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Línea de Tiempo Operativa</h4>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-extrabold rounded-full bg-danger/10 text-danger border border-danger/20 leading-none">
                      {history?.length || 0} {(history?.length || 0) === 1 ? 'PARO' : 'PAROS'}
                    </span>
                 </div>
                 <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{selectedShift.name} ({selectedShift.startTime} - {selectedShift.endTime})</p>
              </div>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger" />
                  <span className="text-[8px] font-black text-text-muted uppercase">Interno</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                  <span className="text-[8px] font-black text-text-muted uppercase">Externo</span>
               </div>
            </div>
          </div>
          
          <ShiftTimeline 
            shift={selectedShift} 
            stops={history} 
            masters={masters} 
            onEdit={handleEdit} 
          />
        </div>
      )}

      {/* Form Section */}
      {canEdit ? (
        <GlassCard className="p-8 relative overflow-hidden">
        {editingId && (
          <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-sm" />
        )}
        
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              editingId ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"
            )}>
              {editingId ? <Pencil size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main tracking-tight">
                {editingId ? 'Editar Paro Registrado' : 'Reportar Nuevo Paro'}
              </h3>
              <p className="text-xs text-text-muted font-medium">Carga rápida para {masters.palletizers.find(p => p.id === palletizerId)?.name}.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingId && (
              <button 
                onClick={() => {
                  setEditingId(null);
                  setFormData({ materialId: '', startTime: '', endTime: '', hacId: '', causeId: '', noticeText: '' });
                }}
                className="text-[10px] font-bold text-primary uppercase hover:text-text-main transition-colors px-3 py-1 bg-primary/10 rounded-full border border-primary/20"
              >
                Cancelar Edición
              </button>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tiempos y Material */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <GlassInput 
                   label="Hora Inicio" 
                   type="time" 
                   value={formData.startTime} 
                   onChange={e => setFormData(prev => ({...prev, startTime: (e.target as HTMLInputElement).value}))} 
                 />
                 <GlassInput 
                   label="Hora Fin" 
                   type="time" 
                   value={formData.endTime} 
                   onChange={e => setFormData(prev => ({...prev, endTime: (e.target as HTMLInputElement).value}))} 
                 />
              </div>

              {calculatedDuration && (
                <div className={cn(
                  "p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2",
                  calculatedDuration.isError 
                    ? "bg-red-500/10 border-red-500/20 text-red-400" 
                    : "bg-primary/10 border-primary/20 text-primary animate-fade-in"
                )}>
                  <Clock size={14} className={calculatedDuration.isError ? "text-red-400 shrink-0" : "text-primary shrink-0"} />
                  <span>
                    Duración: <strong className="font-extrabold">{calculatedDuration.text}</strong>
                  </span>
                </div>
              )}

              <GlassSelect 
                label="Material en Línea" 
                options={(masters.materials || [])
                  .filter((m: any) => m && m.isProductive === true)
                  .map((m: any) => ({ label: m.name || m.nombre, value: m.id }))}
                value={formData.materialId}
                onChange={e => setFormData(prev => ({ ...prev, materialId: (e.target as HTMLSelectElement).value }))}
              />
            </div>

            {/* Clasificación (HAC/Causa) */}
            <div className="space-y-6">
              {(() => {
                const filteredHacs = (masters.hacs || [])
                  .filter((h: any) => h && h.hac)
                  .map((h: any) => ({
                    label: `${h.hac || ''} - ${h.detail || ''} ${h.equipment ? `(${h.equipment})` : ''}`, 
                    value: h.hac || '',
                    searchTags: [
                      h.hac,
                      h.detail,
                      h.equipment,
                      h.id,
                      h.gpoCodObjeto,
                    ].filter(Boolean).map((s: any) => String(s).toLowerCase())
                  }));

                if (formData.hacId) {
                  const exists = filteredHacs.some(opt => String(opt.value).trim().toUpperCase() === String(formData.hacId).trim().toUpperCase());
                  if (!exists) {
                    const matchedHac = (masters.hacs || []).find(h => 
                      String(h.id).trim().toUpperCase() === String(formData.hacId).trim().toUpperCase() ||
                      String(h.hac).trim().toUpperCase() === String(formData.hacId).trim().toUpperCase()
                    );
                    const label = matchedHac 
                      ? `${matchedHac.hac || ''} - ${matchedHac.detail || ''} ${matchedHac.equipment ? `(${matchedHac.equipment})` : ''}`
                      : String(formData.hacId);
                    filteredHacs.unshift({
                      label: label,
                      value: formData.hacId,
                      searchTags: [label.toLowerCase()]
                    });
                  }
                }

                return (
                  <GlassSearchableSelect 
                    label="Equipo Afectado (HAC)" 
                    options={filteredHacs}
                    value={formData.hacId} 
                    onChange={(e: any) => setFormData(prev => ({...prev, hacId: e.target.value, causeId: ''}))} 
                  />
                );
              })()}

              {(() => {
                const filteredOptions = (masters.causes || [])
                  .filter((c: any) => {
                    const isSelected = formData.causeId && (
                      String(c.id).trim().toUpperCase() === String(formData.causeId).trim().toUpperCase() ||
                      String(c.text || '').trim().toUpperCase() === String(formData.causeId).trim().toUpperCase() ||
                      String((c as any).descripcion || '').trim().toUpperCase() === String(formData.causeId).trim().toUpperCase()
                    );
                    if (isSelected) return true;
                    return c && c.hac && formData.hacId && safeHacMatch(c.hac, formData.hacId);
                  })
                  .map((c: any) => ({ 
                    label: c.text || c.descripcion || '', 
                    value: c.id,
                    searchTags: [
                      c.text,
                      c.descripcion,
                      c.id,
                      c.partObject,
                    ].filter(Boolean).map((s: any) => String(s).toLowerCase())
                  }));

                if (formData.causeId) {
                  const exists = filteredOptions.some(opt => String(opt.value).trim().toUpperCase() === String(formData.causeId).trim().toUpperCase());
                  if (!exists) {
                    const matchedCause = (masters.causes || []).find(c => 
                      String(c.id).trim().toUpperCase() === String(formData.causeId).trim().toUpperCase() ||
                      String(c.text || '').trim().toUpperCase() === String(formData.causeId).trim().toUpperCase()
                    );
                    const label = matchedCause ? (matchedCause.text || (matchedCause as any).descripcion) : String(formData.causeId);
                    filteredOptions.unshift({
                      label: label,
                      value: formData.causeId,
                      searchTags: [label.toLowerCase()]
                    });
                  }
                }

                return (
                  <GlassSearchableSelect 
                    label="Causa Específica" 
                    options={filteredOptions} 
                    value={formData.causeId} 
                    onChange={(e: any) => setFormData(prev => ({...prev, causeId: e.target.value}))} 
                    disabled={!formData.hacId} 
                    placeholder={!formData.hacId ? "Selecciona un equipo primero..." : "Buscar causa específica..."}
                  />
                );
              })()}
            </div>

            {/* Información Adicional */}
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Texto Aviso (Opcional)</label>
                <textarea 
                  className="w-full bg-bg/50 border border-white/10 rounded-xl p-3 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[108px] transition-all"
                  placeholder="Describe brevemente la anomalía o el motivo del aviso..."
                  value={formData.noticeText}
                  onChange={e => setFormData(prev => ({...prev, noticeText: e.target.value}))}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 pt-4 border-t border-border/50">
            <div className="flex-1">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 shadow-lg"
                >
                  <XCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-[10px] font-bold text-red-400 uppercase leading-tight">{error}</p>
                </motion.div>
              )}
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              {editingId && (
                <button
                  type="button"
                  onClick={() => setDeletingId(editingId)}
                  className="w-14 h-12 flex items-center justify-center rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all border border-danger/20"
                  title="Eliminar registro"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <GlassButton type="submit" className="flex-1 md:w-64 h-12 text-sm font-bold tracking-wide">
                {editingId ? 'GUARDAR CAMBIOS' : 'REPORTAR PARO'}
              </GlassButton>
            </div>
          </div>
        </form>
      </GlassCard>
      ) : (
        <div className="bg-surface/30 p-8 rounded-3xl border border-border/50 text-center flex flex-col items-center justify-center gap-4">
           <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-text-muted">
              <ShieldAlert size={32} className="opacity-20" />
           </div>
           <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-[0.2em] mb-1">Modo de Consulta</p>
              <p className="text-xs text-text-muted/60">No tienes permisos para reportar o modificar paros en esta línea.</p>
           </div>
        </div>
      )}

      {/* Batch / Grouping Stops Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="Agrupamiento de Paros (Carga por Lote)"
        className="max-w-3xl"
      >
        <div className="space-y-6 pt-2">
          <p className="text-xs text-text-muted">
            Registra múltiples micro-paros individuales con la misma causa y equipo en un solo paso. Ingresa los datos comunes del lote, luego define la hora de inicio y fin para cada paro individual.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <GlassSelect 
              label="Material en Línea *" 
              options={(masters.materials || [])
                .filter((m: any) => m && m.isProductive === true)
                .map((m: any) => ({ label: m.name || m.nombre, value: m.id }))}
              value={batchMaterialId}
              onChange={e => setBatchMaterialId((e.target as HTMLSelectElement).value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              {/* HAC Select */}
              {(() => {
                const filteredHacs = (masters.hacs || [])
                  .filter((h: any) => h && h.hac)
                  .map((h: any) => ({
                    label: `${h.hac || ''} - ${h.detail || ''} ${h.equipment ? `(${h.equipment})` : ''}`, 
                    value: h.hac || '',
                    searchTags: [
                      h.hac,
                      h.detail,
                      h.equipment,
                      h.id,
                      h.gpoCodObjeto,
                    ].filter(Boolean).map((s: any) => String(s).toLowerCase())
                  }));

                return (
                  <GlassSearchableSelect 
                    label="Equipo Afectado (HAC) *" 
                    options={filteredHacs}
                    value={batchHacId} 
                    onChange={(e: any) => {
                      setBatchHacId(e.target.value);
                      setBatchCauseId('');
                    }} 
                  />
                );
              })()}
            </div>

            <div className="space-y-1">
              {/* Cause Select */}
              {(() => {
                const filteredOptions = (masters.causes || [])
                  .filter((c: any) => {
                    const isSelected = batchCauseId && (
                      String(c.id).trim().toUpperCase() === String(batchCauseId).trim().toUpperCase() ||
                      String(c.text || '').trim().toUpperCase() === String(batchCauseId).trim().toUpperCase() ||
                      String((c as any).descripcion || '').trim().toUpperCase() === String(batchCauseId).trim().toUpperCase()
                    );
                    if (isSelected) return true;
                    return c && c.hac && batchHacId && safeHacMatch(c.hac, batchHacId);
                  })
                  .map((c: any) => ({ 
                    label: c.text || c.descripcion || '', 
                    value: c.id,
                    searchTags: [
                      c.text,
                      c.descripcion,
                      c.id,
                      c.partObject,
                    ].filter(Boolean).map((s: any) => String(s).toLowerCase())
                  }));

                return (
                  <GlassSearchableSelect 
                    label="Causa Específica *" 
                    options={filteredOptions} 
                    value={batchCauseId} 
                    onChange={(e: any) => setBatchCauseId(e.target.value)} 
                    disabled={!batchHacId} 
                    placeholder={!batchHacId ? "Selecciona un equipo primero..." : "Buscar causa específica..."}
                  />
                );
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">Texto Aviso (Opcional)</label>
            <textarea 
              className="w-full bg-bg/50 border border-white/10 rounded-xl p-3 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[64px] transition-all"
              placeholder="Describe brevemente la anomalía para este lote..."
              value={batchNoticeText}
              onChange={e => setBatchNoticeText(e.target.value)}
            ></textarea>
          </div>

          {/* Add / Edit Stops in Batch Section */}
          <div className="space-y-4 pt-4 border-t border-white/10 bg-white/5 p-4 rounded-2xl border border-white/5">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider flex justify-between items-center">
              <span>{editingBatchItemId ? 'Editar Paro Seleccionado' : 'Registrar Nuevo Paro'}</span>
              {editingBatchItemId && (
                <button
                  type="button"
                  onClick={cancelEditBatchStopItem}
                  className="text-[10px] text-primary hover:underline font-bold uppercase tracking-widest"
                >
                  Cancelar Edición
                </button>
              )}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassInput 
                label="Hora Inicio *" 
                type="time" 
                value={newBatchStartTime} 
                onChange={e => setNewBatchStartTime((e.target as HTMLInputElement).value)}
              />
              <GlassInput 
                label="Hora Fin *" 
                type="time" 
                value={newBatchEndTime} 
                onChange={e => setNewBatchEndTime((e.target as HTMLInputElement).value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBatchStopItem();
                  }
                }}
              />
            </div>

            {currentBatchItemDuration && (
              <div className="flex justify-between items-center bg-bg/50 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Duración Calculada:</span>
                <span className={cn(
                  "text-xs font-bold font-mono",
                  currentBatchItemDuration.isError ? "text-danger" : "text-primary"
                )}>
                  {currentBatchItemDuration.text}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <GlassButton 
                type="button" 
                onClick={addBatchStopItem}
                className="h-10 px-5 text-xs font-bold uppercase tracking-wider gap-1.5 bg-primary text-white hover:bg-primary-hover shadow-lg"
              >
                <Plus size={14} /> {editingBatchItemId ? 'Actualizar Paro' : 'Agregar al Lote'}
              </GlassButton>
            </div>
          </div>

          {/* List Table of Added Stops in Batch */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
              Paros en el Lote ({batchStopsList.length})
            </h4>
            <div className="border border-white/10 rounded-xl bg-bg/30 max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-xs text-text-muted">
                <thead className="border-b border-white/15 bg-white/5 font-bold uppercase tracking-wider text-[10px] text-text-muted">
                  <tr>
                    <th className="p-3 pl-4">#</th>
                    <th className="p-3">Hora Inicio</th>
                    <th className="p-3">Hora Fin</th>
                    <th className="p-3">Duración</th>
                    <th className="p-3 text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono">
                  {batchStopsList.map((item, idx) => (
                    <tr 
                      key={item.id} 
                      className={cn(
                        "hover:bg-white/5 transition-colors",
                        editingBatchItemId === item.id && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <td className="p-3 pl-4 text-text-muted/75">{idx + 1}</td>
                      <td className="p-3 text-text-main font-bold">{item.startTime}</td>
                      <td className="p-3 text-text-main font-bold">{item.endTime}</td>
                      <td className="p-3 text-primary font-bold">{item.durationMinutes} min</td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editBatchStopItem(item)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-white/5 rounded-lg transition-all"
                            title="Editar paro"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingBatchItemId === item.id) {
                                cancelEditBatchStopItem();
                              }
                              setBatchStopsList(prev => prev.filter(x => x.id !== item.id));
                            }}
                            className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-all"
                            title="Remover paro"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {batchStopsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-text-muted/60 font-medium font-sans">
                        No se han agregado paros al lote todavía. Ingresá horas arriba y hacé clic en "Agregar al Lote".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {batchError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <XCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-400 font-medium">{batchError}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <GlassButton
              variant="secondary"
              onClick={() => setIsBatchModalOpen(false)}
              className="h-10 px-4 text-xs font-bold"
            >
              Cancelar
            </GlassButton>
            <GlassButton
              onClick={saveBatchStops}
              className="h-10 px-6 text-xs font-bold uppercase tracking-wider gap-2 bg-primary text-white hover:bg-primary-hover"
            >
              GUARDAR LOTE ({batchStopsList.length})
            </GlassButton>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) {
            onDelete(deletingId);
            setDeletingId(null);
            if (deletingId === editingId) {
              setEditingId(null);
              setFormData({ materialId: '', startTime: '', endTime: '', hacId: '', causeId: '', noticeText: '' });
            }
          }
        }}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro de paro?"
      />
    </motion.div>
  );
}
