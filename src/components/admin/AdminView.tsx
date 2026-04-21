import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Settings, Search, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { MasterData, Shift } from '../../types';
import { cn } from '../../lib/utils';
import { DataTable, Column } from '../ui/DataTable';
import { ConfirmModal, GlassButton, GlassInput, GlassSelect } from '../ui/GlassUI';

interface Props {
  masters: MasterData;
  activeTab: 'SHIFTS' | 'MACHINES' | 'HACS' | 'CAUSES' | 'CAPACITIES' | any;
  onTabChange: (tab: any) => void;
  onUpdateMasters: (type: string, data: any[]) => void;
}

export default function AdminView({ masters, activeTab, onTabChange, onUpdateMasters }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeBtn) {
        const container = scrollRef.current;
        const scrollLeft = activeBtn.offsetLeft - (container.offsetWidth / 2) + (activeBtn.offsetWidth / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  const getCurrentList = () => {
    if (activeTab === 'SHIFTS') return masters.shifts;
    if (activeTab === 'MACHINES') return masters.palletizers;
    if (activeTab === 'BAGGERS') return masters.baggers;
    if (activeTab === 'HACS') return masters.hacs;
    if (activeTab === 'CAUSES') return masters.causes;
    if (activeTab === 'CAPACITIES') return masters.capacities;
    return [];
  };

  const filteredData = useMemo(() => {
    const list = getCurrentList();
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      )
    );
  }, [masters, activeTab, searchTerm]);

  const handleDelete = () => {
    if (!deletingId) return;
    const list = getCurrentList() as any[];
    let newList;
    if (activeTab === 'CAPACITIES') {
      newList = list.filter(i => `${i.palletizerId}-${i.baggerId}-${i.materialId}` !== deletingId);
    } else {
      newList = list.filter(i => i.id !== deletingId);
    }
    onUpdateMasters(activeTab, newList);
    setDeletingId(null);
  };

  const handleSave = (item: any) => {
    const list = getCurrentList() as any[];
    let newList;
    const isEdit = activeTab === 'CAPACITIES' 
      ? list.some(i => `${i.palletizerId}-${i.baggerId}-${i.materialId}` === `${item.palletizerId}-${item.baggerId}-${item.materialId}`)
      : list.some(i => i.id === item.id);

    if (isEdit) {
      if (activeTab === 'CAPACITIES') {
        newList = list.map(i => `${i.palletizerId}-${i.baggerId}-${i.materialId}` === `${item.palletizerId}-${item.baggerId}-${item.materialId}` ? item : i);
      } else {
        newList = list.map(i => i.id === item.id ? item : i);
      }
    } else {
      newList = [item, ...list];
    }
    onUpdateMasters(activeTab, newList);
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const actionsColumn = (row: any): Column<any> => ({
    header: 'Acciones',
    align: 'right',
    accessor: (r) => (
      <div className="flex items-center justify-end gap-1">
        <button 
          onClick={() => { setEditingItem(r); setIsFormOpen(true); }}
          className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
        >
          <Pencil size={14} />
        </button>
        <button 
          onClick={() => {
            const id = activeTab === 'CAPACITIES' ? `${r.palletizerId}-${r.baggerId}-${r.materialId}` : r.id;
            setDeletingId(id);
          }}
          className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  });

  const shiftColumns: Column<any>[] = [
    { header: 'ID', accessor: (row) => <span className="font-mono text-text-muted">{row.id}</span> },
    { header: 'Nombre', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'Inicio', accessor: 'startTime' },
    { header: 'Fin', accessor: 'endTime' },
    { header: 'Hs', accessor: (row) => <span className="font-bold text-primary">{row.durationHours}H</span> },
    actionsColumn(null)
  ];

  const machineColumns: Column<any>[] = [
    { header: 'ID', accessor: (row) => <span className="font-mono text-text-muted">{row.id}</span> },
    { header: 'Descripción', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'HAC ID', accessor: 'hacId' },
    actionsColumn(null)
  ];

  const baggerColumns: Column<any>[] = [
    { header: 'Descripción', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'HAC', accessor: 'hacId' },
    { header: 'Boquillas', accessor: (row) => <span className="font-bold text-primary">{row.nozzles}</span> },
    actionsColumn(null)
  ];

  const hacColumns: Column<any>[] = [
    { header: 'ID', accessor: (row) => <span className="font-mono text-text-muted">{row.id}</span> },
    { header: 'Detalle', accessor: (row) => <span className="font-bold text-text-main uppercase">{row.detail}</span> },
    { header: 'GPO', accessor: 'gpoCodObjeto' },
    actionsColumn(null)
  ];

  const causeColumns: Column<any>[] = [
    { header: 'ID', accessor: (row) => <span className="font-mono text-text-muted">{row.id}</span> },
    { header: 'Causa', accessor: (row) => <span className="font-bold text-text-main uppercase leading-none">{row.text}</span> },
    { header: 'Tipo', accessor: (row) => (
      <span className={cn(
        "px-2 py-0.5 rounded text-[9px] font-bold border uppercase",
        row.stopType === 'INTERNO' ? "border-primary/20 text-primary bg-primary/5" : "border-emerald-500/20 text-emerald-500 bg-emerald-500/5"
      )}>
        {row.stopType}
      </span>
    )},
    actionsColumn(null)
  ];

  const capacityColumns: Column<any>[] = [
    { header: 'Ensacadora', accessor: 'baggerId' },
    { header: 'Material', accessor: 'materialId' },
    { header: 'BDP', accessor: (row) => <span className="font-black text-text-main">{row.bdp}</span> },
    actionsColumn(null)
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="layout-container py-8 relative"
    >
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="text-primary" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-main tracking-tight uppercase">Gestión de Maestros</h3>
              <p className="text-xs text-text-muted font-medium">Configuración centralizada de catálogos y sistemas.</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
            
            <div 
              ref={scrollRef}
              className="flex bg-surface p-1.5 rounded-2xl border border-border overflow-x-auto gap-1 no-scrollbar select-none min-w-0 shadow-sm scroll-smooth px-6"
            >
               <AdminSubTab active={activeTab === 'SHIFTS'} onClick={() => onTabChange('SHIFTS')} label="Turnos" />
               <AdminSubTab active={activeTab === 'MACHINES'} onClick={() => onTabChange('MACHINES')} label="Maquinas" />
               <AdminSubTab active={activeTab === 'BAGGERS'} onClick={() => onTabChange('BAGGERS')} label="Ensacadoras" />
               <AdminSubTab active={activeTab === 'HACS'} onClick={() => onTabChange('HACS')} label="Equipos" />
               <AdminSubTab active={activeTab === 'CAUSES'} onClick={() => onTabChange('CAUSES')} label="Causas" />
               <AdminSubTab active={activeTab === 'CAPACITIES'} onClick={() => onTabChange('CAPACITIES')} label="Capacidades" />
            </div>
          </div>
       </div>

       <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en maestros..." 
                  className="w-full h-10 bg-bg border border-border rounded-lg pl-10 pr-4 text-sm text-text-main focus:border-primary/50 outline-none transition-all"
                />
             </div>
             <button 
               onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
               className="h-10 px-4 bg-primary text-white rounded-lg font-semibold text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-sm"
             >
                <Plus size={16} /> Nuevo Registro
             </button>
          </div>

          <div className="max-h-[600px] overflow-auto no-scrollbar">
            {activeTab === 'SHIFTS' && <DataTable title="Listado de Turnos" countLabel="turnos" columns={shiftColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'MACHINES' && <DataTable title="Listado de Maquinas" countLabel="equipos" columns={machineColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'BAGGERS' && <DataTable title="Listado de Ensacadoras" countLabel="ensacadoras" columns={baggerColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'HACS' && <DataTable title="Listado de Equipos (HAC)" countLabel="items" columns={hacColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'CAUSES' && <DataTable title="Catálogo de Causas" countLabel="registros" columns={causeColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'CAPACITIES' && <DataTable title="Matriz de Capacidades" countLabel="combinaciones" columns={capacityColumns} data={filteredData} keyExtractor={r => `${r.palletizerId}-${r.baggerId}-${r.materialId}`} />}
          </div>
       </div>

       <ConfirmModal 
         isOpen={!!deletingId}
         title="Confirmar eliminación"
         message="¿Querés eliminar este registro? Esta acción no se puede deshacer."
         onClose={() => setDeletingId(null)}
         onConfirm={handleDelete}
       />

       {isFormOpen && (
         <MasterFormModal 
           type={activeTab}
           item={editingItem}
           onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
           onSave={handleSave}
           masters={masters}
         />
       )}
    </motion.div>
  );
}

function MasterFormModal({ type, item, onClose, onSave, masters }: any) {
  const [formData, setFormData] = useState<any>(item || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalData = { ...formData };
    if (type === 'BAGGERS' && !finalData.id) {
       finalData.id = 'PSC-' + Math.random().toString(36).substr(2, 4).toUpperCase();
       finalData.type = 'ENSACADORA';
    }
    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">{item ? 'Editar' : 'Nuevo'} {type}</h3>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassInput 
                label="ID" 
                value={formData.id || ''} 
                onChange={(e:any) => setFormData({...formData, id: e.target.value})} 
                disabled={!!item}
                placeholder="ID único"
              />
              
              {type === 'SHIFTS' && (
                <>
                  <GlassInput label="Nombre" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  <GlassInput label="Inicio" type="time" value={formData.startTime || ''} onChange={(e:any) => setFormData({...formData, startTime: e.target.value})} />
                  <GlassInput label="Fin" type="time" value={formData.endTime || ''} onChange={(e:any) => setFormData({...formData, endTime: e.target.value})} />
                  <GlassInput label="Horas" type="number" value={formData.durationHours || ''} onChange={(e:any) => setFormData({...formData, durationHours: parseFloat(e.target.value)})} />
                </>
              )}

              {type === 'MACHINES' && (
                <>
                  <GlassInput label="Descripción" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  <GlassInput label="HAC ID" value={formData.hacId || ''} onChange={(e:any) => setFormData({...formData, hacId: e.target.value})} />
                </>
              )}

              {type === 'BAGGERS' && (
                <>
                  <GlassInput label="Descripción" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  <GlassInput label="HAC ID" value={formData.hacId || ''} onChange={(e:any) => setFormData({...formData, hacId: e.target.value})} />
                  <GlassInput label="Boquillas" type="number" value={formData.nozzles || ''} onChange={(e:any) => setFormData({...formData, nozzles: parseInt(e.target.value)})} />
                  {!item && (
                    <div className="md:col-span-2 py-2 px-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">ID Interno se generará automáticamente</p>
                    </div>
                  )}
                </>
              )}

              {type === 'HACS' && (
                <>
                  <GlassInput label="Detalle" value={formData.detail || ''} onChange={(e:any) => setFormData({...formData, detail: e.target.value})} />
                  <GlassInput label="GPO" value={formData.gpoCodObjeto || ''} onChange={(e:any) => setFormData({...formData, gpoCodObjeto: e.target.value})} />
                </>
              )}

              {type === 'CAUSES' && (
                <>
                  <GlassInput label="Causa" value={formData.text || ''} onChange={(e:any) => setFormData({...formData, text: e.target.value})} />
                  <GlassSelect 
                    label="Tipo" 
                    options={[{label: 'INTERNO', value: 'INTERNO'}, {label: 'EXTERNO', value: 'EXTERNO'}]} 
                    value={formData.stopType || ''} 
                    onChange={(e:any) => setFormData({...formData, stopType: e.target.value})}
                  />
                  <GlassSelect 
                    label="Equipo (HAC)" 
                    options={masters.hacs.map((h:any) => ({label: h.detail, value: h.id}))} 
                    value={formData.hacId || ''} 
                    onChange={(e:any) => setFormData({...formData, hacId: e.target.value})}
                  />
                </>
              )}

              {type === 'CAPACITIES' && (
                <>
                  <GlassSelect label="Paletizadora" options={masters.palletizers.map((p:any) => ({label: p.name, value: p.id}))} value={formData.palletizerId || ''} onChange={(e:any) => setFormData({...formData, palletizerId: e.target.value})} />
                  <GlassSelect label="Ensacadora" options={masters.baggers.map((b:any) => ({label: b.name, value: b.id}))} value={formData.baggerId || ''} onChange={(e:any) => setFormData({...formData, baggerId: e.target.value})} />
                  <GlassSelect label="Material" options={masters.materials.map((m:any) => ({label: m.name, value: m.id}))} value={formData.materialId || ''} onChange={(e:any) => setFormData({...formData, materialId: e.target.value})} />
                  <GlassInput label="BDP" type="number" value={formData.bdp || ''} onChange={(e:any) => setFormData({...formData, bdp: parseFloat(e.target.value)})} />
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <GlassButton variant="secondary" className="flex-1" onClick={onClose} type="button">Cancelar</GlassButton>
              <GlassButton className="flex-1" type="submit">
                <Save size={18} /> Guardar
              </GlassButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function AdminSubTab({ active, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      data-active={active}
      className={cn(
        "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shrink-0",
        active 
          ? "bg-primary/10 text-primary shadow-sm" 
          : "text-text-muted hover:text-text-main hover:bg-bg"
      )}
    >
      {label}
    </button>
  );
}
