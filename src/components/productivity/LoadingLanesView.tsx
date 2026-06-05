import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, CheckCircle2, XCircle, Info, Save, Trash2, Plus, ChevronDown, Check } from 'lucide-react';
import { MasterData, AppUser, LoadingPoint, LaneShiftStatus, Material } from '../../types';
import { cn } from '../../lib/utils';
import { GlassButton, GlassInput, GlassCard } from '../ui/GlassUI';
import { format } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  history: LaneShiftStatus[];
  onSave: (laneStatus: LaneShiftStatus | LaneShiftStatus[]) => void;
  onDelete: (id: string) => void;
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function LoadingLanesView({ masters, currentUser, history, onSave, onDelete, selectedShiftId, selectedDate }: Props) {
  const [activeTab, setActiveTab] = useState<'FORM' | 'HISTORY'>('FORM');
  const [showToast, setShowToast] = useState(false);
  const [selectedLanes, setSelectedLanes] = useState<Record<string, Partial<LaneShiftStatus>>>({});

  const canEdit = React.useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'LOADING_LANES');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  const lastSyncKeyRef = React.useRef<string>("");

  // Fix: Sync status when history, shift or date changes
  useEffect(() => {
    const historySignature = `${selectedShiftId}-${selectedDate}-${JSON.stringify(history)}`;
    if (lastSyncKeyRef.current === historySignature) {
      return;
    }
    lastSyncKeyRef.current = historySignature;

    const initialState = masters.loadingPoints.reduce((acc, lp) => {
      const existing = history.find(h => h.loadingPointId === lp.id);
      acc[lp.id] = existing || {
        loadingPointId: lp.id,
        isEnabled: true,
        materialIds: [],
        observation: ''
      };
      return acc;
    }, {} as Record<string, Partial<LaneShiftStatus>>);
    
    setSelectedLanes(initialState);
  }, [history, masters.loadingPoints, selectedShiftId, selectedDate]);

  const handleToggle = (lpId: string) => {
    if (!canEdit) return;
    setSelectedLanes(prev => {
      const lane = prev[lpId];
      if (!lane) return prev;
      const nextEnabled = !lane.isEnabled;
      return {
        ...prev,
        [lpId]: {
          ...lane,
          isEnabled: nextEnabled,
          // Guard values to avoid undefined
          materialIds: lane.materialIds || [],
          observation: lane.observation || '',
          // Reset logic
          ...(nextEnabled ? { observation: '' } : { materialIds: [] })
        }
      };
    });
  };

  const handleMaterialToggle = (lpId: string, materialId: string) => {
    if (!canEdit) return;
    setSelectedLanes(prev => {
        const lane = prev[lpId] || { loadingPointId: lpId, isEnabled: true, materialIds: [], observation: '' };
        const currentIds = lane.materialIds || [];
        const newIds = currentIds.includes(materialId)
          ? currentIds.filter(id => id !== materialId)
          : [...currentIds, materialId];
        return {
          ...prev,
          [lpId]: { ...lane, materialIds: newIds }
        };
      });
  };

  const handleSaveAll = () => {
    if (!canEdit) return;
    if (!selectedShiftId) return;

    const statuses: LaneShiftStatus[] = [];
    (Object.values(selectedLanes) as Partial<LaneShiftStatus>[]).forEach(lane => {
      const status: LaneShiftStatus = {
        id: lane.id || `LS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        date: selectedDate,
        shiftId: selectedShiftId,
        loadingPointId: lane.loadingPointId!,
        isEnabled: lane.isEnabled!,
        materialIds: lane.materialIds || [],
        observation: lane.observation || ''
      };
      statuses.push(status);
    });

    onSave(statuses);

    // Show success toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const productiveMaterials = masters.materials.filter(m => m.isProductive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 bg-surface p-1.5 rounded-2xl border border-border w-fit mx-auto shadow-sm">
        <button 
          onClick={() => setActiveTab('FORM')}
          className={cn(
            "px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'FORM' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-main"
          )}
        >
          Estado Actual
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={cn(
            "px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'HISTORY' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-main"
          )}
        >
          Historial Turno
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
            <GlassCard className="overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead className="bg-white/5 border-b border-white/5">
                     <tr>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Calle</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Habilitación</th>
                       <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Materiales / Observaciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {masters.loadingPoints.map(lp => {
                        const laneMaterials = lp.materialIds && lp.materialIds.length > 0
                          ? masters.materials.filter(m => lp.materialIds?.includes(m.id))
                          : productiveMaterials;
                       const lane = selectedLanes[lp.id] || { isEnabled: true, materialIds: [], observation: '' };
                       return (
                         <tr key={lp.id} className={cn("transition-colors", !lane.isEnabled && "bg-red-500/[0.02]")}>
                           <td className="px-6 py-4">
                             <span className="text-sm font-bold text-text-main uppercase">{lp.name}</span>
                           </td>
                           <td className="px-6 py-4">
                             <span className={cn(
                               "px-2 py-0.5 rounded text-[9px] font-black border uppercase",
                               lp.type === 'BOLSA' ? "border-blue-500/20 text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.1)]" : "border-amber-500/20 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                             )}>
                               {lp.type}
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <label className={cn("relative inline-flex items-center", canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                                  <input 
                                      type="checkbox" disabled={!canEdit} checked={lane.isEnabled}
                                      onChange={() => handleToggle(lp.id)}
                                      className="sr-only peer" 
                                  />
                                  <div className="w-11 h-6 bg-surface border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary/20 peer-checked:border-primary/30 peer-checked:after:bg-primary"></div>
                               </label>
                               <span className={cn(
                                  "text-[10px] font-bold uppercase",
                                  lane.isEnabled ? "text-emerald-500" : "text-red-500"
                               )}>
                                  {lane.isEnabled ? 'OK' : 'OFF'}
                               </span>
                             </div>
                           </td>
                           <td className="px-6 py-4 min-w-[300px]">
                              {lane.isEnabled ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {laneMaterials.map(m => (
                                    <button
                                      key={m.id}
                                      disabled={!canEdit}
                                      onClick={() => handleMaterialToggle(lp.id, m.id)}
                                      className={cn(
                                        "px-2 py-1 rounded text-[9px] font-bold border transition-all",
                                        lane.materialIds?.includes(m.id)
                                          ? "bg-primary/10 border-primary text-primary"
                                          : "bg-bg/40 border-border text-text-muted hover:border-text-main"
                                      )}
                                    >
                                      {m.name}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <textarea
                                    value={lane.observation || ''}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedLanes(prev => {
                                        const laneObj = prev[lp.id];
                                        if (!laneObj) return prev;
                                        return {
                                          ...prev,
                                          [lp.id]: { ...laneObj, observation: val }
                                        };
                                      });
                                    }}
                                    placeholder={canEdit ? "Motivo de deshabilitación..." : "Registro No Habilitado (Sin motivo)"}
                                    className="w-full h-10 bg-bg-input border border-border rounded-lg p-2 text-[11px] text-text-main outline-none focus:border-red-500/50 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                </div>
                              )}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </GlassCard>

            {canEdit && (
              <div className="flex justify-center pt-4 w-full">
                <GlassButton 
                  onClick={handleSaveAll}
                  className="h-12 px-6 sm:px-12 group w-full sm:w-auto text-xs sm:text-sm uppercase tracking-wider font-extrabold"
                  disabled={!selectedShiftId}
                >
                  <Save className="mr-2 group-hover:scale-110 transition-transform shrink-0" size={16} /> Guardar Estado General
                </GlassButton>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="grid grid-cols-1 gap-4">
              {history.length === 0 ? (
                <div className="text-center py-20 bg-surface rounded-3xl border border-dashed border-border text-text-muted">
                  <p className="font-medium tracking-tight">No hay registros de calles de carga en este turno.</p>
                </div>
              ) : (
                history.map(status => {
                  const lp = masters.loadingPoints.find(p => p.id === status.loadingPointId);
                  return (
                    <div key={status.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-bold text-text-main">{lp?.name}</h4>
                             <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded border uppercase",
                                status.isEnabled ? "border-emerald-500/20 text-emerald-500" : "border-red-500/20 text-red-500"
                             )}>
                                {status.isEnabled ? 'Habilitada' : 'No Habilitada'}
                             </span>
                          </div>
                          {status.isEnabled ? (
                            <p className="text-[10px] text-text-muted mt-1">
                              Materiales: {status.materialIds.map(id => masters.materials.find(m => m.id === id)?.name).join(', ') || 'Sin especificar'}
                            </p>
                          ) : (
                            <p className="text-[10px] text-red-500 mt-1 italic">
                              Motivo: {status.observation}
                            </p>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <button 
                          onClick={() => onDelete(status.id)}
                          className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
            <span className="text-xs font-bold uppercase tracking-widest">Estado guardado con éxito</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
