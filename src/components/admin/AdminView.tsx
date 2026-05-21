import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Settings, Search, Plus, Pencil, Trash2, X, Save, FileUp, ChevronLeft, ChevronRight, User as UserIcon, Shield, LogIn } from 'lucide-react';
import { MasterData, Shift, HAC, Cause, AppUser, UserPermission } from '../../types';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { ConfirmModal, GlassButton, GlassInput, GlassSelect } from '../ui/GlassUI';
import { SYSTEM_VIEWS } from '../../lib/mockData';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  activeTab: 'SHIFTS' | 'MACHINES' | 'HACS' | 'CAUSES' | 'CAPACITIES' | any;
  onTabChange: (tab: any) => void;
  onUpdateMasters: (type: string, data: any[]) => void;
  onUserSwitch?: (dni: string) => void;
}

export default function AdminView({ masters, currentUser, activeTab, onTabChange, onUpdateMasters, onUserSwitch }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canView = (viewId: string) => {
    const perm = currentUser.permissions.find(p => p.viewId === viewId);
    return perm ? perm.level !== 'NONE' : false;
  };

  const tabMapping: Record<string, string> = {
    'SHIFTS': 'TURNOS',
    'MACHINES': 'PALETIZADORAS',
    'BAGGERS': 'EMBOLSADORAS',
    'EQUIPOS': 'EQUIPOS',
    'HACS': 'EQUIPOS',
    'CAUSES': 'CAUSAS',
    'MATERIALS': 'MATERIALES',
    'CAPACITIES': 'CAPACIDADES',
    'USERS': 'USUARIOS',
    'COMPANIES': 'EMPRESAS',
    'LOADING_POINTS': 'PUNTOS_CARGA',
    'PUNTOS_CARGA': 'PUNTOS_CARGA'
  };

  const isVisible = (tab: string) => canView(tabMapping[tab] || tab);

  const isEditable = useMemo(() => {
    const sectionId = tabMapping[activeTab] || activeTab;
    const perm = currentUser.permissions.find(p => p.viewId === sectionId);
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser, activeTab]);

  useEffect(() => {
    if (!isVisible(activeTab)) {
        const firstVisible = ['SHIFTS', 'MACHINES', 'BAGGERS', 'HACS', 'CAUSES', 'MATERIALS', 'CAPACITIES', 'USERS'].find(t => isVisible(t));
        if (firstVisible) onTabChange(firstVisible);
    }
  }, [currentUser, activeTab]);

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
    if (activeTab === 'MATERIALS') return masters.materials;
    if (activeTab === 'CAPACITIES') return masters.capacities;
    if (activeTab === 'USERS') return masters.users;
    if (activeTab === 'COMPANIES') return masters.companies;
    if (activeTab === 'PUNTOS_CARGA' || activeTab === 'LOADING_POINTS') return masters.loadingPoints;
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
    } else if (activeTab === 'USERS') {
      newList = list.filter(i => i.dni !== deletingId);
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
      : activeTab === 'USERS'
        ? list.some(i => i.dni === item.dni)
        : list.some(i => i.id === item.id);

    if (isEdit) {
      if (activeTab === 'CAPACITIES') {
        newList = list.map(i => `${i.palletizerId}-${i.baggerId}-${i.materialId}` === `${item.palletizerId}-${item.baggerId}-${item.materialId}` ? item : i);
      } else if (activeTab === 'USERS') {
        newList = list.map(i => i.dni === item.dni ? item : i);
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

  const actionsColumn = (row?: any): Column<any> => ({
    header: 'Acciones',
    align: 'right',
    accessor: (r) => isEditable ? (
      <TableActions 
        onEdit={() => { setEditingItem(r); setIsFormOpen(true); }}
        onDelete={() => {
          let id = r.id;
          if (activeTab === 'CAPACITIES') id = `${r.palletizerId}-${r.baggerId}-${r.materialId}`;
          if (activeTab === 'USERS') id = r.dni;
          setDeletingId(id);
        }}
      />
    ) : (
      <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">Lectura</span>
    )
  });

  const shiftColumns: Column<any>[] = [
    { header: 'Nombre', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'Inicio', accessor: 'startTime' },
    { header: 'Fin', accessor: 'endTime' },
    { header: 'Hs', accessor: (row) => <span className="font-bold text-primary">{row.durationHours}H</span> },
    actionsColumn()
  ];

  const machineColumns: Column<any>[] = [
    { header: 'Descripción', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'HAC ID', accessor: 'hacId' },
    { 
      header: 'P. MUESTREO', 
      align: 'center',
      accessor: (row) => row.isSamplingPoint ? (
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)] mx-auto" />
      ) : null
    },
    actionsColumn()
  ];

  const baggerColumns: Column<any>[] = [
    { header: 'Descripción', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'HAC', accessor: 'hacId' },
    { header: 'Boquillas', accessor: (row) => <span className="font-bold text-primary">{row.nozzles}</span> },
    actionsColumn()
  ];

  const hacColumns: Column<any>[] = [
    { header: 'HAC', accessor: (row) => <span className="font-bold text-primary">{row.hac}</span> },
    { header: 'Detalle', accessor: (row) => <span className="font-bold text-text-main uppercase">{row.detail}</span> },
    { header: 'GPO Cód. Objeto', accessor: 'gpoCodObjeto' },
    { header: 'Equipo', accessor: 'equipment' },
    { 
      header: 'Ctrl F/B', 
      align: 'center',
      accessor: (row) => (
        <div className="flex justify-center gap-1.5">
          {row.isDater && (
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" title="Fechador" />
          )}
          {row.isScale && (
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse" title="Balanza" />
          )}
        </div>
      )
    },
    actionsColumn()
  ];

  const causeColumns: Column<any>[] = [
    { header: 'HAC', accessor: (row) => <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{row.hac}</span> },
    { header: 'Texto de Causa', accessor: (row) => <span className="font-bold text-text-main uppercase leading-tight block max-w-[200px] truncate">{row.text}</span> },
    { header: 'Tipo', accessor: (row) => (
      <span className={cn(
        "px-2 py-0.5 rounded text-[9px] font-bold border uppercase",
        row.stopType === 'INTERNO' ? "border-primary/20 text-primary bg-primary/5" : "border-emerald-500/20 text-emerald-500 bg-emerald-500/5"
      )}>
        {row.stopType}
      </span>
    )},
    { header: 'PARTE/CAUSA SAP', accessor: (row) => <span className="text-[9px] font-mono opacity-70">P: {row.partObject} / C: {row.causeCode}</span> },
    actionsColumn()
  ];

  const materialColumns: Column<any>[] = [
    { header: 'Descripción', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'Código SAP', accessor: 'code' },
    { header: 'P. Embalaje', accessor: (row) => <span className="font-mono text-[10px]">{row.packingWeight}kg</span> },
    { header: 'P. Bolsa', accessor: (row) => <span className="font-mono text-[10px]">{row.bagWeight}kg</span> },
    { header: 'Atributos', accessor: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.isPallet && <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 py-0.5 rounded text-[8px] font-bold">PALLET</span>}
        {row.isProductive && <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1 py-0.5 rounded text-[8px] font-bold">PROD</span>}
        {row.isSupply && <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1 py-0.5 rounded text-[8px] font-bold">INSUMO</span>}
        {row.isBigBag && <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 py-0.5 rounded text-[8px] font-bold">BIGBAG</span>}
      </div>
    )},
    actionsColumn()
  ];

  const capacityColumns: Column<any>[] = [
    { header: 'Paletizadora', accessor: (row) => masters.palletizers.find(p => p.id === row.palletizerId)?.name || 'N/A' },
    { header: 'Ensacadora', accessor: (row) => masters.baggers.find(b => b.id === row.baggerId)?.name || 'N/A' },
    { header: 'Material', accessor: (row) => masters.materials.find(m => m.id === row.materialId)?.name || 'N/A' },
    { header: 'BDP', accessor: (row) => <span className="font-black text-text-main">{row.bdp} TN/H</span> },
    actionsColumn()
  ];

  const companyColumns: Column<any>[] = [
    { header: 'Empresa', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'CUIT', accessor: 'taxId' },
    { header: 'Dirección', accessor: (row) => <span className="text-[10px] opacity-70">{row.address}</span> },
    actionsColumn()
  ];

  const loadingPointColumns: Column<any>[] = [
    { header: 'Punto de Carga', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'Tipo', accessor: (row) => (
      <span className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
        row.type === 'BOLSA' ? "border-blue-500/20 text-blue-500 bg-blue-500/5" : "border-amber-500/20 text-amber-500 bg-amber-500/5"
      )}>
        {row.type}
      </span>
    )},
    actionsColumn()
  ];

  const userColumns: Column<AppUser>[] = [
    { header: 'DNI / Legajo', accessor: 'dni' },
    { header: 'Nombre', accessor: (row) => <span className="font-bold text-text-main">{row.name}</span> },
    { header: 'Usuario RED / SAP', accessor: 'sapUser' },
    { header: 'Email', accessor: (row) => <span className="text-[10px] opacity-70">{row.email}</span> },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => (
        <div className="flex items-center gap-2 justify-end">
          <button 
            onClick={() => onUserSwitch?.(row.dni)}
            title="Simular Login"
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              currentUser.dni === row.dni 
                ? "bg-primary text-white" 
                : "bg-surface text-text-muted hover:text-primary border border-border"
            )}
          >
            <LogIn size={14} />
          </button>
          <TableActions 
            onEdit={() => { setEditingItem(row); setIsFormOpen(true); }}
            onDelete={() => setDeletingId(row.dni)}
          />
        </div>
      )
    }
  ];

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      processImportedData(data);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const processImportedData = (data: any[]) => {
    const list = getCurrentList() as any[];
    const newList = [...list];

    data.forEach(row => {
      let item: any = {};
      
      if (activeTab === 'HACS') {
        item = {
          id: `HAC-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ''),
          detail: String(row['Detalle HAC'] || row.detail || ''),
          gpoCodObjeto: String(row['GPO.CÓD. OBJETO'] || row.gpoCodObjeto || ''),
          equipment: String(row.EQUIPO || row.equipment || ''),
          isDater: !!(row['Control Fechador?'] || row.isDater),
          isScale: !!(row['Control Balanza?'] || row.isScale)
        };
      } else if (activeTab === 'CAUSES') {
        item = {
          id: `PARO-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ''),
          text: String(row['TEXTO DE CAUSA'] || row.text || ''),
          partObject: String(row['PARTE OBJETO'] || row.partObject || ''),
          symptomGroup: String(row['GPO.CÓD. SINTOMA'] || row.symptomGroup || ''),
          symptomCode: String(row['CÓD. SINTOMA'] || row.symptomCode || ''),
          sapCause: String(row['CAUSA SAP'] || row.sapCause || ''),
          causeGroup: String(row['GPO.COD. CAUSA'] || row.causeGroup || ''),
          causeCode: String(row['CÓDIGO CAUSA'] || row.causeCode || ''),
          stopType: (String(row['TIPO PARO'] || row.stopType || '').toUpperCase() === 'EXTERNO' ? 'EXTERNO' : 'INTERNO')
        };
      } else {
        // Basic generic mapping for other tabs if they want to try
        item = { ...row };
        if (!item.id) item.id = Math.random().toString(36).substr(2, 6).toUpperCase();
      }

      if (item.id) newList.push(item);
    });

    onUpdateMasters(activeTab, newList);
  };

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
          
          <div className="relative group overflow-hidden">
            {/* Carousel Arrows - Only visible on desktop hover */}
            <div className="absolute inset-y-0 left-0 items-center pl-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
                  }
                }}
                className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
            
            <div className="absolute inset-y-0 right-0 items-center pr-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
                  }
                }}
                className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Carousel edge masks */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
            
            <div 
              ref={scrollRef}
              className="flex bg-bg-input/50 p-1.5 rounded-2xl border border-border overflow-x-auto gap-1 no-scrollbar select-none min-w-0 shadow-sm scroll-smooth px-6"
            >
               {isVisible('SHIFTS') && <AdminSubTab active={activeTab === 'SHIFTS'} onClick={() => onTabChange('SHIFTS')} label="Turnos" />}
               {isVisible('MACHINES') && <AdminSubTab active={activeTab === 'MACHINES'} onClick={() => onTabChange('MACHINES')} label="Maquinas" />}
               {isVisible('BAGGERS') && <AdminSubTab active={activeTab === 'BAGGERS'} onClick={() => onTabChange('BAGGERS')} label="Ensacadoras" />}
               {isVisible('HACS') && <AdminSubTab active={activeTab === 'HACS'} onClick={() => onTabChange('HACS')} label="Equipos" />}
               {isVisible('CAUSES') && <AdminSubTab active={activeTab === 'CAUSES'} onClick={() => onTabChange('CAUSES')} label="Causas" />}
               {isVisible('MATERIALS') && <AdminSubTab active={activeTab === 'MATERIALS'} onClick={() => onTabChange('MATERIALS')} label="Materiales" />}
               {isVisible('CAPACITIES') && <AdminSubTab active={activeTab === 'CAPACITIES'} onClick={() => onTabChange('CAPACITIES')} label="Capacidades" />}
               {isVisible('USERS') && <AdminSubTab active={activeTab === 'USERS'} onClick={() => onTabChange('USERS')} label="Usuarios" />}
               {isVisible('COMPANIES') && <AdminSubTab active={activeTab === 'COMPANIES'} onClick={() => onTabChange('COMPANIES')} label="Empresas" />}
               {isVisible('PUNTOS_CARGA') && <AdminSubTab active={activeTab === 'PUNTOS_CARGA'} onClick={() => onTabChange('PUNTOS_CARGA')} label="Puntos Carga" />}
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
                  className="w-full h-10 bg-bg-input border border-border rounded-lg pl-10 pr-4 text-sm text-text-main focus:border-primary/50 outline-none transition-all"
                />
             </div>
             <div className="flex items-center gap-2">
                <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept=".xlsx, .xls" 
                   onChange={handleExcelImport}
                />
                {isEditable && (
                  <>
                    {(activeTab === 'HACS' || activeTab === 'CAUSES') && (
                      <GlassButton 
                        variant="secondary" 
                        className="h-10 px-4" 
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp size={16} /> Importar Excel
                      </GlassButton>
                    )}
                    <button 
                      onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
                      className="h-10 px-4 bg-primary text-white rounded-lg font-semibold text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-sm"
                    >
                        <Plus size={16} /> Nuevo Registro
                    </button>
                  </>
                )}
             </div>
          </div>

          <div className="max-h-[600px] overflow-auto no-scrollbar">
            {activeTab === 'SHIFTS' && <DataTable title="Listado de Turnos" countLabel="turnos" columns={shiftColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'MACHINES' && <DataTable title="Listado de Maquinas" countLabel="equipos" columns={machineColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'BAGGERS' && <DataTable title="Listado de Ensacadoras" countLabel="ensacadoras" columns={baggerColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'HACS' && <DataTable title="Listado de Equipos (HAC)" countLabel="items" columns={hacColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'CAUSES' && <DataTable title="Catálogo de Causas" countLabel="registros" columns={causeColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'MATERIALS' && <DataTable title="Listado de Materiales" countLabel="materiales" columns={materialColumns} data={filteredData} keyExtractor={r => r.id} />}
            {activeTab === 'CAPACITIES' && <DataTable title="Matriz de Capacidades" countLabel="combinaciones" columns={capacityColumns} data={filteredData} keyExtractor={r => `${r.palletizerId}-${r.baggerId}-${r.materialId}`} />}
            {activeTab === 'USERS' && <DataTable title="Base de Usuarios" countLabel="usuarios" columns={userColumns} data={filteredData} keyExtractor={r => r.dni} />}
            {activeTab === 'COMPANIES' && <DataTable title="Datos de Empresa" countLabel="sedes" columns={companyColumns} data={filteredData} keyExtractor={r => r.id} />}
            {(activeTab === 'PUNTOS_CARGA' || activeTab === 'LOADING_POINTS') && <DataTable title="Puntos de Carga" countLabel="puntos" columns={loadingPointColumns} data={filteredData} keyExtractor={r => r.id} />}
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
  const [formData, setFormData] = useState<any>(item || { 
    permissions: SYSTEM_VIEWS.map(v => ({
      viewId: v.id,
      label: v.label,
      section: v.section,
      level: 'NONE'
    }))
  });

  const typeNames: Record<string, { name: string; female?: boolean }> = {
    'SHIFTS': { name: 'Turno', female: false },
    'MACHINES': { name: 'Maquina', female: true },
    'BAGGERS': { name: 'Ensacadora', female: true },
    'HACS': { name: 'Equipo', female: false },
    'CAUSES': { name: 'Causa', female: true },
    'MATERIALS': { name: 'Material', female: false },
    'CAPACITIES': { name: 'Capacidad', female: true },
    'USERS': { name: 'Usuario', female: false },
    'COMPANIES': { name: 'Empresa', female: true },
    'PUNTOS_CARGA': { name: 'Punto de Carga', female: false },
    'LOADING_POINTS': { name: 'Punto de Carga', female: false }
  };

  const config = typeNames[type] || { name: type, female: false };
  const title = item 
    ? `Editar ${config.name}` 
    : `Nuev${config.female ? 'a' : 'o'} ${config.name}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalData = { ...formData };
    
    // Auto-generate ID if missing for all types
    if (!finalData.id && type !== 'USERS') {
       const prefix = (type === 'CAPACITIES' ? 'CAP' : type.substring(0, 3).toUpperCase());
       finalData.id = `${prefix}-` + Math.random().toString(36).substr(2, 4).toUpperCase();
       if (type === 'BAGGERS') finalData.type = 'ENSACADORA';
    }
    
    // For users, we use DNI as ID if needed but essentially DNI is the key
    
    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden z-[201]",
          type === 'USERS' ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-lg"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <input 
                      type="checkbox" 
                      id="isSamplingPoint"
                      checked={formData.isSamplingPoint || false} 
                      onChange={(e) => setFormData({...formData, isSamplingPoint: e.target.checked})}
                      className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                    />
                    <label htmlFor="isSamplingPoint" className="text-[10px] font-bold uppercase cursor-pointer">Es Punto de Muestreo?</label>
                  </div>
                </>
              )}

              {type === 'BAGGERS' && (
                <>
                  <GlassInput label="Descripción" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  <GlassInput label="HAC ID" value={formData.hacId || ''} onChange={(e:any) => setFormData({...formData, hacId: e.target.value})} />
                  <GlassInput label="Boquillas" type="number" value={formData.nozzles || ''} onChange={(e:any) => setFormData({...formData, nozzles: parseInt(e.target.value)})} />
                </>
              )}

              {type === 'HACS' && (
                <>
                  <GlassInput label="HAC" value={formData.hac || ''} onChange={(e:any) => setFormData({...formData, hac: e.target.value})} />
                  <GlassInput label="Detalle HAC" value={formData.detail || ''} onChange={(e:any) => setFormData({...formData, detail: e.target.value})} />
                  <GlassInput label="GPO.CÓD. OBJETO (SAP)" value={formData.gpoCodObjeto || ''} onChange={(e:any) => setFormData({...formData, gpoCodObjeto: e.target.value})} />
                  <GlassInput label="EQUIPO (SAP)" value={formData.equipment || ''} onChange={(e:any) => setFormData({...formData, equipment: e.target.value})} />
                  <div className="flex gap-6 p-4 bg-primary/5 rounded-xl border border-primary/10 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={formData.isDater || false} 
                        onChange={(e) => setFormData({...formData, isDater: e.target.checked})}
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Control Fechador?</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={formData.isScale || false} 
                        onChange={(e) => setFormData({...formData, isScale: e.target.checked})}
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Control Balanza?</span>
                    </label>
                  </div>
                </>
              )}

              {type === 'CAUSES' && (
                <>
                  <GlassSelect 
                    label="HAC" 
                    options={masters.hacs.map((h:any) => ({label: h.hac, value: h.hac}))} 
                    value={formData.hac || ''} 
                    onChange={(e:any) => setFormData({...formData, hac: e.target.value})}
                  />
                  <GlassInput label="Texto de Causa" value={formData.text || ''} onChange={(e:any) => setFormData({...formData, text: e.target.value})} />
                  <GlassSelect 
                    label="Tipo de Paro" 
                    options={[{label: 'INTERNO', value: 'INTERNO'}, {label: 'EXTERNO', value: 'EXTERNO'}]} 
                    value={formData.stopType || ''} 
                    onChange={(e:any) => setFormData({...formData, stopType: e.target.value})}
                  />
                  <GlassInput label="Parte Objeto (SAP)" value={formData.partObject || ''} onChange={(e:any) => setFormData({...formData, partObject: e.target.value})} />
                  <GlassInput label="GPO.CÓD. SÍNTOMA (SAP)" value={formData.symptomGroup || ''} onChange={(e:any) => setFormData({...formData, symptomGroup: e.target.value})} />
                  <GlassInput label="CÓD. SÍNTOMA (SAP)" value={formData.symptomCode || ''} onChange={(e:any) => setFormData({...formData, symptomCode: e.target.value})} />
                  <GlassInput label="CAUSA SAP (SAP)" value={formData.sapCause || ''} onChange={(e:any) => setFormData({...formData, sapCause: e.target.value})} />
                  <GlassInput label="GPO.COD. CAUSA (SAP)" value={formData.causeGroup || ''} onChange={(e:any) => setFormData({...formData, causeGroup: e.target.value})} />
                  <GlassInput label="CÓDIGO CAUSA (SAP)" value={formData.causeCode || ''} onChange={(e:any) => setFormData({...formData, causeCode: e.target.value})} />
                </>
              )}

               {type === 'MATERIALS' && (
                <>
                  <GlassInput label="Descripción" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  <GlassInput label="Código SAP" value={formData.code || ''} onChange={(e:any) => setFormData({...formData, code: e.target.value})} />
                  <GlassInput label="P. Embalaje (kg)" type="number" value={formData.packingWeight || ''} onChange={(e:any) => setFormData({...formData, packingWeight: parseFloat(e.target.value)})} />
                  <GlassInput label="P. Bolsa (kg)" type="number" value={formData.bagWeight || ''} onChange={(e:any) => setFormData({...formData, bagWeight: parseFloat(e.target.value)})} />
                  
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input 
                        type="checkbox" 
                        id="isPallet"
                        checked={formData.isPallet || false} 
                        onChange={(e) => setFormData({...formData, isPallet: e.target.checked})} 
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="isPallet" className="text-xs font-bold text-text-main uppercase">Es Tarima</label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input 
                        type="checkbox" 
                        id="isProductive"
                        checked={formData.isProductive || false} 
                        onChange={(e) => setFormData({...formData, isProductive: e.target.checked})} 
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="isProductive" className="text-xs font-bold text-text-main uppercase">Es Productivo</label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input 
                        type="checkbox" 
                        id="isSupply"
                        checked={formData.isSupply || false} 
                        onChange={(e) => setFormData({...formData, isSupply: e.target.checked})} 
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="isSupply" className="text-xs font-bold text-text-main uppercase">Es Insumo</label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input 
                        type="checkbox" 
                        id="isBigBag"
                        checked={formData.isBigBag || false} 
                        onChange={(e) => setFormData({...formData, isBigBag: e.target.checked})} 
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="isBigBag" className="text-xs font-bold text-text-main uppercase">Es BigBag</label>
                    </div>
                  </div>
                </>
              )}

              {type === 'CAPACITIES' && (
                <>
                  <GlassSelect label="Paletizadora" options={masters.palletizers.map((p:any) => ({label: p.name, value: p.id}))} value={formData.palletizerId || ''} onChange={(e:any) => setFormData({...formData, palletizerId: e.target.value})} />
                  <GlassSelect label="Ensacadora" options={masters.baggers.map((b:any) => ({label: b.name, value: b.id}))} value={formData.baggerId || ''} onChange={(e:any) => setFormData({...formData, baggerId: e.target.value})} />
                  <GlassSelect 
                    label="Material (Productivo)" 
                    options={masters.materials.filter((m:any) => m.isProductive).map((m:any) => ({label: m.name, value: m.id}))} 
                    value={formData.materialId || ''} 
                    onChange={(e:any) => setFormData({...formData, materialId: e.target.value})} 
                  />
                  <GlassInput label="BDP (TN/H)" type="number" value={formData.bdp || ''} onChange={(e:any) => setFormData({...formData, bdp: parseFloat(e.target.value)})} />
                </>
              )}

              {type === 'USERS' && (
                <>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GlassInput label="DNI / LEGAJO" value={formData.dni || ''} onChange={(e:any) => setFormData({...formData, dni: e.target.value})} />
                    <GlassInput label="NOMBRE / APELLIDO" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                    <GlassInput label="USUARIO RED / SAP" value={formData.sapUser || ''} onChange={(e:any) => setFormData({...formData, sapUser: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassInput label="EMAIL" value={formData.email || ''} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />
                    <GlassInput label="EMAIL 2 (Opcional)" value={formData.email2 || ''} onChange={(e:any) => setFormData({...formData, email2: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassSelect 
                      label="PUESTO" 
                      options={[
                        {label: 'Operario Maquinista', value: 'Operario Maquinista'},
                        {label: 'Operario Técnico', value: 'Operario Técnico'},
                        {label: 'Operario Autoelevador', value: 'Operario Autoelevador'},
                        {label: 'Operario Granel', value: 'Operario Granel'},
                        {label: 'Operario Supervisor', value: 'Operario Supervisor'},
                        {label: 'Operario Líbero', value: 'Operario Líbero'},
                        {label: 'Laboratórista', value: 'Laboratórista'},
                      ]} 
                      value={formData.position || ''} 
                      onChange={(e:any) => setFormData({...formData, position: e.target.value})}
                    />
                    <GlassSelect 
                      label="PERFIL" 
                      options={[
                        {label: 'Administrador', value: 'Administrador'},
                        {label: 'Operario', value: 'Operario'},
                        {label: 'Técnico', value: 'Técnico'},
                        {label: 'Administrativo', value: 'Administrativo'},
                        {label: 'Supervisor', value: 'Supervisor'},
                        {label: 'Laboratorio', value: 'Laboratorio'},
                      ]} 
                      value={formData.profile || ''} 
                      onChange={(e:any) => setFormData({...formData, profile: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2 mt-4">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Visualizaciones Habilitadas</h4>
                    <div className="border border-border rounded-xl overflow-hidden bg-bg/30">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-bg/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider">Sección / Vista</th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Nivel de Acceso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {SYSTEM_VIEWS.map((view) => {
                            const p = formData.permissions.find((perm: any) => perm.viewId === view.id) || { level: 'NONE' };
                            return (
                              <tr key={view.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-primary/70">{view.section}</span>
                                    <span className="text-sm font-bold text-text-main">{view.label}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {['NONE', 'VIEW', 'EDIT'].map((lvl) => (
                                      <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => {
                                          const newPerms = [...formData.permissions];
                                          const idx = newPerms.findIndex((perm: any) => perm.viewId === view.id);
                                          if (idx >= 0) {
                                            newPerms[idx] = { ...newPerms[idx], level: lvl };
                                          } else {
                                            newPerms.push({ viewId: view.id, label: view.label, section: view.section, level: lvl });
                                          }
                                          setFormData({ ...formData, permissions: newPerms });
                                        }}
                                        className={cn(
                                          "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                          p.level === lvl 
                                            ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
                                            : "bg-surface text-text-muted border-border hover:border-text-muted"
                                        )}
                                      >
                                        {lvl === 'NONE' ? 'BLOQUEADO' : lvl === 'VIEW' ? 'SOLO VER' : 'EDITAR'}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {type === 'COMPANIES' && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput label="Nombre / Razón Social" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <GlassInput label="CUIT" value={formData.taxId || ''} onChange={(e:any) => setFormData({...formData, taxId: e.target.value})} />
                  <GlassInput label="Teléfono" value={formData.phone || ''} onChange={(e:any) => setFormData({...formData, phone: e.target.value})} />
                  <div className="md:col-span-2">
                    <GlassInput label="URL de Logo (PNG/JPG)" value={formData.logo || ''} onChange={(e:any) => setFormData({...formData, logo: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput label="Dirección" value={formData.address || ''} onChange={(e:any) => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput label="Email Institucional" value={formData.email || ''} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />
                  </div>
                </>
              )}

              {(type === 'PUNTOS_CARGA' || type === 'LOADING_POINTS') && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput label="Nombre de Calle / Punto" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <GlassSelect 
                      label="Tipo de Carga" 
                      options={[{label: 'BOLSA', value: 'BOLSA'}, {label: 'GRANEL', value: 'GRANEL'}]} 
                      value={formData.type || ''} 
                      onChange={(e:any) => setFormData({...formData, type: e.target.value})}
                    />
                  </div>
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
          ? "btn-active-highlight" 
          : "text-text-muted hover:text-text-main hover:bg-bg"
      )}
    >
      {label}
    </button>
  );
}
