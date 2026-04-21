import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Pencil, Trash2, XCircle, Clock } from 'lucide-react';
import { format, parse, differenceInMinutes, isBefore, isAfter, isEqual } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal } from '../ui/GlassUI';
import ShiftTimeline from './ShiftTimeline';
import { MasterData, MachineStop, Shift } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  masters: MasterData;
  onSave: (stop: MachineStop) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: MachineStop[];
}

export default function StopsView({ masters, onSave, onDelete, palletizerId, shiftId, selectedDate, history }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    materialId: '', 
    startTime: '', 
    endTime: '', 
    hacId: '', 
    causeId: '',
    observations: ''
  });
  
  const [error, setError] = useState<string | null>(null);

  const selectedShift = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId),
    [masters.shifts, shiftId]
  );

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

    onSave({
      id: editingId || Math.random().toString(),
      date: selectedDate,
      machineId: palletizerId, 
      shiftId: shiftId,
      materialId: formData.materialId,
      startTime: formData.startTime,
      endTime: formData.endTime,
      durationMinutes: duration,
      hacId: formData.hacId,
      causeId: formData.causeId,
      user: 'Operario', 
      workCenter: 'WC1', 
      center: 'C1'
    });

    // Reset Form
    setFormData({ 
      materialId: formData.materialId, 
      startTime: formData.endTime,      
      endTime: '', 
      hacId: '', 
      causeId: '',
      observations: ''
    });
    setEditingId(null);
  };

  const handleEdit = (stop: MachineStop) => {
    setEditingId(stop.id);
    setFormData({
      materialId: stop.materialId,
      startTime: stop.startTime,
      endTime: stop.endTime || '',
      hacId: stop.hacId,
      causeId: stop.causeId,
      observations: '' 
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
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <span className="text-[8px] font-black text-text-muted uppercase">Interno</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-text-muted/40" />
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
                setFormData({ materialId: '', startTime: '', endTime: '', hacId: '', causeId: '', observations: '' });
              }}
              className="text-[10px] font-bold text-primary uppercase hover:text-text-main transition-colors px-3 py-1 bg-primary/10 rounded-full border border-primary/20"
            >
              Cancelar Edición
            </button>
          )}
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6">
          <div className="lg:col-span-4 space-y-6">
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
            <GlassSelect 
              label="Material en Línea" 
              options={masters.materials.map(m => ({ label: m.name, value: m.id }))}
              value={formData.materialId}
              onChange={e => setFormData({ ...formData, materialId: (e.target as HTMLSelectElement).value })}
            />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <GlassSelect 
              label="Equipo Afectado (HAC)" 
              options={masters.hacs.map((h:any) => ({label: h.detail, value: h.id}))} 
              value={formData.hacId} 
              onChange={e => setFormData({...formData, hacId: (e.target as HTMLSelectElement).value, causeId: ''})} 
            />
            <GlassSelect 
              label="Causa Específica" 
              options={masters.causes.filter((c:any) => c.hacId === formData.hacId).map((c:any) => ({label: c.text, value: c.id}))} 
              value={formData.causeId} 
              onChange={e => setFormData({...formData, causeId: (e.target as HTMLSelectElement).value})} 
              disabled={!formData.hacId} 
            />
          </div>

          <div className="lg:col-span-4 flex flex-col justify-end gap-6 pb-1">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 shadow-lg"
              >
                <XCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-[10px] font-bold text-red-400 uppercase leading-tight">{error}</p>
              </motion.div>
            )}
            <GlassButton type="submit" className="w-full h-12 text-sm">
              {editingId ? 'Actualizar Registro' : 'Agregar Paro a Tabla'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>

      <ConfirmModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && onDelete(deletingId)}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro? Esta acción no se puede deshacer."
      />
    </motion.div>
  );
}
