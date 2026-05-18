import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Plus, Trash2, Save, Printer } from 'lucide-react';
import { MasterData, DaterControl } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';

interface Props {
  masters: MasterData;
  onSave: (report: DaterControl) => void;
  onDelete: (id: string) => void;
  history: DaterControl[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function DaterControlView({ masters, onSave, onDelete, history, selectedShiftId, selectedDate }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<DaterControl>>({
    purge: 'SI',
    containerLevel: 'COMPLETO',
    printQuality: 'BUENO',
    inkStock: 0,
    solventStock: 0,
    headsStock: 0,
    observations: ''
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter HACS to only show Daters
  const daterHacs = masters.hacs.filter(h => 
    h.detail.toUpperCase().includes('FECHADOR') || 
    h.equipment.toUpperCase().includes('FECHADOR') ||
    h.detail.toUpperCase().includes('CODIFICADOR')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const report: DaterControl = {
      id: editingId || `CTRL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: selectedDate,
      userId: 'USER-1', // Emulated
      userName: 'Operador Holcim', // Emulated
      shiftId: selectedShiftId || '',
      hac: formData.hac || '',
      purge: formData.purge as 'SI' | 'NO',
      containerLevel: formData.containerLevel as any,
      printQuality: formData.printQuality as any,
      inkStock: Number(formData.inkStock),
      solventStock: Number(formData.solventStock),
      headsStock: Number(formData.headsStock),
      observations: formData.observations || ''
    };

    onSave(report);
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ purge: 'SI', containerLevel: 'COMPLETO', printQuality: 'BUENO', inkStock: 0, solventStock: 0, headsStock: 0, observations: '' });
  };

  const columns: Column<DaterControl>[] = [
    { header: 'HAC', accessor: (row) => <span className="font-bold text-primary">{row.hac}</span> },
    { header: 'Purga', accessor: (row) => <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", row.purge === 'SI' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>{row.purge}</span> },
    { header: 'Nivel', accessor: 'containerLevel' },
    { header: 'Calidad', accessor: 'printQuality' },
    { header: 'Stock (T/S/C)', accessor: (row) => <span className="font-mono text-[10px]">{row.inkStock}/{row.solventStock}/{row.headsStock}</span> },
    { 
      header: 'Acciones', 
      accessor: (row) => (
        <div className="flex gap-2">
          <button onClick={() => {
            setFormData(row);
            setEditingId(row.id);
            setIsFormOpen(true);
          }} className="p-1.5 text-text-muted hover:text-primary transition-colors">
            <ClipboardList size={14} />
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
            <Printer size={24} className="text-primary" />
            Control de Fechadores
          </h2>
          <p className="text-xs text-text-muted">Registro diario de estado y consumibles de equipos de codificado</p>
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
            <h3 className="text-sm font-bold uppercase tracking-widest">{editingId ? 'Editar' : 'Nuevo'} Control de Fechador</h3>
            <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-main"><Plus className="rotate-45" size={20} /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassSelect 
              label="HAC (Fechador)" 
              options={daterHacs.map(h => ({ label: `${h.hac} - ${h.detail}`, value: h.hac }))}
              value={formData.hac}
              onChange={e => setFormData({...formData, hac: e.target.value})}
              required
            />
            <GlassSelect 
              label="Purga" 
              options={[{label: 'SI', value: 'SI'}, {label: 'NO', value: 'NO'}]}
              value={formData.purge}
              onChange={e => setFormData({...formData, purge: e.target.value as any})}
            />
            <GlassSelect 
              label="Nivel Recipiente" 
              options={[{label: 'COMPLETO', value: 'COMPLETO'}, {label: 'MEDIO', value: 'MEDIO'}, {label: 'VACÍO', value: 'VACÍO'}]}
              value={formData.containerLevel}
              onChange={e => setFormData({...formData, containerLevel: e.target.value as any})}
            />
            <GlassSelect 
              label="Calidad Impresión" 
              options={[{label: 'BUENO', value: 'BUENO'}, {label: 'REGULAR', value: 'REGULAR'}, {label: 'DEFICIENTE', value: 'DEFICIENTE'}]}
              value={formData.printQuality}
              onChange={e => setFormData({...formData, printQuality: e.target.value as any})}
            />
            <GlassInput 
              type="number" 
              label="Stock Tinta" 
              value={formData.inkStock} 
              onChange={e => setFormData({...formData, inkStock: e.target.value})} 
            />
            <GlassInput 
              type="number" 
              label="Stock Solvente" 
              value={formData.solventStock} 
              onChange={e => setFormData({...formData, solventStock: e.target.value})} 
            />
            <GlassInput 
              type="number" 
              label="Stock Cabezales" 
              value={formData.headsStock} 
              onChange={e => setFormData({...formData, headsStock: e.target.value})} 
            />
            <div className="md:col-span-2">
              <GlassInput 
                label="Observaciones" 
                value={formData.observations} 
                onChange={e => setFormData({...formData, observations: e.target.value})} 
              />
            </div>
            <div className="flex items-end gap-3 md:col-span-1">
              <GlassButton variant="secondary" onClick={() => setIsFormOpen(false)} className="flex-1 h-10">Cancelar</GlassButton>
              <GlassButton type="submit" className="flex-1 h-10">
                <Save size={16} /> Guardar
              </GlassButton>
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
        message="¿Estás seguro de eliminar este control de fechador?"
      />
    </motion.div>
  );
}
