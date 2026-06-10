import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Box, Trash2, Save, Layers, Calculator, ClipboardList, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { MasterData, PalletClassification, AppUser } from '../../../types';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal, Modal } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { format, parseISO } from 'date-fns';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (entry: PalletClassification) => void;
  onDelete: (id: string) => void;
  entries: PalletClassification[];
  allEntries?: PalletClassification[];
  selectedShiftId: string | null;
  selectedDate: string;
  isDark?: boolean;
}

const PALLET_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#8b5cf6', '#eab308', '#ec4899', '#f97316'];

export default function PalletClassificationView({ 
  masters, 
  currentUser, 
  onSave, 
  onDelete, 
  entries, 
  allEntries = [],
  selectedShiftId, 
  selectedDate,
  isDark = true
}: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'PALLET_CLASS');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  // Chart Data: Quantity by Date by Pallet Type
  const chartTypeData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    
    (allEntries || []).forEach(entry => {
      const d = entry.date || '';
      if (!d) return;
      
      if (!grouped[d]) {
        grouped[d] = {};
      }
      
      const pType = entry.palletType || 'DIVERSOS';
      grouped[d][pType] = (grouped[d][pType] || 0) + (Number(entry.quantity) || 0);
    });
    
    const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const latestDates = sortedDates.slice(-10); // Last 10 days
    
    return latestDates.map(d => {
      let displayDate = d;
      try {
        if (d.includes('-')) {
          const parts = d.split('-');
          if (parts.length === 3) {
            displayDate = `${parts[2]}/${parts[1]}`; // dd/mm
          }
        }
      } catch (e) {
        // fallback
      }
      
      return {
        date: displayDate,
        rawDate: d,
        ...grouped[d]
      };
    });
  }, [allEntries]);

  const uniquePalletTypesInChart = useMemo(() => {
    const pSet = new Set<string>();
    chartTypeData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'date' && key !== 'rawDate') {
          pSet.add(key);
        }
      });
    });
    return Array.from(pSet).sort((a, b) => a.localeCompare(b));
  }, [chartTypeData]);

  // Chart Data: Total Quantity of Pallets Grouped by Shift and Stacked by Pallet Type
  const chartShiftData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    
    (allEntries || []).forEach(entry => {
      const shiftName = entry.shiftDescription || entry.shiftId || 'DIVERSO';
      const pType = entry.palletType || 'DIVERSOS';
      
      if (!grouped[shiftName]) {
        grouped[shiftName] = {};
      }
      grouped[shiftName][pType] = (grouped[shiftName][pType] || 0) + (Number(entry.quantity) || 0);
    });

    return Object.entries(grouped).map(([shiftName, palletQuantities]) => ({
      shiftName,
      ...palletQuantities
    })).sort((a, b) => a.shiftName.localeCompare(b.shiftName));
  }, [allEntries]);

  const uniquePalletTypesInShiftChart = useMemo(() => {
    const pSet = new Set<string>();
    chartShiftData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'shiftName') {
          pSet.add(key);
        }
      });
    });
    return Array.from(pSet).sort((a, b) => a.localeCompare(b));
  }, [chartShiftData]);

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
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
            <Layers size={24} className="fill-primary/20" />
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

      {/* Gráficos Estadísticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución por Tipo de Pallet */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              Evolución por Tipo de Pallet
            </h3>
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider mt-1">Últimos 10 días de registro</p>
          </div>
          {chartTypeData.length > 0 ? (
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTypeData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)"} />
                  <XAxis 
                    dataKey="date" 
                    stroke={isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.8)"} 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.8)"} 
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#161920' : '#ffffff', 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      borderRadius: '12px',
                      color: isDark ? '#f3f4f6' : '#1f2937'
                    }}
                    itemStyle={{ color: isDark ? '#ffffff' : '#111827' }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#4b5563', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, color: isDark ? '#f3f4f6' : '#111827' }} />
                  {uniquePalletTypesInChart.map((pallet, idx) => (
                    <Line 
                       key={pallet}
                       type="monotone"
                       dataKey={pallet}
                       name={pallet}
                       stroke={PALLET_COLORS[idx % PALLET_COLORS.length]}
                       strokeWidth={2.5}
                       dot={{ r: 3, strokeWidth: 1, fill: isDark ? '#161920' : '#ffffff' }}
                       activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-surface/25">
              <Layers className="text-text-muted opacity-20 mb-2 animate-pulse" size={32} />
              <p className="text-xs text-text-muted">Cargá clasificaciones de pallets para visualizar la tendencia</p>
            </div>
          )}
        </GlassCard>

        {/* Gráfico 2: Clasificación por Turno */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <BarChart2 size={16} className="text-primary" />
              Clasificación por Turno
            </h3>
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider mt-1">Total acumulado de pallets por turno</p>
          </div>
          {chartShiftData.length > 0 ? (
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartShiftData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)"} />
                  <XAxis 
                    dataKey="shiftName" 
                    stroke={isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.8)"} 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.8)"} 
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#161920' : '#ffffff', 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      borderRadius: '12px',
                      color: isDark ? '#f3f4f6' : '#1f2937'
                    }}
                    itemStyle={{ color: isDark ? '#ffffff' : '#111827' }}
                    labelStyle={{ color: isDark ? '#9ca3af' : '#4b5563', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, color: isDark ? '#f3f4f6' : '#111827' }} />
                  {uniquePalletTypesInShiftChart.map((pallet, index) => (
                    <Bar 
                      key={pallet} 
                      dataKey={pallet} 
                      name={pallet} 
                      stackId="palletStack" 
                      fill={PALLET_COLORS[index % PALLET_COLORS.length]} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-surface/25">
              <BarChart2 className="text-text-muted opacity-20 mb-2 animate-pulse" size={32} />
              <p className="text-xs text-text-muted font-mono">No hay información de turnos disponible</p>
            </div>
          )}
        </GlassCard>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <Modal 
            isOpen={isFormOpen} 
            onClose={() => setIsFormOpen(false)} 
            title={editingId ? "Editar Clasificación de Pallets" : "Registrar Clasificación de Pallets"}
          >
            <form 
              id="pallet-classification-form"
              onSubmit={handleSubmit} 
              className="space-y-4"
            >
              <div>
                {palletMaterials.length > 0 ? (
                  <GlassSelect 
                    label="Tipo de Tarima*" 
                    options={palletMaterials.map(m => ({ label: m.name, value: m.name }))}
                    value={formData.palletType}
                    onChange={(e: any) => setFormData({...formData, palletType: e.target.value})}
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
                label="Cantidad* (unidades)" 
                value={formData.quantity || ''} 
                onChange={(e: any) => setFormData({...formData, quantity: e.target.value ? Number(e.target.value) : 0})} 
                required
                min="1"
              />
              
              <div className="flex gap-3 pt-4">
                <GlassButton 
                  variant="secondary" 
                  className="flex-1" 
                  onClick={() => setIsFormOpen(false)}
                  type="button"
                >
                  Cancelar
                </GlassButton>
                <GlassButton 
                  id="save-pallet-classification-btn"
                  type="submit" 
                  className="flex-1 text-white bg-primary hover:bg-primary-hover shadow-sm"
                >
                  <Save size={16} /> Guardar
                </GlassButton>
              </div>
            </form>
          </Modal>
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
