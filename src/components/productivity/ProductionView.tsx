import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, History, Pencil, TrendingUp, Filter, BarChart3, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal, Modal } from '../ui/GlassUI';
import { DataTable, Column } from '../ui/DataTable';
import { MasterData, ProductionReport, NozzleNews } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  masters: MasterData;
  onSave: (report: any) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: ProductionReport[];
}

export default function ProductionView({ masters, onSave, onDelete, palletizerId, shiftId, selectedDate, history }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Local form state
  const [formData, setFormData] = useState({ 
    baggerId: '', 
    materialId: '', 
    tons: '',
    availableNozzlesShift: '',
    bagProvider: '',
    discardedBagsBagger: '',
    notNozzledBags: '',
    discardedBagsVentocheck: '',
    discardedBagsTransport: '',
    nozzleNews: [] as NozzleNews[]
  });

  // Local state for adding nozzle news
  const [tempNews, setTempNews] = useState({
    nozzleNumber: '',
    startTime: '',
    endTime: '',
    isAllShift: false,
    observation: ''
  });

  const selectedShiftObj = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId), 
    [masters.shifts, shiftId]
  );

  const selectedBaggerObj = useMemo(() => 
    masters.baggers.find(b => b.id === formData.baggerId),
    [masters.baggers, formData.baggerId]
  );

  // Calculate Global Summary (Automated)
  const totals = useMemo(() => {
    const totalTons = history.reduce((sum, r) => sum + r.tonsProduced, 0);
    const count = history.length;
    return { totalTons, count };
  }, [history]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({ 
      baggerId: '', 
      materialId: '', 
      tons: '',
      availableNozzlesShift: '',
      bagProvider: '',
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      nozzleNews: []
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ProductionReport) => {
    setEditingItem(item);
    setFormData({ 
      baggerId: item.baggerId, 
      materialId: item.materialId, 
      tons: item.tonsProduced.toString(),
      availableNozzlesShift: item.availableNozzlesShift?.toString() || '',
      bagProvider: item.bagProvider || '',
      discardedBagsBagger: item.discardedBagsBagger?.toString() || '0',
      notNozzledBags: item.notNozzledBags?.toString() || '0',
      discardedBagsVentocheck: item.discardedBagsVentocheck?.toString() || '0',
      discardedBagsTransport: item.discardedBagsTransport?.toString() || '0',
      nozzleNews: item.nozzleNews || []
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setIsModalOpen(true);
  };

  const addNozzleNews = () => {
    if (!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))) return;
    
    const news: NozzleNews = {
      id: Math.random().toString(36).substr(2, 9),
      nozzleNumber: parseInt(tempNews.nozzleNumber),
      startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '') : tempNews.startTime,
      endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '') : tempNews.endTime,
      isAllShift: tempNews.isAllShift,
      observation: tempNews.observation
    };

    setFormData(prev => ({
      ...prev,
      nozzleNews: [...prev.nozzleNews, news]
    }));

    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
  };

  const removeNozzleNews = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nozzleNews: prev.nozzleNews.filter(n => n.id !== id)
    }));
  };

  const handleSave = () => {
    if (!formData.baggerId || !formData.materialId || !formData.tons || !palletizerId || !shiftId) return;
    
    // Calculate BDP
    const bdp = masters.capacities.find((c: any) => 
      c.baggerId === formData.baggerId && 
      c.palletizerId === palletizerId && 
      c.materialId === formData.materialId
    )?.bdp || 100;

    const record = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      date: editingItem?.date || selectedDate,
      shiftId,
      palletizerId,
      baggerId: formData.baggerId,
      materialId: formData.materialId,
      tonsProduced: parseFloat(formData.tons) || 0,
      bdp,
      availableNozzlesShift: parseInt(formData.availableNozzlesShift) || 0,
      bagProvider: formData.bagProvider,
      discardedBagsBagger: parseInt(formData.discardedBagsBagger) || 0,
      notNozzledBags: parseInt(formData.notNozzledBags) || 0,
      discardedBagsVentocheck: parseInt(formData.discardedBagsVentocheck) || 0,
      discardedBagsTransport: parseInt(formData.discardedBagsTransport) || 0,
      nozzleNews: formData.nozzleNews
    };

    onSave(record);
    setIsModalOpen(false);
  };

  const tableColumns: Column<ProductionReport>[] = [
    {
      header: 'Ensacadora / Material',
      accessor: (row) => (
        <div className="py-1">
          <div className="text-[11px] font-bold text-text-main uppercase">
            {masters.baggers.find(b => b.id === row.baggerId)?.name}
          </div>
          <div className="text-[9px] font-bold text-primary uppercase tracking-wider">
            {masters.materials.find(m => m.id === row.materialId)?.name}
          </div>
        </div>
      )
    },
    {
      header: 'Producción',
      align: 'right',
      accessor: (row) => (
        <div className="text-right">
          <div className="text-[11px] font-black text-text-main tabular-nums">
            {row.tonsProduced.toFixed(1)} TN
          </div>
          <div className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">
            BDP: {row.bdp}
          </div>
        </div>
      )
    },
    {
      header: 'Novedades',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          {row.nozzleNews?.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-bold uppercase">
              {row.nozzleNews.length} Nov.
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase">
              OK
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={() => handleOpenEdit(row)}
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={() => setDeletingId(row.id)}
            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  const newsColumns: Column<NozzleNews>[] = [
    {
      header: 'Boquilla',
      accessor: (row) => <span className="font-bold text-text-main">Noz. {row.nozzleNumber}</span>
    },
    {
      header: 'Rango',
      accessor: (row) => (
        <div className="text-[10px] tabular-nums">
          {row.isAllShift ? (
            <span className="font-bold text-primary">TODO EL TURNO</span>
          ) : (
            <span>{row.startTime} - {row.endTime}</span>
          )}
        </div>
      )
    },
    {
      header: '',
      align: 'right',
      accessor: (row) => (
        <button 
          onClick={() => removeNozzleNews(row.id)}
          className="p-1.5 text-text-muted hover:text-red-500 rounded-lg"
        >
          <Trash2 size={12} />
        </button>
      )
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="layout-container py-6 space-y-8"
    >
      {/* Automate Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="bg-surface-elevated p-6 border-l-4 border-l-primary flex items-center justify-between">
          <div>
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">TN TOTALES</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-text-main tracking-tighter tabular-nums">{totals.totalTons.toFixed(1)}</span>
              <span className="text-xs font-bold text-primary uppercase">tn</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <TrendingUp size={24} />
          </div>
        </GlassCard>

        <GlassCard className="bg-surface-elevated p-6 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">REGISTROS</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-text-main tracking-tighter tabular-nums">{totals.count}</span>
              <span className="text-xs font-bold text-emerald-500 uppercase">items</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500">
            <BarChart3 size={24} />
          </div>
        </GlassCard>

        <div className="flex flex-col justify-center">
          <GlassButton 
            onClick={handleOpenAdd}
            className="h-full py-6 md:py-0 text-base shadow-lg shadow-primary/20"
          >
            <Plus size={20} className="mr-2" />
            Agregar Producción
          </GlassButton>
        </div>
      </div>

      {/* Registers Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="text-primary" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">Producciones del Turno</h3>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-tight">Listado detallado de cargas activas</p>
          </div>
        </div>

        <DataTable 
          title=""
          columns={tableColumns}
          data={history}
          keyExtractor={(row) => row.id}
          emptyState={{
            icon: <Package size={32} opacity={0.3} />,
            title: "Sin registros aún",
            description: "Comienza agregando una producción para ver los datos aquí."
          }}
        />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-3xl"
        title={editingItem ? 'Editar Registro Operativo' : 'Nueva Producción Ensacadora'}
      >
        <div className="space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">Información de Carga</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-input/60 p-4 rounded-xl border border-border/50">
              <GlassSelect 
                label="Ensacadora" 
                options={masters.baggers.map((e:any) => ({label: e.name, value: e.id}))} 
                value={formData.baggerId} 
                onChange={e => setFormData({...formData, baggerId: (e.target as HTMLSelectElement).value})} 
              />
              <GlassSelect 
                label="Material" 
                options={masters.materials.map((m:any) => ({label: m.name, value: m.id}))} 
                value={formData.materialId} 
                onChange={e => setFormData({...formData, materialId: (e.target as HTMLSelectElement).value})} 
              />
              <GlassInput 
                label="TN Producidas" 
                type="number" 
                value={formData.tons} 
                onChange={e => setFormData({...formData, tons: (e.target as HTMLInputElement).value})} 
                placeholder="0.00"
              />
              <div className="md:col-span-3">
                 {selectedBaggerObj && (
                   <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
                      <ShieldCheck size={12} className="text-primary" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                        EQUIPO (HAC): {selectedBaggerObj.hacId || 'N/A'} — CAP. TEÓRICA: {selectedBaggerObj.nozzles} BOQUILLAS
                      </span>
                   </div>
                 )}
                 <div className="flex gap-4">
                   <GlassInput 
                    label="Boquillas Disponibles" 
                    type="number" 
                    value={formData.availableNozzlesShift} 
                    onChange={e => setFormData({...formData, availableNozzlesShift: (e.target as HTMLInputElement).value})} 
                    placeholder="Ej: 4"
                  />
                  <GlassInput 
                    label="Proveedor de Bolsa" 
                    value={formData.bagProvider} 
                    onChange={e => setFormData({...formData, bagProvider: e.target.value})} 
                    placeholder="Ej: Mondi"
                  />
                 </div>
              </div>
            </div>
          </div>

          {/* Section 2: Descarte de Bolsas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-orange-500">
              <AlertCircle size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">Descarte de Bolsas</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-bg-input/60 p-4 rounded-xl border border-border/50">
              <GlassInput 
                label="Ensacadora" 
                type="number" 
                value={formData.discardedBagsBagger} 
                onChange={e => setFormData({...formData, discardedBagsBagger: (e.target as HTMLInputElement).value})} 
              />
              <GlassInput 
                label="No Emboquilladas" 
                type="number" 
                value={formData.notNozzledBags} 
                onChange={e => setFormData({...formData, notNozzledBags: (e.target as HTMLInputElement).value})} 
              />
              <GlassInput 
                label="Ventocheck" 
                type="number" 
                value={formData.discardedBagsVentocheck} 
                onChange={e => setFormData({...formData, discardedBagsVentocheck: (e.target as HTMLInputElement).value})} 
              />
              <GlassInput 
                label="Transporte" 
                type="number" 
                value={formData.discardedBagsTransport} 
                onChange={e => setFormData({...formData, discardedBagsTransport: (e.target as HTMLInputElement).value})} 
              />
            </div>
          </div>

          {/* Section 3: Boquillas Fuera de Servicio */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-500">
              <Clock size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">Novedades de Boquillas</h4>
            </div>
            
            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50 space-y-4">
               {/* Quick Add Nozzle News */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <GlassSelect 
                    label="Boquilla" 
                    disabled={!formData.baggerId}
                    options={Array.from({length: selectedBaggerObj?.nozzles || 0}, (_, i) => ({label: `Boquilla ${i+1}`, value: (i+1).toString()}))}
                    value={tempNews.nozzleNumber}
                    onChange={e => setTempNews({...tempNews, nozzleNumber: (e.target as HTMLSelectElement).value})}
                  />
                  <div className="md:col-span-2 flex items-center gap-2">
                     <div className="flex-1">
                        <GlassInput 
                          label="Inicio" 
                          type="time" 
                          disabled={tempNews.isAllShift}
                          value={tempNews.startTime}
                          onChange={e => setTempNews({...tempNews, startTime: e.target.value})}
                        />
                     </div>
                     <div className="flex-1">
                        <GlassInput 
                          label="Fin" 
                          type="time" 
                          disabled={tempNews.isAllShift}
                          value={tempNews.endTime}
                          onChange={e => setTempNews({...tempNews, endTime: e.target.value})}
                        />
                     </div>
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                     <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={tempNews.isAllShift}
                          onChange={e => setTempNews({...tempNews, isAllShift: e.target.checked})}
                          className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/20"
                        />
                        <span className="text-[10px] font-bold text-text-muted group-hover:text-text-main transition-colors">TODO EL TURNO</span>
                     </label>
                     <button 
                        onClick={addNozzleNews}
                        disabled={!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))}
                        className="p-2.5 bg-primary/10 text-primary hover:bg-primary rounded-lg hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                     >
                        <Plus size={16} />
                     </button>
                  </div>
               </div>

               {/* Current Nozzle News List */}
               {formData.nozzleNews.length > 0 && (
                 <div className="border border-border/30 rounded-lg overflow-hidden">
                    <DataTable 
                      title=""
                      columns={newsColumns}
                      data={formData.nozzleNews}
                      keyExtractor={r => r.id}
                    />
                 </div>
               )}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex gap-3">
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
              disabled={!formData.baggerId || !formData.materialId || !formData.tons}
            >
              {editingItem ? 'Actualizar Reporte' : 'Guardar Reporte Operativo'}
            </GlassButton>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && onDelete(deletingId)}
        title="Confirmar eliminación"
        message="¿Estás seguro de eliminar este registro de producción? El total global se recalculará automáticamente."
      />
    </motion.div>
  );
}
