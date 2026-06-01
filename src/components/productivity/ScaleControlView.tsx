import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Plus, Trash2, Save, Scale, Calendar, FilterX } from 'lucide-react';
import { MasterData, ScaleControl, AppUser } from '../../types';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: ScaleControl) => void;
  onDelete: (id: string) => void;
  history: ScaleControl[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function ScaleControlView({ masters, currentUser, onSave, onDelete, history, selectedShiftId, selectedDate }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'SCALE');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  
  // Range for audits
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [formData, setFormData] = useState<Partial<ScaleControl>>({
    hac: '',
    weight1: 0,
    weight2: 0,
    weight3: 0,
    patternWeight: 50, // Default pattern weight
    observations: ''
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter HACS to only show Scales based on the new isScale flag
  const scaleHacs = masters.hacs.filter(h => h.isScale);

  // Filter history based on range or selectedDate
  const filteredHistory = useMemo(() => {
    if (dateFrom && dateTo) {
      try {
        const start = startOfDay(parseISO(dateFrom));
        const end = endOfDay(parseISO(dateTo));
        return history.filter(item => {
          const itemDate = parseISO(item.date);
          return isWithinInterval(itemDate, { start, end });
        });
      } catch (e) {
        return history;
      }
    }
    return history;
  }, [history, dateFrom, dateTo]);

  // Computed fields
  const computed = useMemo(() => {
    const p1 = Number(formData.weight1) || 0;
    const p2 = Number(formData.weight2) || 0;
    const p3 = Number(formData.weight3) || 0;
    const pPatron = Number(formData.patternWeight) || 0;

    const average = (p1 + p2 + p3) / 3;
    const bias = pPatron - average;
    const range = Math.max(p1, p2, p3) - Math.min(p1, p2, p3);

    return { average, bias, range };
  }, [formData.weight1, formData.weight2, formData.weight3, formData.patternWeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.hac) return;

    const report: ScaleControl = {
      id: editingId || `BAL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: selectedDate,
      userId: editingId ? (formData.userId || currentUser?.dni || '') : (currentUser?.dni || ''),
      userName: editingId ? (formData.userName || currentUser?.name || '') : (currentUser?.name || ''),
      shiftId: selectedShiftId || '',
      hac: formData.hac || '',
      weight1: Number(formData.weight1) || 0,
      weight2: Number(formData.weight2) || 0,
      weight3: Number(formData.weight3) || 0,
      patternWeight: Number(formData.patternWeight) || 0,
      average: computed.average,
      bias: computed.bias,
      range: computed.range,
      observations: formData.observations || ''
    };

    onSave(report);
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ weight1: 0, weight2: 0, weight3: 0, patternWeight: 50, observations: '' });
  };

  const columns: Column<ScaleControl>[] = [
    { header: 'Fecha', accessor: (row) => <span className="text-[10px] opacity-70">{format(parseISO(row.date), 'dd/MM/yyyy')}</span> },
    { header: 'HAC', accessor: (row) => <span className="font-bold text-primary">{row.hac}</span> },
    {
      header: 'Maquinista',
      accessor: (row) => (
        <div className="py-1">
          <div className="text-[11px] font-bold text-text-main">
            {row.userName || <span className="text-text-muted/80 italic">Sin registrar</span>}
          </div>
          {row.userId && (
            <div className="text-[9px] font-mono text-text-muted">
              DNI: {row.userId}
            </div>
          )}
        </div>
      )
    },
    { header: 'P1', accessor: (row) => row.weight1.toFixed(2) },
    { header: 'P2', accessor: (row) => row.weight2.toFixed(2) },
    { header: 'P3', accessor: (row) => row.weight3.toFixed(2) },
    { header: 'Patrón', accessor: (row) => row.patternWeight.toFixed(2) },
    { header: 'Media', accessor: (row) => <span className="font-bold">{row.average.toFixed(2)}</span> },
    { 
      header: 'Bias', 
      accessor: (row) => (
        <span className={cn(
          "font-mono font-bold",
          Math.abs(row.bias) > 0.5 ? "text-red-500" : "text-green-500"
        )}>
          {row.bias.toFixed(2)}
        </span>
      )
    },
    { header: 'Rango', accessor: (row) => row.range.toFixed(2) },
    { 
      header: 'Acciones', 
      align: 'right',
      accessor: (row) => canEdit ? (
        <TableActions 
          onEdit={() => {
            setFormData(row);
            setEditingId(row.id);
            setIsFormOpen(true);
          }}
          onDelete={() => setDeletingId(row.id)}
        />
      ) : (
        <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">Lectura</span>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Scale size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Control de Balanzas</h2>
            <p className="text-xs text-text-muted">Verificación de precisión y exactitud</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary shrink-0" />
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] xs:max-w-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
              <span className="text-[10px] text-text-muted font-bold">A</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] xs:max-w-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1 hover:text-danger ml-1 shrink-0">
                <FilterX size={14} />
               </button>
            )}
          </div>
          {!isFormOpen && canEdit && (
            <GlassButton onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="h-10 px-4 w-full sm:w-auto justify-center">
              <Plus size={18} /> <span className="inline ml-2">Nuevo Control</span>
            </GlassButton>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <GlassCard className="p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest">{editingId ? 'Editar' : 'Nuevo'} Control de Balanza</h3>
                <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-main transition-colors"><Plus className="rotate-45" size={20} /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <GlassSelect 
                    label="HAC (Balanza)" 
                    options={scaleHacs.map(h => ({ label: `${h.hac} - ${h.detail}`, value: h.hac }))}
                    value={formData.hac}
                    onChange={e => setFormData({...formData, hac: e.target.value})}
                    required
                  />
                  <GlassInput 
                    type="number" 
                    step="0.01"
                    label="Peso #1 (kg)" 
                    value={formData.weight1} 
                    onChange={e => setFormData({...formData, weight1: e.target.value})} 
                  />
                  <GlassInput 
                    type="number" 
                    step="0.01"
                    label="Peso #2 (kg)" 
                    value={formData.weight2} 
                    onChange={e => setFormData({...formData, weight2: e.target.value})} 
                  />
                  <GlassInput 
                    type="number" 
                    step="0.01"
                    label="Peso #3 (kg)" 
                    value={formData.weight3} 
                    onChange={e => setFormData({...formData, weight3: e.target.value})} 
                  />
                  <GlassInput 
                    type="number" 
                    step="0.01"
                    label="Peso Patrón (kg)" 
                    value={formData.patternWeight} 
                    onChange={e => setFormData({...formData, patternWeight: e.target.value})} 
                  />
                  
                  <div className="bg-bg/50 p-4 rounded-xl border border-border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Media (Promedio)</span>
                    <span className="text-xl font-mono font-bold text-primary">{computed.average.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-bg/50 p-4 rounded-xl border border-border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Bias (Error)</span>
                    <span className={cn("text-xl font-mono font-bold", Math.abs(computed.bias) > 0.5 ? "text-red-400" : "text-green-400")}>
                      {computed.bias.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-bg/50 p-4 rounded-xl border border-border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Rango (Dispersion)</span>
                    <span className="text-xl font-mono font-bold text-text-main">{computed.range.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <GlassInput 
                      label="Observaciones" 
                      value={formData.observations} 
                      onChange={e => setFormData({...formData, observations: e.target.value})} 
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                    <GlassButton variant="secondary" type="button" onClick={() => setIsFormOpen(false)} className="w-full sm:flex-1 h-10">Cancelar</GlassButton>
                    <GlassButton type="submit" className="w-full sm:flex-1 h-10">
                      <Save size={16} className="shrink-0" /> Guardar
                    </GlassButton>
                  </div>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassCard className="overflow-hidden border border-white/10 shadow-2xl">
        <DataTable data={filteredHistory} columns={columns} />
      </GlassCard>

      <ConfirmModal 
        isOpen={!!deletingId} 
        onClose={() => setDeletingId(null)} 
        onConfirm={() => { deletingId && onDelete(deletingId); setDeletingId(null); }}
        title="Eliminar Registro"
        message="¿Estás seguro de eliminar este control de balanza?"
      />
    </motion.div>
  );
}
