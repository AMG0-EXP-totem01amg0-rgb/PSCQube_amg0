import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Plus, Trash2, Save, Printer, Calendar, FilterX } from 'lucide-react';
import { MasterData, DaterControl, AppUser } from '../../types';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: DaterControl) => void;
  onDelete: (id: string) => void;
  history: DaterControl[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function DaterControlView({ masters, currentUser, onSave, onDelete, history, selectedShiftId, selectedDate }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    const perm = currentUser.permissions.find(p => p.viewId === 'DATER');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  
  // Date range for audits
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

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

  // Filter HACS to only show Daters based on the new isDater flag
  const daterHacs = masters.hacs.filter(h => h.isDater);

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
    { header: 'Fecha', accessor: (row) => <span className="text-[10px] opacity-70">{format(parseISO(row.date), 'dd/MM/yyyy')}</span> },
    { header: 'HAC', accessor: (row) => <span className="font-bold text-primary">{row.hac}</span> },
    { header: 'Purga', accessor: (row) => <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", row.purge === 'SI' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>{row.purge}</span> },
    { header: 'Nivel', accessor: 'containerLevel' },
    { header: 'Calidad', accessor: 'printQuality' },
    { 
      header: 'Stocks (T | S | C)', 
      align: 'center',
      accessor: (row) => (
        <div className="inline-flex flex-col items-center min-w-[90px] bg-bg/30 py-1 px-2 rounded-lg border border-white/5">
          <div className="grid grid-cols-3 w-full text-[8px] font-black text-text-muted border-b border-white/10 pb-1 mb-1">
             <div className="text-blue-400">T</div>
             <div className="text-cyan-400 border-x border-white/10">S</div>
             <div className="text-purple-400">C</div>
          </div>
          <div className="grid grid-cols-3 w-full font-mono text-[11px] leading-none">
             <div className={cn(row.inkStock < 2 ? "text-red-400 font-bold" : "text-text-main")}>{row.inkStock}</div>
             <div className={cn("border-x border-white/10 px-1", row.solventStock < 2 ? "text-red-400 font-bold" : "text-text-main")}>{row.solventStock}</div>
             <div className={cn(row.headsStock < 1 ? "text-red-400 font-bold" : "text-text-main")}>{row.headsStock}</div>
          </div>
        </div>
      )
    },
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
            <Printer size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Control de Fechadores</h2>
            <p className="text-xs text-text-muted">Registro diario de estado y consumibles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border">
            <Calendar size={14} className="text-primary" />
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-[10px] p-0 focus:ring-0 uppercase font-bold text-text-main"
              />
              <span className="text-[10px] text-text-muted">A</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                className="bg-transparent border-none text-[10px] p-0 focus:ring-0 uppercase font-bold text-text-main"
              />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1 hover:text-danger">
                  <FilterX size={14} />
                </button>
              )}
            </div>
          </div>
          {!isFormOpen && canEdit && (
            <GlassButton onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="h-10 px-4">
              <Plus size={18} /> <span className="hidden sm:inline ml-2">Nuevo Control</span>
            </GlassButton>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <GlassCard className="p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest">{editingId ? 'Editar' : 'Nuevo'} Control de Fechador</h3>
                <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-main transition-colors"><Plus className="rotate-45" size={20} /></button>
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
        message="¿Estás seguro de eliminar este control de fechador?"
      />
    </motion.div>
  );
}
