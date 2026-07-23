import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Search, History, Plus, Save, Trash2, Edit2, Check, AlertCircle, Package, Layers, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [collapsedShifts, setCollapsedShifts] = useState<Record<string, boolean>>({});
  
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

  // Helper for boolean detection from master properties (es_granel? / es_despacho?)
  const isTrueVal = (val: any) =>
    val === true ||
    String(val).toUpperCase() === 'SI' ||
    String(val).toUpperCase() === 'TRUE' ||
    val === 1;

  const isMaterialBulk = (m?: Material | null) => {
    if (!m) return false;
    return isTrueVal(m.isBulk) || isTrueVal((m as any)['es_granel?']);
  };

  const isMaterialBolsa = (m?: Material | null) => {
    if (!m) return false;
    if (isMaterialBulk(m)) return false;
    return isTrueVal(m.isDispatch) || isTrueVal((m as any)['es_despacho?']);
  };

  const productiveMaterials = useMemo(() => 
    materials.filter(m => m && (isMaterialBolsa(m) || isMaterialBulk(m) || m.isDispatch === true)),
    [materials]
  );

  const filteredMaterials = useMemo(() => 
    productiveMaterials
      .filter(m => 
        (m.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (m.code || '').toLowerCase().includes((searchTerm || '').toLowerCase())
      )
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })),
    [productiveMaterials, searchTerm]
  );

  // Totalizers calculation (Granel vs Bolsa vs Total) - Sin decimales y acumulativo por turno
  const totals = useMemo(() => {
    const getShiftOrder = (shiftId: string) => {
      const idx = shifts.findIndex(s => s.id === shiftId);
      if (idx !== -1) return idx;
      const match = shiftId.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999;
    };

    // Map: materialId -> { shiftId -> totalTonsInShift }
    const materialShiftTotals: Record<string, Record<string, number>> = {};
    const shiftListForMaterial: Record<string, string[]> = {};

    safeHistory.forEach(entry => {
      if (!entry || !entry.materialId) return;
      const matId = entry.materialId;
      const sId = entry.shiftId || 'UNASSIGNED';
      const tons = Number(entry.tons) || 0;

      if (!materialShiftTotals[matId]) {
        materialShiftTotals[matId] = {};
        shiftListForMaterial[matId] = [];
      }
      if (materialShiftTotals[matId][sId] === undefined) {
        materialShiftTotals[matId][sId] = 0;
        shiftListForMaterial[matId].push(sId);
      }
      materialShiftTotals[matId][sId] += tons;
    });

    let bulkTons = 0;
    let bagTons = 0;

    // For each material, the latest shift reported holds the cumulative total for the day
    Object.keys(materialShiftTotals).forEach(matId => {
      const mat = materials.find(m => m.id === matId);
      const shiftIds = shiftListForMaterial[matId];

      shiftIds.sort((a, b) => getShiftOrder(a) - getShiftOrder(b));

      const latestShiftId = shiftIds[shiftIds.length - 1];
      const effectiveTons = materialShiftTotals[matId][latestShiftId] || 0;

      if (isMaterialBulk(mat)) {
        bulkTons += effectiveTons;
      } else if (isMaterialBolsa(mat)) {
        bagTons += effectiveTons;
      } else {
        bagTons += effectiveTons;
      }
    });

    return {
      bulk: Math.round(bulkTons),
      bag: Math.round(bagTons),
      total: Math.round(bulkTons + bagTons)
    };
  }, [safeHistory, materials, shifts]);

  // Group history entries by shift
  const historyByShift = useMemo(() => {
    const map: Record<string, { shiftId: string; shiftName: string; entries: DispatchEntry[]; totalTons: number }> = {};

    safeHistory.forEach(entry => {
      if (!entry) return;
      const sId = entry.shiftId || 'UNASSIGNED';
      const shiftObj = shifts.find(s => s.id === sId);
      const shiftName = shiftObj?.name || entry.shiftDescription || (sId === 'UNASSIGNED' ? 'Sin Turno' : `Turno ${sId}`);

      if (!map[sId]) {
        map[sId] = {
          shiftId: sId,
          shiftName,
          entries: [],
          totalTons: 0
        };
      }
      map[sId].entries.push(entry);
      map[sId].totalTons += (Number(entry.tons) || 0);
    });

    // Sort shift groups according to shifts master order or shiftId
    return Object.values(map).sort((a, b) => {
      const idxA = shifts.findIndex(s => s.id === a.shiftId);
      const idxB = shifts.findIndex(s => s.id === b.shiftId);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.shiftName.localeCompare(b.shiftName);
    });
  }, [safeHistory, shifts]);

  const toggleShiftCollapse = (shiftId: string) => {
    setCollapsedShifts(prev => ({
      ...prev,
      [shiftId]: !prev[shiftId]
    }));
  };

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
              {totals.bulk.toLocaleString('es-ES')} <span className="text-xs font-sans text-amber-500 font-bold">TN</span>
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
              {totals.bag.toLocaleString('es-ES')} <span className="text-xs font-sans text-blue-500 font-bold">TN</span>
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
              {totals.total.toLocaleString('es-ES')} <span className="text-xs font-sans text-primary font-bold">TN</span>
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
                            isMaterialBulk(m) ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          )}>
                            {isMaterialBulk(m) ? 'Granel' : 'Bolsa'}
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
            className="space-y-4"
          >
            {historyByShift.length > 0 ? (
              historyByShift.map(group => {
                const isCollapsed = collapsedShifts[group.shiftId] === true;

                return (
                  <GlassCard key={group.shiftId} className="overflow-hidden border border-border/60">
                    {/* Collapsible Shift Header */}
                    <div 
                      onClick={() => toggleShiftCollapse(group.shiftId)}
                      className="p-4 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                            <span>{group.shiftName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
                              {group.entries.length} {group.entries.length === 1 ? 'registro' : 'registros'}
                            </span>
                          </h4>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
                            Turno de trabajo
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-wider block">Total Turno</span>
                        <span className="font-mono text-base font-bold text-primary">
                          {Math.round(group.totalTons).toLocaleString('es-ES')} TN
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Table Content */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-x-auto border-t border-white/5"
                        >
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 border-b border-white/5">
                              <tr>
                                <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Material</th>
                                <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Toneladas</th>
                                <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Usuario</th>
                                <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {[...group.entries]
                                .sort((a, b) => {
                                  const nameA = materials.find(m => m.id === a.materialId)?.name || a.materialDescription || '';
                                  const nameB = materials.find(m => m.id === b.materialId)?.name || b.materialDescription || '';
                                  return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
                                })
                                .map((entry) => {
                                const material = materials.find(m => m.id === entry.materialId);
                                const isEditing = isEditingId === entry.id;

                                return (
                                  <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-3.5">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-text-main">{material?.name || entry.materialDescription || entry.materialId}</span>
                                        <span className="text-[10px] text-text-muted uppercase tracking-widest">{material?.code || 'S/C'}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3.5 whitespace-nowrap">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        isMaterialBulk(material) ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                      )}>
                                        {isMaterialBulk(material) ? 'Granel' : 'Bolsa'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
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
                                    <td className="px-6 py-3.5 whitespace-nowrap">
                                      <span className="text-xs font-medium text-text-muted">{entry.userName || entry.userId || 'Sistema'}</span>
                                    </td>
                                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
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
                              })}
                            </tbody>
                          </table>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard className="p-12 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <Truck size={40} />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin registros de despacho en esta fecha</p>
                </div>
              </GlassCard>
            )}
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


