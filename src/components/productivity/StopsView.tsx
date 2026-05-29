import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Pencil, Trash2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { format, parse, differenceInMinutes, isBefore, isAfter, isEqual } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal, GlassSearchableSelect } from '../ui/GlassUI';
import ShiftTimeline from './ShiftTimeline';
import { MasterData, MachineStop, Shift, AppUser } from '../../types';
import { cn } from '../../lib/utils';
import { DataTable, Column, TableActions } from '../ui/DataTable';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (stop: MachineStop) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: MachineStop[];
}

function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  let strA = String(hacA).trim().toUpperCase();
  let strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  // 1. Direct match
  if (strA === strB) return true;

  // 2. Clear alphanumeric match
  const cleanA = strA.replace(/[^A-Z0-9]/g, '');
  const cleanB = strB.replace(/[^A-Z0-9]/g, '');
  if (cleanA === "" || cleanB === "") return false;
  if (cleanA === cleanB) return true;

  // 3. Bidirectional inclusion
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // 4. Prefix/mid comparison by removing "MG" or similar standard prefixes
  const looseA = cleanA.startsWith("MG") ? cleanA.slice(2) : cleanA;
  const looseB = cleanB.startsWith("MG") ? cleanB.slice(2) : cleanB;
  if (looseA === looseB || looseA.includes(looseB) || looseB.includes(looseA)) return true;

  // 5. Split and check numerical similarity (e.g., 672, 673, 674)
  const partsA = strA.split(/[\s.\-_/]+/).filter(Boolean);
  const partsB = strB.split(/[\s.\-_/]+/).filter(Boolean);

  const hasNumA = partsA.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  const hasNumB = partsB.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  
  if (hasNumA && hasNumB) {
    // Check if they share a specific suffix portion (like BT1, PZ1, AM1)
    const suffixA = partsA.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    const suffixB = partsB.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    if (suffixA && suffixB && (suffixA.includes(suffixB) || suffixB.includes(suffixA))) {
      return true;
    }
    // If one is just the group (e.g. 672) and the other is specific (e.g. 672-BT1)
    if (partsA.length === 1 || partsB.length === 1) {
      return true;
    }
  }

  return false;
}

export default function StopsView({ masters, currentUser, onSave, onDelete, palletizerId, shiftId, selectedDate, history }: Props) {
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

  const selectedShift = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId),
    [masters.shifts, shiftId]
  );

  const calculatedDuration = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return null;
    try {
      const start = parse(formData.startTime, 'HH:mm', new Date());
      const end = parse(formData.endTime, 'HH:mm', new Date());
      if (isBefore(end, start)) {
        return { text: "La hora de fin no puede ser menor a la hora de inicio", isError: true, mins: 0 };
      }
      const mins = differenceInMinutes(end, start);
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      let text = '';
      if (hrs > 0) {
        text = `${hrs} h ${remainingMins} min (${mins} min total)`;
      } else {
        text = `${mins} min`;
      }
      return { text, isError: false, mins };
    } catch {
      return null;
    }
  }, [formData.startTime, formData.endTime]);

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

  const validateTimes = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return true;
    const start = parse(startStr, 'HH:mm', new Date());
    const end = parse(endStr, 'HH:mm', new Date());
    return !isBefore(end, start);
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
    if (!validateTimes(formData.startTime, formData.endTime)) {
      setError("La hora de fin no puede ser menor que la hora de inicio.");
      return;
    }

    if(!formData.startTime || !formData.endTime || !formData.causeId || !formData.materialId || !palletizerId || !shiftId) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
    
    const start = parse(formData.startTime, 'HH:mm', new Date());
    let end = parse(formData.endTime, 'HH:mm', new Date());
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
    const machineHacText = machineName; // machineName directly determines 'máquina afectada' column
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
    // Find back the HAC ID (string name) from the masters using the stop.hacId (UUID)
    const hacObj = masters.hacs.find(h => h.id === stop.hacId);
    
    setFormData({
      materialId: stop.materialId,
      startTime: stop.startTime,
      endTime: stop.endTime || '',
      hacId: hacObj?.hac || '',
      causeId: stop.causeId,
      noticeText: stop.noticeText || '' 
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="layout-container py-8 space-y-10"
    >
      {/* Shift Timeline Visualization */}
      {selectedShift && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Clock size={16} />
              </div>
              <div>
                 <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Línea de Tiempo Operativa</h4>
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

        <form onSubmit={submit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tiempos y Material */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <GlassInput 
                   label="Hora Inicio" 
                   type="time" 
                   value={formData.startTime} 
                   onChange={e => setFormData({...formData, startTime: (e.target as HTMLInputElement).value})} 
                 />
                 <GlassInput 
                   label="Hora Fin" 
                   type="time" 
                   value={formData.endTime} 
                   onChange={e => setFormData({...formData, endTime: (e.target as HTMLInputElement).value})} 
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
                onChange={e => setFormData({ ...formData, materialId: (e.target as HTMLSelectElement).value })}
              />
            </div>

            {/* Clasificación (HAC/Causa) */}
            <div className="space-y-6">
              <GlassSearchableSelect 
                label="Equipo Afectado (HAC)" 
                options={masters.hacs
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
                    ].filter(Boolean).map(s => String(s).toLowerCase())
                  }))} 
                value={formData.hacId} 
                onChange={(e: any) => setFormData({...formData, hacId: e.target.value, causeId: ''})} 
              />
              <GlassSearchableSelect 
                label="Causa Específica" 
                options={(masters.causes || [])
                  .filter((c: any) => c && c.hac && formData.hacId && safeHacMatch(c.hac, formData.hacId))
                  .map((c: any) => ({ 
                    label: c.text || c.descripcion || '', 
                    value: c.id,
                    searchTags: [
                      c.text,
                      c.descripcion,
                      c.id,
                      c.partObject,
                    ].filter(Boolean).map(s => String(s).toLowerCase())
                  }))} 
                value={formData.causeId} 
                onChange={(e: any) => setFormData({...formData, causeId: e.target.value})} 
                disabled={!formData.hacId} 
                placeholder={!formData.hacId ? "Selecciona un equipo primero..." : "Buscar causa específica..."}
              />
            </div>

            {/* Información Adicional */}
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Texto Aviso (Opcional)</label>
                <textarea 
                  className="w-full bg-bg/50 border border-white/10 rounded-xl p-3 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[108px] transition-all"
                  placeholder="Describe brevemente la anomalía o el motivo del aviso..."
                  value={formData.noticeText}
                  onChange={e => setFormData({...formData, noticeText: e.target.value})}
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
