import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Activity, Plus, Trash2, Save, Scale } from 'lucide-react';
import { MasterData, ScaleControl } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';

interface Props {
  masters: MasterData;
  onSave: (report: ScaleControl) => void;
  onDelete: (id: string) => void;
  history: ScaleControl[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function ScaleControlView({ masters, onSave, onDelete, history, selectedShiftId, selectedDate }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ScaleControl>>({
    hac: '',
    weight1: 0,
    weight2: 0,
    weight3: 0,
    patternWeight: 50, // Default pattern weight
    observations: ''
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter HACS to only show Scales
  const scaleHacs = masters.hacs.filter(h => 
    h.detail.toUpperCase().includes('BALANZA') || 
    h.equipment.toUpperCase().includes('BALANZA') ||
    h.detail.toUpperCase().includes('BASCULA')
  );

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
      userId: 'USER-1', // Emulated
      userName: 'Operador Holcim', // Emulated
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
    { header: 'HAC', accessor: (row) => <span className="font-bold text-primary">{row.hac}</span> },
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
      accessor: (row) => (
        <div className="flex gap-2">
          <button onClick={() => {
            setFormData(row);
            setEditingId(row.id);
            setIsFormOpen(true);
          }} className="p-1.5 text-text-muted hover:text-primary transition-colors">
            <Activity size={14} />
          </button>
          <button onClick={() => setDeletingId(row.id)} className="p-1.5 text-text-muted hover:text-danger transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Scale size={24} className="text-primary" />
            Control de Balanzas
          </h2>
          <p className="text-xs text-text-muted">Verificación de precisión, media, bias y rango de las balanzas de ensacado</p>
        </div>
        {!isFormOpen && (
          <GlassButton onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="h-11">
            <Plus size={18} /> Nuevo Control
          </GlassButton>
        )}
      </div>

      {isFormOpen && (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest">{editingId ? 'Editar' : 'Nuevo'} Control de Balanza</h3>
            <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-main"><Plus className="rotate-45" size={20} /></button>
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
              <div className="flex items-end gap-3">
                <GlassButton variant="secondary" onClick={() => setIsFormOpen(false)} className="flex-1 h-10">Cancelar</GlassButton>
                <GlassButton type="submit" className="flex-1 h-10">
                  <Save size={16} /> Guardar
                </GlassButton>
              </div>
            </div>
          </form>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <DataTable data={history} columns={columns} />
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
