import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Box, Trash2, Save, ChevronDown, ChevronUp, Package, Calculator, ClipboardList } from 'lucide-react';
import { MasterData, InventoryEntry, ProductionReport, AppUser } from '../../../types';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { format, parseISO } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (entry: InventoryEntry) => void;
  onDelete: (id: string) => void;
  entries: InventoryEntry[];
  productionReports: ProductionReport[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function InventoryView({ masters, currentUser, onSave, onDelete, entries, productionReports, selectedShiftId, selectedDate }: Props) {
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
  const [expandedMaterials, setExpandedMaterials] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toggle accordion
  const toggleMaterial = (id: string) => {
    setExpandedMaterials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group entries by material
  const groupedData = useMemo(() => {
    const groups: Record<string, { materialId: string; entries: InventoryEntry[]; totalTn: number }> = {};
    
    entries.forEach(entry => {
      if (!groups[entry.materialId]) {
        groups[entry.materialId] = { materialId: entry.materialId, entries: [], totalTn: 0 };
      }
      groups[entry.materialId].entries.push(entry);
      groups[entry.materialId].totalTn += entry.weightTn;
    });

    return Object.values(groups).sort((a, b) => {
      const matA = masters.materials.find(m => m.id === a.materialId);
      const matB = masters.materials.find(m => m.id === b.materialId);
      if (matA?.isProductive && !matB?.isProductive) return -1;
      if (!matA?.isProductive && matB?.isProductive) return 1;
      return (matA?.name || '').localeCompare(matB?.name || '');
    });
  }, [entries, masters.materials]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialId || !formData.quantity) return;

    const material = masters.materials.find(m => m.id === formData.materialId);
    if (!material) return;

    // Weight in TN = Units * PackingWeight / 1000, unless it's a unitary material
    const isUnitary = material.isPallet || material.isSupply || material.isBigBag;
    const weightTn = isUnitary ? Number(formData.quantity) : (Number(formData.quantity) * material.packingWeight) / 1000;

    const entry: InventoryEntry = {
      id: editingId || `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: selectedDate,
      shiftId: selectedShiftId || '',
      materialId: formData.materialId,
      quantity: Number(formData.quantity),
      weightTn: Number(weightTn.toFixed(3)),
      userId: currentUser?.dni || 'USER-1',
      userName: currentUser?.name || 'Operador Holcim'
    };

    onSave(entry);
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ materialId: '', quantity: 0 });
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
          <GlassButton onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="h-10 px-4">
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
                <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-main transition-colors"><PlusCircle className="rotate-45" size={20} /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                  <GlassSelect 
                    label="Material / Insumo" 
                    options={masters.materials
                      .map(m => ({ label: m.name, value: m.id }))}
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
        {groupedData.length === 0 ? (
          <GlassCard className="p-12 text-center text-text-muted flex flex-col items-center gap-3">
            <Box size={48} className="opacity-20" />
            <p>No hay registros de inventario para este turno/fecha.</p>
          </GlassCard>
        ) : (
          groupedData.map(group => {
            const material = masters.materials.find(m => m.id === group.materialId);
            const isExpanded = expandedMaterials[group.materialId];
            const isUnitary = material?.isPallet || material?.isSupply || material?.isBigBag;
            const unitType = isUnitary ? 'UN' : 'TN';

            return (
              <GlassCard key={group.materialId} className={cn(
                "overflow-hidden border transition-all duration-300",
                isExpanded ? "border-primary/30 ring-1 ring-primary/20" : "border-white/5"
              )}>
                {/* Accordion Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleMaterial(group.materialId)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-bold text-text-main">
                        {material?.name}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-text-muted">Stock Contado Total</p>
                      <p className="text-xl font-mono font-bold text-primary">{group.totalTn.toFixed(isUnitary ? 0 : 2)} {unitType}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
                  </div>
                </div>

                {/* Accordion Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-bg/20"
                    >
                      <div className="p-2">
                        <DataTable<InventoryEntry> 
                          data={group.entries} 
                          columns={[
                            { header: 'Ctd. Pallets/Tarimas', accessor: (r) => <span className="font-bold">{r.quantity}</span> },
                            { header: isUnitary ? 'Total Unidades' : 'Total Peso', accessor: (r) => <span className="font-mono font-bold text-primary">{r.weightTn.toFixed(isUnitary ? 0 : 3)} {unitType}</span> },
                            { 
                              header: 'Acciones', 
                              align: 'right',
                              accessor: (r) => canEdit ? (
                                <TableActions 
                                  onEdit={() => {
                                    setFormData(r);
                                    setEditingId(r.id);
                                    setIsFormOpen(true);
                                  }}
                                  onDelete={() => setDeletingId(r.id)}
                                />
                              ) : (
                                <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">Lectura</span>
                              )
                            }
                          ]}
                        />
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
    </motion.div>
  );
}
