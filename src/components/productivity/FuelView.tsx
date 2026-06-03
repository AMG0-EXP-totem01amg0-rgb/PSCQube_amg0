import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplet, Plus, Trash2, AlertCircle, Save } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MasterData, AppUser, FuelLoad } from '../../types';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal, Modal } from '../ui/GlassUI';
import { cn } from '../../lib/utils';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: FuelLoad) => void;
  onDelete: (id: string) => void;
  history: FuelLoad[];
  allFuelLoads: FuelLoad[];
  selectedShiftId: string | null;
  selectedDate: string;
  isDark?: boolean;
}

const LINE_COLORS = ['#f97316', '#10b981', '#06b6d4', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899'];

export default function FuelView({ masters, currentUser, onSave, onDelete, history, allFuelLoads, selectedShiftId, selectedDate, isDark = true }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FuelLoad | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'GASOIL');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  // Form State
  const initialForm: Partial<FuelLoad> = {
    unidad_movil: '',
    id_operario: currentUser?.dni || '',
    descripcion_operario: currentUser?.name || '',
    litros_combustible: 0,
    date: selectedDate,
    shiftId: selectedShiftId || ''
  };

  const [formData, setFormData] = useState<Partial<FuelLoad>>(initialForm);

  // Vehicles list from sheet sorted alphabetically
  const vehicleOptions = useMemo(() => {
    const list = (masters.vehicles || [])
      .map(v => v.identificación)
      .filter((v, i, self) => v && self.indexOf(v) === i);
    
    return list
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .map(ident => ({ label: ident, value: ident }));
  }, [masters.vehicles]);

  const handleOpenAdd = () => {
    setFormData({
      ...initialForm,
      unidad_movil: vehicleOptions.length > 0 ? vehicleOptions[0].value : '',
      id_operario: currentUser?.dni || '',
      descripcion_operario: currentUser?.name || '',
    });
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: FuelLoad) => {
    setFormData(item);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.unidad_movil) return "Debe seleccionar una unidad móvil.";
    if (!formData.litros_combustible || formData.litros_combustible <= 0) return "Los litros de combustible deben ser mayores a 0.";
    return null;
  };

  const handleSave = () => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    const finalReport: FuelLoad = {
      id: formData.id || `FUEL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      unidad_movil: formData.unidad_movil!,
      id_operario: currentUser.dni,
      descripcion_operario: currentUser.name,
      litros_combustible: Number(formData.litros_combustible),
      date: formData.date || selectedDate,
      shiftId: formData.shiftId || selectedShiftId || ''
    };

    onSave(finalReport);
    setIsModalOpen(false);
  };

  // Recharts Data Aggregation for Mobile Unit loads chart
  const chartData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    
    (allFuelLoads || []).forEach(load => {
      const rawDate = load.date || '';
      if (!rawDate) return;
      
      if (!grouped[rawDate]) {
        grouped[rawDate] = {};
      }
      
      const vName = load.unidad_movil || 'DIVERSOS';
      grouped[rawDate][vName] = (grouped[rawDate][vName] || 0) + (Number(load.litros_combustible) || 0);
    });
    
    const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const latestDates = sortedDates.slice(-10); // Display last 10 record days
    
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
  }, [allFuelLoads]);

  const uniqueVehiclesInChart = useMemo(() => {
    const vehiclesSet = new Set<string>();
    chartData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'date' && key !== 'rawDate') {
          vehiclesSet.add(key);
        }
      });
    });
    return Array.from(vehiclesSet).sort((a, b) => a.localeCompare(b));
  }, [chartData]);

  const columns: Column<FuelLoad>[] = [
    {
      header: "Fecha",
      accessor: (row) => (
        <span className="text-sm text-text-main font-mono">{row.date}</span>
      )
    },
    {
      header: "Identificación Vehículo",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs uppercase border border-orange-500/10">
            {row.unidad_movil}
          </span>
        </div>
      )
    },
    {
      header: "Operario",
      accessor: (row) => (
        <span className="text-sm text-text-main font-bold">{row.descripcion_operario}</span>
      )
    },
    {
      header: "Litros Combustible",
      accessor: (row) => (
        <span className="text-sm font-black text-primary font-mono">{row.litros_combustible} L</span>
      ),
      align: "right"
    },
    {
      header: "Acciones",
      accessor: (row) => (
        canEdit ? (
          <TableActions 
            onEdit={() => handleOpenEdit(row)} 
            onDelete={() => setDeletingId(row.id)} 
          />
        ) : null
      ),
      align: "right"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Dynamic Header Block (Format compatible with other master forms in the applet) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
            <Droplet size={24} className="fill-primary/20" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-main">Carga de Combustible</h2>
            <p className="text-xs text-text-muted">Registro y control de litros de gasoil para unidades móviles autorizadas</p>
          </div>
        </div>
        {canEdit && (
          <GlassButton 
            id="add-fuel-load-btn"
            onClick={handleOpenAdd} 
            className="flex items-center gap-2 font-black"
          >
            <Plus size={16} /> Cargar Combustible
          </GlassButton>
        )}
      </div>

      {/* Evolution Line Chart per Mobile Unit */}
      <GlassCard className="p-6 relative overflow-hidden">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main">Evolución de Consumo y Cargas</h3>
          <p className="text-xs text-text-muted">Detalle acumulado en litros de combustible despachados por unidad móvil</p>
        </div>
        {chartData.length > 0 ? (
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
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
                  axisLine={false}
                  unit=" L"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#161920' : '#ffffff', 
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: isDark ? '#f3f4f6' : '#1f2937'
                  }}
                  itemStyle={{ color: isDark ? '#ffffff' : '#111827' }}
                  labelStyle={{ color: isDark ? '#9ca3af' : '#4b5563', fontWeight: 'bold' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: isDark ? '#f3f4f6' : '#111827' }}
                  iconType="circle"
                />
                {uniqueVehiclesInChart.map((v, idx) => (
                  <Line 
                    key={v}
                    type="monotone"
                    dataKey={v}
                    name={v}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1, fill: isDark ? '#161920' : '#ffffff' }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-surface/20">
            <Droplet className="text-text-muted opacity-20 mb-2" size={32} />
            <p className="text-xs text-text-muted">Cargá datos de combustible para visualizar la tendencia histórica</p>
          </div>
        )}
      </GlassCard>

      {/* Main Historical Table */}
      <DataTable
        title="Historial de Cargas del Turno"
        countLabel="cargas"
        columns={columns}
        data={history}
        keyExtractor={(r) => r.id}
        emptyState={{
          icon: <Droplet className="text-text-muted/40" size={48} />,
          title: "Sin registros de combustible",
          description: "No se encontraron cargas de combustible registradas para esta selección de turno o fecha."
        }}
      />

      {/* Fuel Load Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Carga Combustible" : "Registrar Carga Combustible"}>
            <div className="space-y-4">
              <GlassSelect
                id="fuel-vehicle-select"
                label="Unidad Móvil (Identificación)*"
                options={vehicleOptions}
                value={formData.unidad_movil}
                onChange={(e: any) => setFormData({ ...formData, unidad_movil: e.target.value })}
                required
              />

              {vehicleOptions.length === 0 && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-500">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-left">No hay vehículos creados en la sección 'Vehículos' del menú Maestros de Administrador.</span>
                </div>
              )}

              <GlassInput
                id="fuel-liters-input"
                label="Litros de Combustible*"
                type="number"
                value={formData.litros_combustible || ''}
                onChange={(e: any) => setFormData({ ...formData, litros_combustible: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
                min="0.1"
                step="0.1"
                required
              />

              <div className="flex gap-3 pt-4">
                <GlassButton 
                  variant="secondary" 
                  className="flex-1" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </GlassButton>
                <GlassButton 
                  className="flex-1" 
                  onClick={handleSave} 
                  disabled={vehicleOptions.length === 0}
                >
                  <Save size={16} /> Grabar
                </GlassButton>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingId}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro de combustible de las planillas? Esta acción es irreversible."
        onConfirm={() => {
          if (deletingId) {
            onDelete(deletingId);
            setDeletingId(null);
          }
        }}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}
