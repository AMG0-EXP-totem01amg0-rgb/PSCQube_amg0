import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Search, History, Plus, Save, Trash2, Edit2, Check, AlertCircle, Package, Layers } from 'lucide-react';
import { MasterData, AppUser, DispatchEntry, Material } from '../../../types';
import { cn } from '../../../lib/utils';
import { GlassCard, GlassInput, GlassButton } from '../../ui/GlassUI';
import { format } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  history: DispatchEntry[];
  onSave: (entry: DispatchEntry) => void;
  onDelete: (id: string) => void;
  selectedShiftId: string;
  selectedDate: string;
}

export default function DespachosView({ masters, currentUser, history, onSave, onDelete, selectedShiftId, selectedDate }: Props) {
  const [activeTab, setActiveTab] = useState<'FORM' | 'HISTORY'>('FORM');
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState(false);
  
  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'DESPACHOS');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  // Weights for the form
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  const materials = useMemo(() => masters?.materials || [], [masters?.materials]);
  const shifts = useMemo(() => masters?.shifts || [], [masters?.shifts]);
  const safeHistory = useMemo(() => Array.isArray(history) ? history.filter(Boolean) : [], [history]);

  const productiveMaterials = useMemo(() => 
    materials.filter(m => m && m.isDispatch === true),
    [materials]
  );

  const filteredMaterials = useMemo(() => 
    productiveMaterials.filter(m => 
      (m.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (m.code || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    ),
    [productiveMaterials, searchTerm]
  );

  // Totalizers calculation (Granel vs Bolsa vs Total)
  const totals = useMemo(() => {
    let bulkTons = 0;
    let bagTons = 0;

    safeHistory.forEach(entry => {
      if (!entry) return;
      const mat = materials.find(m => m.id === entry.materialId);
      const tons = Number(entry.tons) || 0;
      if (mat?.isBulk) {
        bulkTons += tons;
      } else {
        bagTons += tons;
      }
    });

    return {
      bulk: bulkTons,
      bag: bagTons,
      total: bulkTons + bagTons
    };
  }, [safeHistory, materials]);

  const handleSaveAll = () => {
    const now = new Date().toISOString();
    
    (Object.entries(weights) as [string, string][]).forEach(([materialId, weightStr]) => {
      const tons = parseFloat(weightStr);
      if (isNaN(tons) || tons <= 0) return;

      const entry: DispatchEntry = {
        id: `D-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        date: selectedDate,
        shiftId: selectedShiftId,
        materialId,
        tons,
        userId: currentUser?.dni || '',
        userName: currentUser?.name || 'Sistema',
        timestamp: now
      };
      
      onSave(entry);
    });

    setWeights({});
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleUpdateSingle = (entry: DispatchEntry) => {
    onSave(entry);
    setIsEditingId(null);
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '--:--:--';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '--:--:--';
      return format(d, 'HH:mm:ss');
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="space-y-6">
      {/* Totalizers Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Despachos a Granel</p>
            <h4 className="text-xl font-bold font-mono text-text-main mt-0.5">
              {totals.bulk.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans text-amber-500 font-bold">TN</span>
            </h4>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Despachos en Bolsa</p>
            <h4 className="text-xl font-bold font-mono text-text-main mt-0.5">
              {totals.bag.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans text-blue-500 font-bold">TN</span>
            </h4>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Total Despachado (Día)</p>
            <h4 className="text-xl font-bold font-mono text-primary mt-0.5">
              {totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans text-primary font-bold">TN</span>
            </h4>
          </div>
        </GlassCard>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between bg-surface/50 backdrop-blur-sm p-1 rounded-xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('FORM')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === 'FORM' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-main"
          )}
        >
          <Plus size={14} /> Registrar Despacho
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === 'HISTORY' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-main"
          )}
        >
          <History size={14} /> Historial del Día ({safeHistory.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'FORM' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <GlassCard className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-lg font-bold text-text-main uppercase tracking-tight">Registro de Toneladas Despachadas</h3>
                  <p className="text-xs text-text-muted font-medium">Ingrese las toneladas para cada material productivo.</p>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar material..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-bg/50 border border-border rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaterials.map(m => (
                  <div key={m.id} className="bg-bg/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between group hover:border-primary/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{m.code || 'S/C'}</p>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                            m.isBulk ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          )}>
                            {m.isBulk ? 'Granel' : 'Bolsa'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{m.name}</h4>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                           <GlassInput
                             type="number"
                             placeholder={canEdit ? "0.0" : "N/R"}
                             value={weights[m.id] || ''}
                             disabled={!canEdit}
                             onChange={(e) => setWeights({ ...weights, [m.id]: e.target.value })}
                             className="text-right font-mono disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                           />
                           <span className="text-[10px] font-black text-text-muted">TN</span>
                        </div>
                    </div>
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="mt-10 flex justify-center border-t border-white/5 pt-8">
                  <GlassButton 
                    onClick={handleSaveAll}
                    disabled={(Object.values(weights) as string[]).every(w => !w || parseFloat(w) <= 0)}
                    className="h-14 px-12 group"
                  >
                    <Save className="mr-2 group-hover:scale-110 transition-transform" />
                    GUARDAR REGISTROS
                  </GlassButton>
                </div>
              )}
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassCard className="overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead className="bg-white/5 border-b border-white/5">
                     <tr>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Turno</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Hora</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Material</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Toneladas</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Usuario</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {safeHistory.length > 0 ? [...safeHistory].sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')).map((entry) => {
                       const material = materials.find(m => m.id === entry.materialId);
                       const shiftObj = shifts.find(s => s.id === entry.shiftId);
                       const isEditing = isEditingId === entry.id;

                       return (
                         <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-6 py-4 text-xs font-bold text-text-main whitespace-nowrap">
                             <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs">
                               {shiftObj?.name || entry.shiftDescription || `Turno ${entry.shiftId}`}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-xs font-mono text-text-muted whitespace-nowrap">
                             {formatTimestamp(entry.timestamp)}
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-text-main">{material?.name || entry.materialDescription || entry.materialId}</span>
                               <span className="text-[10px] text-text-muted uppercase tracking-widest">{material?.code || 'S/C'}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             <span className={cn(
                               "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                               material?.isBulk ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                             )}>
                               {material?.isBulk ? 'Granel' : 'Bolsa'}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-right whitespace-nowrap">
                             {isEditing ? (
                               <div className="flex items-center justify-end gap-2">
                                 <input
                                   type="number"
                                   className="w-24 bg-bg border border-primary/50 rounded-lg py-1 px-2 text-right text-sm font-mono outline-none"
                                   defaultValue={entry.tons}
                                   onBlur={(e) => handleUpdateSingle({ ...entry, tons: parseFloat(e.target.value) || entry.tons })}
                                 />
                                 <span className="text-[10px] font-bold text-text-muted uppercase">TN</span>
                               </div>
                             ) : (
                               <span className="font-mono text-base font-bold text-primary">
                                 {(Number(entry.tons) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN
                               </span>
                             )}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             <span className="text-xs font-medium text-text-muted">{entry.userName || entry.userId || 'Sistema'}</span>
                           </td>
                           <td className="px-6 py-4 text-right whitespace-nowrap">
                             <div className="flex items-center justify-end gap-1">
                               {canEdit && (
                                 <>
                                   <button 
                                     onClick={() => setIsEditingId(isEditing ? null : entry.id)}
                                     className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all"
                                   >
                                     <Edit2 size={14} />
                                   </button>
                                   <button 
                                     onClick={() => onDelete(entry.id)}
                                     className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-all"
                                   >
                                     <Trash2 size={14} />
                                   </button>
                                 </>
                               )}
                             </div>
                           </td>
                         </tr>
                       );
                     }) : (
                       <tr>
                         <td colSpan={7} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                               <Truck size={40} />
                               <p className="text-xs font-bold uppercase tracking-widest">Sin registros de despacho en esta fecha</p>
                            </div>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <Check size={14} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Despachos registrados con éxito</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

