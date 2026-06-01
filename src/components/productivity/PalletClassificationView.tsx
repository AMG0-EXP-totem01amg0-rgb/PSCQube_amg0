import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Box, Trash2, Save, Layers, Calculator, ClipboardList } from 'lucide-react';
import { MasterData, PalletClassification, AppUser } from '../../types';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';
import { format, parseISO } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (entry: PalletClassification) => void;
  onDelete: (id: string) => void;
  entries: PalletClassification[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function PalletClassificationView({ 
  masters, 
  currentUser, 
  onSave, 
  onDelete, 
  entries, 
  selectedShiftId, 
  selectedDate 
}: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'PALLET_CLASS');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  // Filter materials that are marked as pallet (tarima)
  const palletMaterials = useMemo(() => {
    return masters.materials.filter(m => m.isPallet === true);
  }, [masters.materials]);

  const [formData, setFormData] = useState<Partial<PalletClassification>>({
    palletType: '',
    quantity: 0
  });

  // Automatically select first pallet material if available and not set
  React.useEffect(() => {
    if (palletMaterials.length > 0 && !formData.palletType) {
      setFormData(prev => ({ ...prev, palletType: palletMaterials[0].name }));
    }
  }, [palletMaterials, formData.palletType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.palletType || !formData.quantity || formData.quantity <= 0) return;

    const currentShift = masters.shifts.find(s => s.id === selectedShiftId);
    
    // Check if editing or new
    let existingEntry = entries.find(x => x.id === editingId);

    const entry: PalletClassification = {
      id: editingId || `PAL-CLASS-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      date: selectedDate,
      machinistId: editingId ? (existingEntry?.machinistId || currentUser?.dni || '') : (currentUser?.dni || ''),
      machinistName: editingId ? (existingEntry?.machinistName || currentUser?.name || '') : (currentUser?.name || ''),
      shiftId: selectedShiftId || '',
      shiftDescription: currentShift ? currentShift.name : '',
      palletType: formData.palletType,
      quantity: Number(formData.quantity)
    };

    onSave(entry);
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ 
      palletType: palletMaterials[0]?.name || '', 
      quantity: 0 
    });
  };

  const columns: Column<PalletClassification>[] = [
    { 
      header: 'Fecha', 
      accessor: (row) => <span className="text-[10px] opacity-70">{format(parseISO(row.date), 'dd/MM/yyyy')}</span> 
    },
    { 
      header: 'Turno', 
      accessor: (row) => <span className="font-semibold text-text-main">{row.shiftDescription || row.shiftId}</span> 
    },
    {
      header: 'Maquinista',
      accessor: (row) => (
        <div className="py-1">
          <div className="text-[11px] font-bold text-text-main">
            {row.machinistName || <span className="text-text-muted/80 italic">Sin registrar</span>}
          </div>
          {row.machinistId && (
            <div className="text-[9px] font-mono text-text-muted">
              DNI: {row.machinistId}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Tipo de Pallet', 
      accessor: (row) => <span className="font-bold text-primary">{row.palletType}</span> 
    },
    { 
      header: 'Cantidad', 
      accessor: (row) => <span className="font-mono font-bold text-lg text-text-main">{row.quantity}</span> 
    },
    { 
      header: 'Acciones', 
      align: 'right',
      accessor: (row) => canEdit ? (
        <TableActions 
          onEdit={() => {
            setFormData({
              palletType: row.palletType,
              quantity: row.quantity
            });
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
    <motion.div 
      id="pallet-classification-root"
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6"
    >
      <div 
        id="pallet-classification-header"
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-4 rounded-2xl border border-border"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-main">Clasificación de Pallets</h2>
            <p className="text-xs text-text-muted">Registro y monitoreo de tarimas según sus distintos tipos y estados</p>
          </div>
        </div>
        {canEdit && (
          <GlassButton 
            id="register-pallet-classification-btn"
            onClick={() => { 
              setEditingId(null); 
              setFormData({ 
                palletType: palletMaterials[0]?.name || '', 
                quantity: 0 
              });
              setIsFormOpen(true); 
            }} 
            className="h-10 px-4"
          >
            <PlusCircle size={18} /> <span className="ml-2">Registrar Clasificación</span>
          </GlassButton>
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            id="pallet-classification-form-container"
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
          >
            <GlassCard className="p-6 mb-6 overflow-hidden border-orange-500/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Calculator size={16} className="text-orange-500" />
                  {editingId ? 'Editar' : 'Nuevo'} Registro de Pallets
                </h3>
                <button 
                  id="close-pallet-form-btn"
                  onClick={() => setIsFormOpen(false)} 
                  className="text-text-muted hover:text-text-main transition-colors"
                >
                  <PlusCircle className="rotate-45" size={20} />
                </button>
              </div>
              
              <form 
                id="pallet-classification-form"
                onSubmit={handleSubmit} 
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="md:col-span-1">
                  {palletMaterials.length > 0 ? (
                    <GlassSelect 
                      label="Tipo de Tarima" 
                      options={palletMaterials.map(m => ({ label: m.name, value: m.name }))}
                      value={formData.palletType}
                      onChange={e => setFormData({...formData, palletType: e.target.value})}
                      required
                    />
                  ) : (
                    <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs">
                      No hay materiales marcados como pallet en el Maestro de Materiales.
                    </div>
                  )}
                </div>
                <GlassInput 
                  type="number" 
                  label="Cantidad (unidades)" 
                  value={formData.quantity} 
                  onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} 
                  required
                  min="1"
                />
                <div className="flex items-end gap-3">
                  <GlassButton 
                    id="save-pallet-classification-btn"
                    type="submit" 
                    className="w-full h-10 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                  >
                    <Save size={16} /> Guardar Registro
                  </GlassButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div id="pallet-classification-table-container">
        {entries.length === 0 ? (
          <GlassCard className="p-12 text-center text-text-muted flex flex-col items-center gap-3">
            <Box id="empty-pallet-icon" size={48} className="opacity-20" />
            <p>No hay clasificaciones de pallets registradas para este turno/fecha.</p>
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden border border-white/5">
            <DataTable<PalletClassification> 
              data={entries} 
              columns={columns}
            />
          </GlassCard>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!deletingId} 
        onClose={() => setDeletingId(null)} 
        onConfirm={() => { deletingId && onDelete(deletingId); setDeletingId(null); }}
        title="Eliminar Clasificación"
        message="¿Estás seguro de eliminar este registro de clasificación de pallets?"
      />
    </motion.div>
  );
}
