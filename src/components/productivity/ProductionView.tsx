import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, History, Pencil, TrendingUp, Filter, BarChart3, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal, Modal } from '../ui/GlassUI';
import { DataTable, Column, TableActions } from '../ui/DataTable';
import { MasterData, ProductionReport, NozzleNews, AppUser, MachineStop } from '../../types';
import { cn } from '../../lib/utils';

// Helper function to check if stop is for shift
const isStopForShift = (stop: any, shiftId: string | null | undefined, mastersAvailable: MasterData) => {
  if (!stop || !shiftId) return false;
  const targetId = String(shiftId).trim().toUpperCase();
  
  const selectedS: any = (mastersAvailable.shifts || []).find((s: any) => s && String(s.id).trim().toUpperCase() === targetId);
  if (!selectedS) {
    return String(stop.shiftId || '').trim().toUpperCase() === targetId;
  }
  
  const sId = String(selectedS.id).trim().toUpperCase();
  const sName = String(selectedS.name || selectedS.nombre || "").trim().toUpperCase();
  
  const stopShiftId = String(stop.shiftId || "").trim().toUpperCase();
  const stopShiftName = String(stop.shiftName || stop.turno || "").trim().toUpperCase();
  
  if (stopShiftId === sId) return true;
  if (sName && (stopShiftName === sName || stopShiftId === sName)) return true;
  
  return false;
};

// Helper function to check if stop is for machine
const isStopForMachine = (stop: any, machineId: string | null | undefined, mastersAvailable: MasterData) => {
  if (!stop || !machineId) return false;
  const targetId = String(machineId).trim().toUpperCase();
  
  const selectedMac: any = (mastersAvailable.palletizers || []).find((p: any) => p && String(p.id).trim().toUpperCase() === targetId) ||
                           (mastersAvailable.baggers || []).find((b: any) => b && String(b.id).trim().toUpperCase() === targetId);
                      
  if (!selectedMac) {
    return String(stop.machineId || '').trim().toUpperCase() === targetId;
  }
  
  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();
  
  const stopMachineId = String(stop.machineId || "").trim().toUpperCase();
  const stopMachineName = String(stop.machineName || "").trim().toUpperCase();
  const stopMachineHacText = String(stop.machineHacText || "").trim().toUpperCase();
  
  if (stopMachineId === macId) return true;
  if (macName && (stopMachineName === macName || stopMachineHacText === macName || stopMachineId === macName)) return true;
  if (macHacId && (stopMachineId === macHacId || stopMachineHacText === macHacId)) return true;
  
  const cleanMacName = macName.replace(/[^A-Z0-9]/g, '');
  const cleanStopId = stopMachineId.replace(/[^A-Z0-9]/g, '');
  const cleanStopName = stopMachineName.replace(/[^A-Z0-9]/g, '');
  const cleanStopHac = stopMachineHacText.replace(/[^A-Z0-9]/g, '');
  const cleanMacHac = macHacId.replace(/[^A-Z0-9]/g, '');
  
  if (cleanMacName && (cleanStopId === cleanMacName || cleanStopName === cleanMacName || cleanStopHac === cleanMacName)) return true;
  if (cleanMacHac && (cleanStopId === cleanMacHac || cleanStopHac === cleanMacHac || cleanStopName === cleanMacHac)) return true;

  return false;
};

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: any) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: ProductionReport[];
  stops: MachineStop[];
}

