import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Plus, Trash2, Save, Printer, Calendar, FilterX, RefreshCcw, Droplet, Droplets, Cpu } from 'lucide-react';
import { MasterData, DaterControl, AppUser } from '../../../types';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { fetchTable } from '../../../lib/dataService';

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
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'DATER');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  
  // Date range for audits
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [localRangeHistory, setLocalRangeHistory] = useState<DaterControl[] | null>(null);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (dateFrom && dateTo) {
      let active = true;
      setIsRangeLoading(true);
      fetchTable("CONTROL_FECHADORV2", true, { dateFrom, dateTo }, "DaterControlView.range")
        .then(result => {
          if (active && result.success && result.data) {
            setLocalRangeHistory(result.data as DaterControl[]);
          }
        })
        .catch(err => {
          console.warn("Error loading range for dater controls:", err);
        })
        .finally(() => {
          if (active) {
            setIsRangeLoading(false);
          }
        });
      return () => {
        active = false;
      };
    } else {
      setLocalRangeHistory(null);
    }
  }, [dateFrom, dateTo, refreshTrigger]);

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

  // Filter history based on range or selectedDate and shift
  const filteredHistory = useMemo(() => {
    const baseList = localRangeHistory !== null ? localRangeHistory : history;
    if (dateFrom && dateTo) {
      try {
        const start = startOfDay(parseISO(dateFrom));
        const end = endOfDay(parseISO(dateTo));
        return baseList.filter(item => {
          if (!item) return false;
          const itemDate = parseISO(item.date);
          return isWithinInterval(itemDate, { start, end });
        });
      } catch (e) {
        return baseList;
      }
    }
    return baseList.filter(item => {
      if (!item) return false;
      const isSameDate = item.date === selectedDate;
      const isSameShift = !selectedShiftId || String(item.shiftId || '').trim().toUpperCase() === String(selectedShiftId).trim().toUpperCase();
      return isSameDate && isSameShift;
    });
  }, [history, localRangeHistory, dateFrom, dateTo, selectedDate, selectedShiftId]);

  // Find if there is any record in the current shift/date that has registered stock values
  const shiftStockRecord = useMemo(() => {
    if (!selectedShiftId) return null;
    return history.find(item => 
      item.date === selectedDate && 
      String(item.shiftId || '').trim().toUpperCase() === String(selectedShiftId).trim().toUpperCase() &&
      (Number(item.inkStock) > 0 || Number(item.solventStock) > 0 || Number(item.headsStock) > 0)
    );
  }, [history, selectedDate, selectedShiftId]);

  const showStockInputs = useMemo(() => {
    if (!shiftStockRecord) return true; // No stocks registered yet
    if (editingId === shiftStockRecord.id) return true; // Editing the record that registers the stocks
    return false; // Already registered by someone else in this shift
  }, [shiftStockRecord, editingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const report: DaterControl = {
      id: editingId || `CTRL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: editingId ? (formData.date || selectedDate) : selectedDate,
      userId: editingId ? (formData.userId || currentUser?.dni || '') : (currentUser?.dni || ''),
      userName: editingId ? (formData.userName || currentUser?.name || '') : (currentUser?.name || ''),
      shiftId: editingId ? (formData.shiftId || selectedShiftId || '') : (selectedShiftId || ''),
      hac: formData.hac || '',
      purge: formData.purge as 'SI' | 'NO',
      containerLevel: formData.containerLevel as any,
      printQuality: formData.printQuality as any,
      inkStock: showStockInputs ? Number(formData.inkStock || 0) : Number(shiftStockRecord?.inkStock || 0),
      solventStock: showStockInputs ? Number(formData.solventStock || 0) : Number(shiftStockRecord?.solventStock || 0),
      headsStock: showStockInputs ? Number(formData.headsStock || 0) : Number(shiftStockRecord?.headsStock || 0),
      observations: formData.observations || ''
    };

    onSave(report);
    if (localRangeHistory) {
      setLocalRangeHistory(prev => {
        if (!prev) return prev;
        const exists = prev.some(item => item.id === report.id);
        if (exists) {
          return prev.map(item => item.id === report.id ? report : item);
        } else {
          return [report, ...prev];
        }
      });
    }

    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ purge: 'SI', containerLevel: 'COMPLETO', printQuality: 'BUENO', inkStock: 0, solventStock: 0, headsStock: 0, observations: '' });
  };

  const columns: Column<DaterControl>[] = [
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              {isRangeLoading ? (
                <RefreshCcw size={14} className="text-primary animate-spin shrink-0" />
              ) : (
                (dateFrom && dateTo) ? (
                  <button 
                    onClick={() => setRefreshTrigger(p => p + 1)} 
                    title="Actualizar rango de datos" 
                    className="hover:text-primary transition-colors shrink-0 text-text-muted"
                  >
                    <RefreshCcw size={14} className="shrink-0" />
                  </button>
                ) : (
                  <Calendar size={14} className="text-primary shrink-0" />
                )
              )}
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

      {/* Turno Stock Totalizers */}
      {shiftStockRecord && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4 flex items-center justify-between border-l-4 border-l-blue-500 bg-blue-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-lg">
                <Droplet size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Stock Tinta</p>
                <p className="text-[11px] text-text-muted/80 font-medium">Controlado por {shiftStockRecord.userName || 'Maquinista'}</p>
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-blue-400">
              {shiftStockRecord.inkStock}
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center justify-between border-l-4 border-l-cyan-500 bg-cyan-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shadow-lg">
                <Droplets size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Stock Solvente</p>
                <p className="text-[11px] text-text-muted/80 font-medium">Controlado por {shiftStockRecord.userName || 'Maquinista'}</p>
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-cyan-400">
              {shiftStockRecord.solventStock}
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center justify-between border-l-4 border-l-purple-500 bg-purple-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-lg">
                <Cpu size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Stock Cabezales</p>
                <p className="text-[11px] text-text-muted/80 font-medium">Controlado por {shiftStockRecord.userName || 'Maquinista'}</p>
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-purple-400">
              {shiftStockRecord.headsStock}
            </div>
          </GlassCard>
        </div>
      )}

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
                  onChange={e => setFormData(prev => ({...prev, hac: e.target.value}))}
                  required
                />
                <GlassSelect 
                  label="Purga" 
                  options={[{label: 'SI', value: 'SI'}, {label: 'NO', value: 'NO'}]}
                  value={formData.purge}
                  onChange={e => setFormData(prev => ({...prev, purge: e.target.value as any}))}
                />
                <GlassSelect 
                  label="Nivel Recipiente" 
                  options={[{label: 'COMPLETO', value: 'COMPLETO'}, {label: 'MEDIO', value: 'MEDIO'}, {label: 'VACÍO', value: 'VACÍO'}]}
                  value={formData.containerLevel}
                  onChange={e => setFormData(prev => ({...prev, containerLevel: e.target.value as any}))}
                />
                <GlassSelect 
                  label="Calidad Impresión" 
                  options={[{label: 'BUENO', value: 'BUENO'}, {label: 'REGULAR', value: 'REGULAR'}, {label: 'DEFICIENTE', value: 'DEFICIENTE'}]}
                  value={formData.printQuality}
                  onChange={e => setFormData(prev => ({...prev, printQuality: e.target.value as any}))}
                />
                {showStockInputs ? (
                  <>
                    <GlassInput 
                      type="number" 
                      label="Stock Tinta" 
                      value={formData.inkStock} 
                      onChange={e => setFormData(prev => ({...prev, inkStock: e.target.value}))} 
                    />
                    <GlassInput 
                      type="number" 
                      label="Stock Solvente" 
                      value={formData.solventStock} 
                      onChange={e => setFormData(prev => ({...prev, solventStock: e.target.value}))} 
                    />
                    <GlassInput 
                      type="number" 
                      label="Stock Cabezales" 
                      value={formData.headsStock} 
                      onChange={e => setFormData(prev => ({...prev, headsStock: e.target.value}))} 
                    />
                  </>
                ) : (
                  <div className="md:col-span-3 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                        <Printer size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-main">Stocks ya registrados para este turno</p>
                        <p className="text-[11px] text-text-muted">
                          Fueron declarados por <span className="font-semibold text-primary">{shiftStockRecord?.userName}</span>. Se asociarán automáticamente a este control de línea.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs font-mono font-bold bg-bg/50 px-3 py-1.5 rounded-lg border border-white/5">
                      <span className="text-blue-400">Tinta: {shiftStockRecord?.inkStock}</span>
                      <span className="text-cyan-400">Solvente: {shiftStockRecord?.solventStock}</span>
                      <span className="text-purple-400">Cabezales: {shiftStockRecord?.headsStock}</span>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <GlassInput 
                    label="Observaciones" 
                    value={formData.observations} 
                    onChange={e => setFormData(prev => ({...prev, observations: e.target.value}))} 
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 md:col-span-1">
                  <GlassButton variant="secondary" type="button" onClick={() => setIsFormOpen(false)} className="w-full sm:flex-1 h-10">Cancelar</GlassButton>
                  <GlassButton type="submit" className="w-full sm:flex-1 h-10">
                    <Save size={16} className="shrink-0" /> Guardar
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
        onConfirm={() => { 
          if (deletingId) { 
            onDelete(deletingId); 
            if (localRangeHistory) {
              setLocalRangeHistory(prev => prev ? prev.filter(item => item.id !== deletingId) : null);
            }
          } 
          setDeletingId(null); 
        }}
        title="Eliminar Registro"
        message="¿Estás seguro de eliminar este control de fechador?"
      />
    </motion.div>
  );
}
