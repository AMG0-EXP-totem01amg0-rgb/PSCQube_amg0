import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Box, Trash2, Save, ChevronDown, ChevronUp, Package, Calculator, ClipboardList, Edit3, Calendar } from 'lucide-react';
import { MasterData, InventoryEntry, ProductionReport, AppUser } from '../../../types';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (entry: InventoryEntry) => void;
  onDelete: (id: string) => void;
  onBulkUpdate?: (entriesToUpdate: { id: string; date: string; shiftId: string }[]) => void;
  entries: InventoryEntry[];
  productionReports: ProductionReport[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function InventoryView({ 
  masters, 
  currentUser, 
  onSave, 
  onDelete, 
  onBulkUpdate,
  entries, 
  productionReports, 
  selectedShiftId, 
  selectedDate 
}: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'STOCK');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  const [formData, setFormData] = useState<Partial<InventoryEntry>>({
    materialId: '',
    quantity: 0
  });

  // Group Level 1: Key is "date||shiftId"
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (selectedDate && selectedShiftId) {
      initial[`${selectedDate}||${selectedShiftId}`] = true;
    }
    return initial;
  });

  // Group Level 2: Key is "groupKey||materialId" to prevent expanding the same material globally
  const [expandedMaterials, setExpandedMaterials] = useState<Record<string, boolean>>({});
  
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk Edit Modal State
  const [bulkEditGroup, setBulkEditGroup] = useState<{
    key: string;
    date: string;
    shiftId: string;
    entries: InventoryEntry[];
  } | null>(null);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkShiftId, setBulkShiftId] = useState('');

  // Toggle accordions
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMaterial = (key: string) => {
    setExpandedMaterials(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ materialId: '', quantity: 0 });
  };

  // Group entries by Date and Shift (Level 1)
  const groupedGroups = useMemo(() => {
    const groups: Record<string, {
      key: string;
      date: string;
      shiftId: string;
      entries: InventoryEntry[];
    }> = {};

    entries.forEach(entry => {
      const key = `${entry.date}||${entry.shiftId}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          date: entry.date,
          shiftId: entry.shiftId,
          entries: []
        };
      }
      groups[key].entries.push({
        ...entry,
        quantity: Number(entry.quantity) || 0,
        weightTn: Number(entry.weightTn) || 0
      });
    });

    // Sort groups: latest dates first, then by shift ID (T1, T2, T3 order etc.)
    return Object.values(groups).sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      // Sort T1, T2, T3 or Shift name
      return a.shiftId.localeCompare(b.shiftId);
    });
  }, [entries]);

  // Group entries of a specific group by material (Level 2)
  const getGroupedMaterials = (groupEntries: InventoryEntry[]) => {
    const materialGroups: Record<string, { materialId: string; entries: InventoryEntry[]; totalTn: number }> = {};
    
    groupEntries.forEach(entry => {
      if (!materialGroups[entry.materialId]) {
        materialGroups[entry.materialId] = { materialId: entry.materialId, entries: [], totalTn: 0 };
      }
      materialGroups[entry.materialId].entries.push(entry);
      materialGroups[entry.materialId].totalTn += entry.weightTn;
    });

    return Object.values(materialGroups).sort((a, b) => {
      const matA = masters.materials.find(m => m.id === a.materialId);
      const matB = masters.materials.find(m => m.id === b.materialId);
      return (matA?.name || '').localeCompare(matB?.name || '');
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialId || formData.quantity === undefined) return;

    const material = masters.materials.find(m => m.id === formData.materialId);
    if (!material) return;

    // Weight in TN = Units * PackingWeight / 1000, unless it's a unitary material
    const isUnitary = material.isPallet || material.isSupply || material.isBigBag;
    const weightTn = isUnitary ? Number(formData.quantity) : (Number(formData.quantity) * material.packingWeight) / 1000;

    const entryId = editingId || `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entry: InventoryEntry = {
      id: entryId,
      date: selectedDate,
      shiftId: selectedShiftId || '',
      materialId: formData.materialId,
      quantity: Number(formData.quantity),
      weightTn: Number(weightTn.toFixed(3)),
      userId: currentUser?.dni || 'USER-1',
      userName: currentUser?.name || 'Operador Holcim'
    };

    const targetMaterialId = formData.materialId;
    const currentGroupKey = `${selectedDate}||${selectedShiftId || ''}`;

    onSave(entry);
    handleCloseForm();
    
    // Automatically expand the group and the material group so the operator sees the update
    setExpandedGroups(prev => ({ ...prev, [currentGroupKey]: true }));
    setExpandedMaterials(prev => ({ ...prev, [`${currentGroupKey}||${targetMaterialId}`]: true }));
  };

  const handleOpenBulkEdit = (e: React.MouseEvent, group: typeof groupedGroups[0]) => {
    e.stopPropagation(); // Prevent toggling the group accordion when clicking the edit button
    setBulkEditGroup(group);
    setBulkDate(group.date);
    setBulkShiftId(group.shiftId);
  };

  const handleSaveBulkEdit = () => {
    if (!bulkEditGroup || !onBulkUpdate) return;
    const updates = bulkEditGroup.entries.map(e => ({
      id: e.id,
      date: bulkDate,
      shiftId: bulkShiftId
    }));
    onBulkUpdate(updates);
    setBulkEditGroup(null);
  };

  // Helper to get formatted date string
  const formatGroupDate = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return format(parsed, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-main">Control de Insumos</h2>
            <p className="text-xs text-text-muted">Registro de inventario físico en playa y galpones</p>
          </div>
        </div>
        {canEdit && (
          <GlassButton onClick={() => { 
            setEditingId(null); 
            setFormData({ materialId: '', quantity: 0 }); 
            setIsFormOpen(true); 
          }} className="h-10 px-4">
            <PlusCircle size={18} /> <span className="ml-2">Registrar Conteo</span>
          </GlassButton>
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <GlassCard className="p-6 mb-6 overflow-hidden border-primary/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Calculator size={16} className="text-primary" />
                  {editingId ? 'Editar' : 'Nuevo'} Registro de Conteo
                </h3>
                <button onClick={handleCloseForm} className="text-text-muted hover:text-text-main transition-colors">
                  <PlusCircle className="rotate-45" size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                  <GlassSelect 
                    label="Material / Insumo" 
                    options={masters.materials
                      .map(m => ({ label: m.name, value: m.id }))
                      .sort((a, b) => a.label.localeCompare(b.label))}
                    value={formData.materialId}
                    onChange={e => setFormData(prev => ({...prev, materialId: e.target.value}))}
                    required
                  />
                </div>
                <GlassInput 
                  type="number" 
                  label="Cantidad (Tarimas/Unid)" 
                  value={formData.quantity} 
                  onChange={e => setFormData(prev => ({...prev, quantity: e.target.value}))} 
                  required
                />
                <div className="flex items-end gap-3">
                  <GlassButton type="submit" className="w-full h-10">
                    <Save size={16} /> Guardar Registro
                  </GlassButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {groupedGroups.length === 0 ? (
          <GlassCard className="p-12 text-center text-text-muted flex flex-col items-center gap-3">
            <Box size={48} className="opacity-20" />
            <p>No hay registros de inventario guardados.</p>
          </GlassCard>
        ) : (
          groupedGroups.map(group => {
            const isGroupExpanded = expandedGroups[group.key];
            const shift = masters.shifts.find(s => s.id === group.shiftId);
            const shiftName = shift ? shift.name : `Turno ${group.shiftId}`;
            const groupedMaterials = getGroupedMaterials(group.entries);
            const totalItemsCount = group.entries.length;

            return (
              <GlassCard 
                key={group.key} 
                className={cn(
                  "overflow-hidden border transition-all duration-300",
                  isGroupExpanded ? "border-primary/30 ring-1 ring-primary/20" : "border-white/5"
                )}
              >
                {/* Level 1 Group Header */}
                <div 
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-white/5 transition-colors gap-4"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-muted">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-text-main capitalize">
                          {formatGroupDate(group.date)}
                        </h4>
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {shiftName}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {totalItemsCount} {totalItemsCount === 1 ? 'conteo registrado' : 'conteos registrados'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t border-white/5 md:border-0 pt-3 md:pt-0">
                    {canEdit && onBulkUpdate && (
                      <button 
                        onClick={(e) => handleOpenBulkEdit(e, group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-text-main border border-white/10 hover:border-primary/30 text-xs transition-all font-semibold"
                        title="Reasignar fecha y turno de todo este grupo"
                      >
                        <Edit3 size={13} className="text-primary" />
                        <span>Cambiar Turno/Fecha</span>
                      </button>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {isGroupExpanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
                    </div>
                  </div>
                </div>

                {/* Level 2 & 3 Continuous Accordion */}
                <AnimatePresence>
                  {isGroupExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-bg/20"
                    >
                      <div className="divide-y divide-white/5">
                        {groupedMaterials.map(matGroup => {
                          const material = masters.materials.find(m => m.id === matGroup.materialId);
                          const isUnitary = material?.isPallet || material?.isSupply || material?.isBigBag;
                          const unitType = isUnitary ? 'UN' : 'TN';
                          const materialKey = `${group.key}||${matGroup.materialId}`;
                          const isMaterialExpanded = expandedMaterials[materialKey];

                          return (
                            <div key={matGroup.materialId} className="transition-all">
                              {/* Level 2: Material Header */}
                              <div 
                                className="pl-6 pr-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => toggleMaterial(materialKey)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-6 rounded-full bg-primary/40 mr-1" />
                                  <span className="font-bold text-sm text-text-main">{material?.name || 'Material Desconocido'}</span>
                                  <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded">
                                    {matGroup.entries.length} {matGroup.entries.length === 1 ? 'registro' : 'registros'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-mono font-bold text-sm text-primary">
                                    {matGroup.totalTn.toFixed(isUnitary ? 0 : 2)} {unitType}
                                  </span>
                                  {isMaterialExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                                </div>
                              </div>

                              {/* Level 3: Individual Count Entries */}
                              <AnimatePresence>
                                {isMaterialExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }} 
                                    animate={{ height: 'auto', opacity: 1 }} 
                                    exit={{ height: 0, opacity: 0 }}
                                    className="pl-12 bg-white/[0.02]"
                                  >
                                    <div className="divide-y divide-white/5">
                                      {matGroup.entries.map((entry) => (
                                        <div key={entry.id} className="pr-4 py-2 flex items-center justify-between text-xs hover:bg-white/5 transition-colors gap-4">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 flex-1 py-1">
                                            <div className="flex items-center gap-1 text-text-muted">
                                              <span>Cantidad:</span>
                                              <span className="font-mono font-bold text-text-main">{entry.quantity} {isUnitary ? 'Unidades' : 'Pallets'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-text-muted">
                                              <span>Equivale a:</span>
                                              <span className="font-mono font-bold text-primary">{entry.weightTn.toFixed(isUnitary ? 0 : 3)} {unitType}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-text-muted">
                                              <span>Registró:</span>
                                              <span className="text-text-main truncate max-w-[120px]" title={entry.userName}>
                                                {entry.userName}
                                              </span>
                                            </div>
                                          </div>

                                          {canEdit && (
                                            <div className="flex items-center gap-2">
                                              <button 
                                                onClick={() => {
                                                  setFormData(entry);
                                                  setEditingId(entry.id);
                                                  setIsFormOpen(true);
                                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="p-1 rounded bg-white/5 hover:bg-primary/20 text-text-muted hover:text-text-main transition-all"
                                                title="Editar conteo"
                                              >
                                                <Edit3 size={14} />
                                              </button>
                                              <button 
                                                onClick={() => setDeletingId(entry.id)}
                                                className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all"
                                                title="Eliminar conteo"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })
        )}
      </div>

      <ConfirmModal 
        isOpen={!!deletingId} 
        onClose={() => setDeletingId(null)} 
        onConfirm={() => { deletingId && onDelete(deletingId); setDeletingId(null); }}
        title="Eliminar Conteo"
        message="¿Estás seguro de eliminar este registro de conteo físico? El peso total de este material se actualizará."
      />

      {/* Bulk Edit Group Modal */}
      <AnimatePresence>
        {bulkEditGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
              
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2 mb-2">
                <Edit3 size={20} className="text-primary" />
                Reasignar Turno y Fecha
              </h3>
              <p className="text-xs text-text-muted mb-6">
                Estás a punto de mover los <strong>{bulkEditGroup.entries.length}</strong> conteos de este grupo a un nuevo turno y fecha en un solo click.
              </p>

              <div className="space-y-4 mb-6">
                <GlassInput 
                  type="date"
                  label="Nueva Fecha"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  required
                />

                <GlassSelect 
                  label="Nuevo Turno"
                  options={masters.shifts.map(s => ({ label: s.name, value: s.id }))}
                  value={bulkShiftId}
                  onChange={e => setBulkShiftId(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setBulkEditGroup(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveBulkEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white transition-all flex items-center gap-1"
                >
                  <Save size={14} />
                  <span>Aplicar Cambios</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