export default function ProductionView({ masters, currentUser, onSave, onDelete, palletizerId, shiftId, selectedDate, history, stops }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isNozzleModalOpen, setIsNozzleModalOpen] = useState(false);

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'PRODUCCION');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  
  // Local form state
  const [formData, setFormData] = useState({ 
    baggerId: '', 
    materialId: '', 
    bags: '',
    tons: '',
    availableNozzlesShift: '',
    bagProvider: '',
    discardedBagsBagger: '',
    notNozzledBags: '',
    discardedBagsVentocheck: '',
    discardedBagsTransport: '',
    nozzleNews: [] as NozzleNews[],
    hsMarchaTis: ''
  });

  // Local state for adding nozzle news
  const [tempNews, setTempNews] = useState({
    nozzleNumber: '',
    startTime: '',
    endTime: '',
    isAllShift: false,
    observation: ''
  });
  const [editingNozzleId, setEditingNozzleId] = useState<string | null>(null);

  const selectedShiftObj = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId), 
    [masters.shifts, shiftId]
  );

  const selectedBaggerObj = useMemo(() => 
    masters.baggers.find(b => b.id === formData.baggerId),
    [masters.baggers, formData.baggerId]
  );

  const selectedMaterialObj = useMemo(() => 
    masters.materials.find(m => m.id === formData.materialId),
    [masters.materials, formData.materialId]
  );

  // Auto-calculate TN based on Bags and Material weight
  React.useEffect(() => {
    if (selectedMaterialObj && formData.bags) {
      const bags = parseFloat(formData.bags) || 0;
      const weightPerBagKg = selectedMaterialObj.bagWeight || 0;
      const calculatedTons = (bags * weightPerBagKg) / 1000;
      setFormData(prev => ({ ...prev, tons: calculatedTons.toString() }));
    } else {
      setFormData(prev => ({ ...prev, tons: '' }));
    }
  }, [formData.bags, formData.materialId, selectedMaterialObj]);

  // Calculate active running hours (hs de marcha) computed by the app
  const hsCalculatedByApp = useMemo(() => {
    if (!palletizerId || !shiftId) return 0;
    const selectedShift = masters.shifts.find(s => s.id === shiftId);
    if (!selectedShift) return 0;

    const machineStops = stops.filter(s => 
      s &&
      s.date === selectedDate &&
      isStopForMachine(s, palletizerId, masters) &&
      isStopForShift(s, shiftId, masters)
    );

    const hsShift = selectedShift.durationHours;
    const totalStopMinutes = machineStops.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalStopHours = totalStopMinutes / 60;
    
    return Math.max(0, hsShift - totalStopHours);
  }, [palletizerId, shiftId, selectedDate, stops, masters]);

  // Calculate Global Summary (Automated)
  const totals = useMemo(() => {
    const totalTons = history.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
    const totalBags = history.reduce((sum, r) => sum + (Number(r.bagsProduced) || 0), 0);
    const count = history.length;
    return { totalTons, totalBags, count };
  }, [history]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultBagProvider = masters.bagSuppliers && masters.bagSuppliers.length > 0
      ? masters.bagSuppliers[0].nombre
      : '';
    setFormData({ 
      baggerId: '', 
      materialId: '', 
      bags: '',
      tons: '',
      availableNozzlesShift: '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      nozzleNews: [],
      hsMarchaTis: ''
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ProductionReport) => {
    setEditingItem(item);
    const defaultBagProvider = item.bagProvider || (masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : '');
    setFormData({ 
      baggerId: item.baggerId, 
      materialId: item.materialId, 
      bags: item.bagsProduced?.toString() || '',
      tons: item.tonsProduced.toString(),
      availableNozzlesShift: item.availableNozzlesShift?.toString() || '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: item.discardedBagsBagger?.toString() || '0',
      notNozzledBags: item.notNozzledBags?.toString() || '0',
      discardedBagsVentocheck: item.discardedBagsVentocheck?.toString() || '0',
      discardedBagsTransport: item.discardedBagsTransport?.toString() || '0',
      nozzleNews: item.nozzleNews || [],
      hsMarchaTis: item.hsMarchaTis?.toString() || ''
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsModalOpen(true);
  };

  const handleEditNozzleNews = (news: NozzleNews) => {
    setEditingNozzleId(news.id);
    setTempNews({
      nozzleNumber: news.nozzleNumber.toString(),
      startTime: news.startTime || '',
      endTime: news.endTime || '',
      isAllShift: !!news.isAllShift,
      observation: news.observation || ''
    });
    setIsNozzleModalOpen(true);
  };

  const addNozzleNews = () => {
    if (!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))) return;
    
    if (editingNozzleId) {
      setFormData(prev => ({
        ...prev,
        nozzleNews: prev.nozzleNews.map(n => 
          n.id === editingNozzleId 
            ? {
                ...n,
                nozzleNumber: parseInt(tempNews.nozzleNumber),
                startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '') : tempNews.startTime,
                endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '') : tempNews.endTime,
                isAllShift: tempNews.isAllShift,
                observation: tempNews.observation
              }
            : n
        )
      }));
    } else {
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
    }

    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsNozzleModalOpen(false);
  };

  const removeNozzleNews = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nozzleNews: prev.nozzleNews.filter(n => n.id !== id)
    }));
    if (editingNozzleId === id) {
      setEditingNozzleId(null);
    }
  };

  const handleSave = () => {
    if (!formData.baggerId || !formData.materialId || !formData.tons || !palletizerId || !shiftId) return;

    if (tempNews.nozzleNumber || tempNews.observation || tempNews.startTime || tempNews.endTime) {
      const confirmAdd = window.confirm(
        "¡Atención! Has ingresado datos en la sección de Novedad de Boquilla pero NO has presionado 'Añadir Novedad'.\n\n" +
        "¿Deseas agregar esta novedad automáticamente antes de guardar el reporte?"
      );
      if (confirmAdd) {
        const news: NozzleNews = {
          id: Math.random().toString(36).substr(2, 9),
          nozzleNumber: parseInt(tempNews.nozzleNumber) || 1,
          startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '00:00') : (tempNews.startTime || '00:00'),
          endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '23:59') : (tempNews.endTime || '23:59'),
          isAllShift: tempNews.isAllShift,
          observation: tempNews.observation
        };
        formData.nozzleNews.push(news);
        setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
      } else {
        const discard = window.confirm("¿Seguro que deseas guardar el reporte SIN registrar esta novedad de boquilla?");
        if (!discard) {
          return;
        }
      }
    }
    
    // Calculate BDP
    const bdp = masters.capacities.find((c: any) => 
      c.baggerId === formData.baggerId && 
      c.palletizerId === palletizerId && 
      c.materialId === formData.materialId
    )?.bdp || 100;

    // Calculate Bagger Nozzle Availability Percentage based on reported stoppages
    const shiftHours = selectedShiftObj ? Number(selectedShiftObj.durationHours || 8) : 8;
    const totalShiftMinutes = shiftHours * 60;
    const totalBaggerNozzles = selectedBaggerObj?.nozzles || parseInt(formData.availableNozzlesShift) || 4;
    const totalNozzleMinutes = totalBaggerNozzles * totalShiftMinutes;

    let totalNozzleDowntimeMinutes = 0;
    formData.nozzleNews.forEach(news => {
      let stopDuration = 0;
      if (news.isAllShift) {
        stopDuration = totalShiftMinutes;
      } else if (news.startTime && news.endTime) {
        try {
          const start = parse(news.startTime, 'HH:mm', new Date());
          const end = parse(news.endTime, 'HH:mm', new Date());
          let diff = differenceInMinutes(end, start);
          if (diff < 0) {
            diff += 24 * 60; // overnight crossing
          }
          stopDuration = Math.min(totalShiftMinutes, diff);
        } catch {
          stopDuration = 0;
        }
      }
      totalNozzleDowntimeMinutes += stopDuration;
    });

    const activeNozzleDowntime = Math.min(totalNozzleMinutes, totalNozzleDowntimeMinutes);
    const nozzleAvailabilityPercent = totalNozzleMinutes > 0
      ? ((totalNozzleMinutes - activeNozzleDowntime) / totalNozzleMinutes) * 100
      : 100;

    const nozzleAvailabilityStr = `${nozzleAvailabilityPercent.toFixed(1)}%`;

    const record = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      date: editingItem?.date || selectedDate,
      shiftId,
      palletizerId,
      baggerId: formData.baggerId,
      materialId: formData.materialId,
      bagsProduced: parseInt(formData.bags) || 0,
      tonsProduced: parseFloat(formData.tons) || 0,
      bdp,
      availableNozzlesShift: parseInt(formData.availableNozzlesShift) || 0,
      bagProvider: formData.bagProvider,
      discardedBagsBagger: parseInt(formData.discardedBagsBagger) || 0,
      notNozzledBags: parseInt(formData.notNozzledBags) || 0,
      discardedBagsVentocheck: parseInt(formData.discardedBagsVentocheck) || 0,
      discardedBagsTransport: parseInt(formData.discardedBagsTransport) || 0,
      nozzleNews: formData.nozzleNews,
      nozzleAvailability: nozzleAvailabilityStr,
      hsMarchaTis: formData.hsMarchaTis ? parseFloat(formData.hsMarchaTis) : null,
      machinistId: editingItem?.machinistId || currentUser?.dni || "",
      machinistName: editingItem?.machinistName || currentUser?.name || ""
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
      header: 'Producción',
      align: 'right',
      accessor: (row) => (
        <div className="text-right">
          <div className="text-[11px] font-black text-text-main tabular-nums">
            {row.bagsProduced} BOLSAS
          </div>
          <div className="text-[9px] text-primary font-bold tabular-nums">
            {row.tonsProduced.toFixed(2)} TN
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
      header: 'Disp. Boquillas',
      align: 'center',
      accessor: (row) => {
        const value = row.nozzleAvailability || '100.0%';
        const num = parseFloat(value);
        let colorClass = 'text-emerald-500 bg-emerald-500/10';
        if (num < 85) colorClass = 'text-red-500 bg-red-500/10';
        else if (num < 100) colorClass = 'text-amber-500 bg-amber-500/10';
        
        return (
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black font-mono", colorClass)}>
            {value}
          </span>
        );
      }
    },
    {
      header: 'TIS vs App',
      align: 'center',
      accessor: (row) => {
        if (row.hsMarchaTis === undefined || row.hsMarchaTis === null) {
          return <span className="text-[10px] text-text-muted/60 italic font-medium">Sin registrar</span>;
        }
        
        const diff = hsCalculatedByApp - (row.hsMarchaTis || 0);
        const absoluteDiff = Math.abs(diff);
        
        let colorClass = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
        let displayText = 'OK (0.00h)';
        
        if (absoluteDiff >= 0.01) {
          if (diff > 0) {
            colorClass = 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
            displayText = `Faltan paros (+${diff.toFixed(2)}h)`;
          } else {
            colorClass = 'text-red-400 bg-red-500/10 border border-red-500/20';
            displayText = `Sobran paros (${diff.toFixed(2)}h)`;
          }
        }
        
        return (
          <div className="flex flex-col items-center py-0.5">
            <span className="text-[10px] font-bold text-text-main font-mono">
              TIS: {row.hsMarchaTis.toFixed(2)}h
            </span>
            <span className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black tracking-wider uppercase mt-1", colorClass)}>
              {displayText}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => canEdit ? (
        <TableActions 
          onEdit={() => handleOpenEdit(row)}
          onDelete={() => setDeletingId(row.id)}
        />
      ) : (
        <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">Lectura</span>
      )
    }
  ];

  const newsColumns: Column<NozzleNews>[] = [
    {
      header: 'Boquilla',
      accessor: (row) => <span className="font-bold text-text-main">Boq. {row.nozzleNumber}</span>
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
      header: 'Causa / Observación',
      accessor: (row) => (
        <span className="text-[10px] text-text-muted italic block truncate max-w-[180px]" title={row.observation}>
          {row.observation || '-'}
        </span>
      )
    },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => (
        <TableActions 
          onEdit={() => handleEditNozzleNews(row)}
          onDelete={() => removeNozzleNews(row.id)}
        />
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
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">PRODUCCIÓN TOTAL</h4>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-text-main tracking-tighter tabular-nums">{totals.totalTons.toFixed(1)}</span>
                <span className="text-xs font-bold text-primary uppercase">tn</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-sm font-bold text-text-muted tabular-nums">{totals.totalBags}</span>
                <span className="text-[10px] font-bold text-text-muted uppercase">bolsas</span>
              </div>
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

        {canEdit && (
          <div className="flex flex-col justify-center">
            <GlassButton 
              onClick={handleOpenAdd}
              className="h-full py-6 md:py-0 text-base shadow-lg shadow-primary/20"
            >
              <Plus size={20} className="mr-2" />
              Agregar Producción
            </GlassButton>
          </div>
        )}
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
                options={masters.materials.filter((m: any) => !!m.isProductive).map((m: any) => ({label: m.name, value: m.id}))} 
                value={formData.materialId} 
                onChange={e => setFormData({...formData, materialId: (e.target as HTMLSelectElement).value})} 
              />
              <GlassInput 
                label="Bolsas Producidas" 
                type="number" 
                value={formData.bags} 
                onChange={e => setFormData({...formData, bags: (e.target as HTMLInputElement).value})} 
                placeholder="0"
              />
              <div className="md:col-span-3">
                 <div className="flex flex-wrap gap-4 mb-4">
                    {formData.tons && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <TrendingUp size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                          Calculado: {parseFloat(formData.tons).toFixed(2)} TN
                        </span>
                      </div>
                    )}
                    {selectedBaggerObj && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
                        <ShieldCheck size={12} className="text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                          EQUIPO (HAC): {selectedBaggerObj.hacId || 'N/A'} — CAP. TEÓRICA: {selectedBaggerObj.nozzles} BOQUILLAS
                        </span>
                      </div>
                    )}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <GlassInput 
                    label="Boquillas Disponibles" 
                    type="number" 
                    value={formData.availableNozzlesShift} 
                    onChange={e => setFormData({...formData, availableNozzlesShift: (e.target as HTMLInputElement).value})} 
                    placeholder="Ej: 4"
                  />
                  <GlassSelect 
                    label="Proveedor de Bolsa" 
                    options={(masters.bagSuppliers || []).map((p: any) => ({ label: p.nombre, value: p.nombre }))}
                    value={formData.bagProvider} 
                    onChange={e => setFormData({...formData, bagProvider: (e.target as HTMLSelectElement).value})} 
                  />
                  <GlassInput 
                    label="Hs. Marcha TIS" 
                    type="number"
                    step="0.01"
                    value={formData.hsMarchaTis} 
                    onChange={e => setFormData({...formData, hsMarchaTis: (e.target as HTMLInputElement).value})} 
                    placeholder="Ej: 7.50"
                  />
                 </div>

                 {formData.hsMarchaTis && (
                   <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                     <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted">
                       <span>Comparativa de Horas de Marcha</span>
                       <span className="font-mono text-text-main">
                         App: {hsCalculatedByApp.toFixed(2)} hs | TIS: {parseFloat(formData.hsMarchaTis || "0").toFixed(2)} hs
                       </span>
                     </div>
                     
                     {(() => {
                       const tisVal = parseFloat(formData.hsMarchaTis || "0");
                       const diff = hsCalculatedByApp - tisVal;
                       const absoluteDiff = Math.abs(diff);
                       
                       if (absoluteDiff < 0.01) {
                         return (
                           <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                             <ShieldCheck size={14} />
                             <span>Sincronización perfecta de horas (0.00 hs de diferencia)</span>
                           </div>
                         );
                       } else if (diff > 0) {
                         return (
                           <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                             <AlertCircle size={14} />
                             <span>Faltan paros de reportar en la app (Diferencia de +{diff.toFixed(2)} hs)</span>
                           </div>
                         );
                       } else {
                         return (
                           <div className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                             <AlertCircle size={14} />
                             <span>Hay paros de más reportados en la app (Diferencia de {diff.toFixed(2)} hs)</span>
                           </div>
                         );
                       }
                     })()}
                   </div>
                 )}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-500">
                <Clock size={16} />
                <h4 className="text-xs font-black uppercase tracking-widest">Novedades de Boquillas</h4>
              </div>
              <GlassButton
                type="button"
                variant="secondary"
                disabled={!formData.baggerId}
                onClick={() => {
                  setEditingNozzleId(null);
                  setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
                  setIsNozzleModalOpen(true);
                }}
                className="h-9 px-4 text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white border-primary/20"
              >
                <Plus size={14} className="mr-1" />
                Añadir Novedad
              </GlassButton>
            </div>
            
            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50 space-y-4">
               {/* Current Nozzle News List */}
               {formData.nozzleNews.length > 0 ? (
                 <div className="border border-border/30 rounded-lg overflow-hidden">
                    <DataTable 
                      title=""
                      columns={newsColumns}
                      data={formData.nozzleNews}
                      keyExtractor={r => r.id}
                    />
                 </div>
               ) : (
                 <div className="text-center py-4 text-xs text-text-muted">
                   Ninguna novedad de boquilla registrada aún en esta producción.
                 </div>
               )}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
             <GlassButton 
              variant="secondary" 
              className="w-full sm:flex-1" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </GlassButton>
            <GlassButton 
              className="w-full sm:flex-1"
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

      <Modal
        isOpen={isNozzleModalOpen}
        onClose={() => setIsNozzleModalOpen(false)}
        title={editingNozzleId ? "Editar Novedad de Boquilla" : "Registrar Novedad de Boquilla"}
        isSubModal={true}
        className="max-w-md"
      >
        <div className="space-y-4">
          <GlassSelect 
            label="Boquilla" 
            options={Array.from({length: selectedBaggerObj?.nozzles || 4}, (_, i) => ({label: `Boquilla ${i+1}`, value: (i+1).toString()}))}
            value={tempNews.nozzleNumber}
            onChange={(e: any) => setTempNews({...tempNews, nozzleNumber: e.target.value})}
          />
          <div className="flex items-center gap-2">
             <div className="flex-1">
                <GlassInput 
                  label="Inicio" 
                  type="time" 
                  disabled={tempNews.isAllShift}
                  value={tempNews.startTime}
                  onChange={(e: any) => setTempNews({...tempNews, startTime: e.target.value})}
                />
             </div>
             <div className="flex-1">
                <GlassInput 
                  label="Fin" 
                  type="time" 
                  disabled={tempNews.isAllShift}
                  value={tempNews.endTime}
                  onChange={(e: any) => setTempNews({...tempNews, endTime: e.target.value})}
                />
             </div>
          </div>
          <div className="flex items-center justify-start py-1">
             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={tempNews.isAllShift}
                  onChange={(e: any) => setTempNews({...tempNews, isAllShift: e.target.checked})}
                  className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/20"
                />
                <span className="text-xs font-bold text-text-muted group-hover:text-text-main transition-colors">TODO EL TURNO</span>
             </label>
          </div>
          <GlassInput 
            label="Causa de la Novedad / Observación" 
            placeholder="Ej: Obstrucción de válvula, limpieza..."
            value={tempNews.observation || ''}
            onChange={(e: any) => setTempNews({...tempNews, observation: e.target.value})}
          />
          <div className="pt-4 border-t border-border flex gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsNozzleModalOpen(false)}
            >
              Cancelar
            </GlassButton>
            <GlassButton
              type="button"
              className="flex-1"
              onClick={addNozzleNews}
              disabled={!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))}
            >
              {editingNozzleId ? "Guardar" : "Agregar"}
            </GlassButton>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
