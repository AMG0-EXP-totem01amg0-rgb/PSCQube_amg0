import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Clock, FlaskConical, ChevronRight, Download, Info, Calendar, FilterX } from 'lucide-react';
import { MasterData, ProductChange, AppUser, Company } from '../../../types';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import { GlassCard, GlassButton, GlassInput, GlassSelect, ConfirmModal, Modal } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchTableFromSheets } from '../../../lib/sheetsService';

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: ProductChange) => void;
  onDelete: (id: string) => void;
  history: ProductChange[];
  selectedShiftId: string | null;
  selectedDate: string;
}

export default function ProductChangeView({ masters, currentUser, onSave, onDelete, history, selectedShiftId, selectedDate }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductChange | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Date range for filtered view
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [localRangeHistory, setLocalRangeHistory] = useState<ProductChange[] | null>(null);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (dateFrom && dateTo) {
      let active = true;
      setIsRangeLoading(true);
      fetchTableFromSheets("CAMBIO_PRODUCTOV2", true, { dateFrom, dateTo }, "ProductChangeView.range")
        .then(result => {
          if (active && result.success && result.data) {
            setLocalRangeHistory(result.data as ProductChange[]);
          }
        })
        .catch(err => {
          console.warn("Error loading range for product changes:", err);
        })
        .finally(() => {
          if (active) {
            setIsRangeLoading(false);
          }
        });
      return () => {
        active = false;
      };
    } else {
      setLocalRangeHistory(null);
    }
  }, [dateFrom, dateTo, refreshTrigger]);

  const filteredHistory = useMemo(() => {
    const baseList = localRangeHistory !== null ? localRangeHistory : history;
    return baseList.filter(item => {
      // Always show pending items, regardless of date filters
      if (item.approvalStatus === 'PENDIENTE') {
        return true;
      }

      // Filter by date range or single date
      if (dateFrom && dateTo) {
        try {
          const start = startOfDay(parseISO(dateFrom));
          const end = endOfDay(parseISO(dateTo));
          const itemDate = parseISO(item.date);
          return isWithinInterval(itemDate, { start, end });
        } catch (e) {
          return true;
        }
      } else {
        // Filter by shift if applicable
        if (selectedShiftId && String(item.shiftId || '').trim().toUpperCase() !== String(selectedShiftId).trim().toUpperCase()) {
          return false;
        }
        return item.date === selectedDate;
      }
    });
  }, [history, localRangeHistory, dateFrom, dateTo, selectedShiftId, selectedDate]);

  const prioritizedHistory = useMemo(() => {
    return [...filteredHistory].sort((a, b) => {
      // Prioritize pending items
      if (a.approvalStatus === 'PENDIENTE' && b.approvalStatus !== 'PENDIENTE') return -1;
      if (a.approvalStatus !== 'PENDIENTE' && b.approvalStatus === 'PENDIENTE') return 1;
      // Secondary sort: descending by date
      return b.date.localeCompare(a.date);
    });
  }, [filteredHistory]);

  const isLabUser = currentUser.profile === 'Laboratorio' || currentUser.position === 'Laboratórista';
  const isMaquinista = currentUser.profile === 'Operario' || currentUser.position === 'Operario Maquinista';
  const isAdmin = currentUser.profile === 'Administrador';

  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'CHANGE');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);

  // Form State
  const initialForm: Partial<ProductChange> = {
    date: selectedDate,
    shiftId: selectedShiftId || '',
    operatorId: currentUser.dni,
    operatorName: currentUser.name,
    machineId: '',
    siloValveClosed: false,
    circuitEmptied: false,
    machineCleaned: false,
    hopperEmptied: false,
    siloChanged: false,
    setupChanged: false,
    packagingChanged: false,
    twoBigBagsPalletized: false,
    colorSampling: false,
    sampleSentToLab: false,
    productReleased: false,
    previousMaterialId: '',
    newMaterialId: '',
    changeReason: 'DEMAND',
    approvalStatus: 'PENDIENTE',
    calcinationLoss: undefined,
    incorporatedAir: undefined,
    ckPercentageByDrx: undefined
  };

  const [formData, setFormData] = useState<Partial<ProductChange>>(initialForm);

  const samplingMachines = useMemo(() => 
    [...masters.palletizers, ...masters.baggers].filter(m => m.isSamplingPoint),
    [masters]
  );

  const productiveMaterials = useMemo(() => 
    masters.materials.filter(m => m.isProductive),
    [masters]
  );

  const handleOpenAdd = () => {
    setFormData(initialForm);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ProductChange) => {
    setFormData(item);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.machineId) return "Debe seleccionar un lugar de muestreo.";
    if (!formData.previousMaterialId) return "Debe seleccionar el producto anterior.";
    if (!formData.newMaterialId) return "Debe seleccionar el nuevo producto.";
    if (formData.previousMaterialId === formData.newMaterialId) return "El nuevo producto debe ser diferente al anterior.";
    
    if (formData.approvalStatus === 'RECHAZADO' && !formData.rejectionObservation) {
        return "Debe ingresar una observación para el rechazo.";
    }
    return null;
  };

  const handleSave = () => {
    const error = validateForm();
    if (error) {
       alert(error);
       return;
    }

    const report: ProductChange = {
      ...(formData as ProductChange),
      id: editingItem?.id || `CHG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      operatorId: editingItem?.operatorId || currentUser.dni,
      operatorName: editingItem?.operatorName || currentUser.name,
    };

    if (isLabUser || isAdmin) {
        if (report.approvalStatus !== 'PENDIENTE') {
            report.labOperatorId = currentUser.dni;
            report.labOperatorName = currentUser.name;
        }
    }

    onSave(report);
    if (localRangeHistory) {
      setLocalRangeHistory(prev => {
        if (!prev) return prev;
        const exists = prev.some(item => item.id === report.id);
        if (exists) {
          return prev.map(item => item.id === report.id ? report : item);
        } else {
          return [report, ...prev];
        }
      });
    }
    setIsModalOpen(false);
  };

  const generatePDF = (item: ProductChange) => {
    const doc = new jsPDF();
    const company = masters.companies[0] || { 
      name: 'HOLCIM ARGENTINA S.A.', 
      address: 'Av. El Libertador 1234, Córdoba, Argentina', 
      taxId: '30-50000000-1',
      logo: 'https://seeklogo.com/images/H/holcim-logo-E8E44B5B4E-seeklogo.com.png'
    };
    
    // Holcim Colors
    const HOLCIM_BLUE: [number, number, number] = [0, 85, 140]; // #00558C
    const HOLCIM_GREEN: [number, number, number] = [140, 180, 50]; // #8CB432
    
    // Header background (Gradient simulated)
    doc.setFillColor(HOLCIM_BLUE[0], HOLCIM_BLUE[1], HOLCIM_BLUE[2]);
    doc.rect(0, 0, 210, 45, 'F');
    
    // Small troquel border pattern
    doc.setDrawColor(255, 255, 255);
    (doc as any).setLineDash([1, 1], 0);
    doc.line(5, 40, 205, 40);
    (doc as any).setLineDash([], 0);

    // Logo (if exists)
    if (company.logo) {
      try {
        doc.addImage(company.logo, 'PNG', 10, 5, 35, 35, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not load logo in PDF", e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE CAMBIO DE PRODUCTO', 200, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(company.name, 200, 28, { align: 'right' });
    doc.text(`${company.address} | CUIT: ${company.taxId}`, 200, 33, { align: 'right' });

    // Background watermark "Troquel" texture
    doc.setTextColor(245, 245, 245);
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.text('HOLCIM', 105, 150, { align: 'center', angle: 45 });

    // Summary Section
    doc.setTextColor(HOLCIM_BLUE[0], HOLCIM_BLUE[1], HOLCIM_BLUE[2]);
    doc.setFontSize(12);
    doc.text('DATOS DEL REGISTRO', 15, 60);
    doc.line(15, 62, 195, 62);

    const machineName = [...masters.palletizers, ...masters.baggers].find(m => m.id === item.machineId)?.name || 'N/A';
    const shiftName = masters.shifts.find(s => s.id === item.shiftId)?.name || 'N/A';

    autoTable(doc, {
      startY: 65,
      body: [
        ['ID REGISTRO', item.id, 'FECHA', item.date],
        ['MAQUINISTA', item.operatorName, 'TURNO', shiftName],
        ['PUNTO MUESTREO', machineName, 'LABORATORISTA', item.labOperatorName || 'PENDIENTE'],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, textColor: [60, 60, 60] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: HOLCIM_BLUE }, 2: { fontStyle: 'bold', cellWidth: 40, textColor: HOLCIM_BLUE } }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // Proceso
    doc.setTextColor(HOLCIM_BLUE[0], HOLCIM_BLUE[1], HOLCIM_BLUE[2]);
    doc.setFontSize(12);
    doc.text('CONTROL OPERATIVO', 15, currentY);
    doc.line(15, currentY + 2, 195, currentY + 2);

    const prevMat = masters.materials.find(m => m.id === item.previousMaterialId)?.name || 'N/A';
    const nextMat = masters.materials.find(m => m.id === item.newMaterialId)?.name || 'N/A';
    
    const reasonLabels: Record<string, string> = {
        'DEMAND': 'Demanda de producto',
        'OUT_OF_SPEC': 'Producto fuera de especificación',
        'EMPTY_SILO': 'Silo vacío'
    };
    const displayReason = reasonLabels[item.changeReason] || item.changeReason;

    autoTable(doc, {
        startY: currentY + 5,
        head: [['CONCEPTO', 'DETALLE']],
        body: [
          ['PRODUCTO ANTERIOR', prevMat],
          ['PRODUCTO A PRODUCIR', nextMat],
          ['MOTIVO DEL CAMBIO', displayReason],
        ],
        theme: 'striped',
        headStyles: { fillColor: HOLCIM_BLUE },
        styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Maquinista Checklist - Two columns
    doc.setTextColor(HOLCIM_BLUE[0], HOLCIM_BLUE[1], HOLCIM_BLUE[2]);
    doc.setFontSize(10);
    doc.text('CUMPLIMIENTO DE PROTOCOLO (MAQUINISTA)', 15, currentY);
    
    const checklistData = [
      ['Cierre de válvula de silo', item.siloValveClosed ? 'CUMPLIDO' : 'NO'],
      ['Vaciado de circuito', item.circuitEmptied ? 'CUMPLIDO' : 'NO'],
      ['Limpieza de máquina', item.machineCleaned ? 'CUMPLIDO' : 'NO'],
      ['Vaciado de tolva', item.hopperEmptied ? 'CUMPLIDO' : 'NO'],
      ['Cambio de silo', item.siloChanged ? 'CUMPLIDO' : 'NO'],
      ['Setup de máquina', item.setupChanged ? 'CUMPLIDO' : 'NO'],
      ['Cambio de envases', item.packagingChanged ? 'CUMPLIDO' : 'NO'],
      ['Paletizado de dos BIG BAG', item.twoBigBagsPalletized ? 'CUMPLIDO' : 'NO'],
      ['Muestreo de color', item.colorSampling ? 'CUMPLIDO' : 'NO'],
      ['Envío a laboratorio', item.sampleSentToLab ? 'CUMPLIDO' : 'NO'],
      ['Liberación producto', item.productReleased ? 'CUMPLIDO' : 'NO'],
    ];

    autoTable(doc, {
        startY: currentY + 5,
        body: checklistData,
        theme: 'grid',
        styles: { fontSize: 8 },
        columnStyles: { 
            0: { cellWidth: 140 }, 
            1: { halign: 'center', fontStyle: 'bold', textColor: HOLCIM_GREEN } 
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                if (data.cell.raw === 'NO') data.cell.styles.textColor = [200, 0, 0];
            }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Lab Results
    doc.setTextColor(HOLCIM_BLUE[0], HOLCIM_BLUE[1], HOLCIM_BLUE[2]);
    doc.setFontSize(10);
    doc.text('ENSAYOS DE CALIDAD (LABORATORIO)', 15, currentY);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['PÉRDIDA CALINACIÓN', 'AIRE INCORPORADO', '%CK POR DRX', 'DICTAMEN FINAL']],
        body: [[
            `${item.calcinationLoss || 0}%`,
            `${item.incorporatedAir || 0}%`,
            `${item.ckPercentageByDrx || 0}%`,
            item.approvalStatus
        ]],
        theme: 'grid',
        headStyles: { fillColor: HOLCIM_GREEN },
        styles: { halign: 'center', fontStyle: 'bold' },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
                if (item.approvalStatus === 'APROBADO') data.cell.styles.textColor = [0, 128, 0];
                if (item.approvalStatus === 'RECHAZADO') data.cell.styles.textColor = [200, 0, 0];
            }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    if (item.rejectionObservation) {
      doc.setFontSize(8);
      doc.setTextColor(200, 0, 0);
      doc.text(`OBSERVACIONES CALIDAD: ${item.rejectionObservation}`, 15, currentY, { maxWidth: 180 });
      currentY += 10;
    }

    // Foot - decorative troquel lines
    doc.setDrawColor(HOLCIM_GREEN[0], HOLCIM_GREEN[1], HOLCIM_GREEN[2]);
    doc.setLineWidth(0.5);
    doc.line(15, currentY + 5, 195, currentY + 5);

    currentY += 25;

    // Signatures
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.line(40, currentY, 90, currentY);
    doc.text('FIRMA RESPONSABLE PRODUCCIÓN', 65, currentY + 5, { align: 'center' });
    
    doc.line(120, currentY, 170, currentY);
    doc.text('FIRMA RESPONSABLE CALIDAD', 145, currentY + 5, { align: 'center' });

    doc.save(`Holcim_Certificado_${item.id}.pdf`);
  };

  const columns: Column<ProductChange>[] = [
    { 
      header: 'ID / Fecha', 
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-text-main font-mono text-[10px]">{row.id}</span>
          <span className="text-[10px] text-text-muted">{row.date}</span>
        </div>
      )
    },
    { 
      header: 'Máquina', 
      accessor: (row) => masters.palletizers.find(m => m.id === row.machineId)?.name || masters.baggers.find(m => m.id === row.machineId)?.name || 'N/A' 
    },
    { 
      header: 'Productos', 
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-surface-elevated px-1.5 py-0.5 rounded border border-border max-w-[80px] truncate">{masters.materials.find(m => m.id === row.previousMaterialId)?.name}</span>
          <ChevronRight size={10} className="text-text-muted" />
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold max-w-[80px] truncate">{masters.materials.find(m => m.id === row.newMaterialId)?.name}</span>
        </div>
      )
    },
    { 
      header: 'Laboratorio', 
      accessor: (row) => (
        <div className={cn(
          "px-2 py-1 rounded text-[9px] font-bold inline-flex items-center gap-1.5",
          row.approvalStatus === 'APROBADO' ? "bg-emerald-500/10 text-emerald-500" : 
          row.approvalStatus === 'RECHAZADO' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
        )}>
          {row.approvalStatus === 'APROBADO' ? <CheckCircle2 size={10} /> : 
           row.approvalStatus === 'RECHAZADO' ? <AlertCircle size={10} /> : <Clock size={10} />}
          {row.approvalStatus}
        </div>
      )
    },
    {
      header: 'Certificado',
      align: 'center',
      accessor: (row) => (
        <button 
            disabled={row.approvalStatus === 'PENDIENTE'}
            onClick={() => generatePDF(row)}
            className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-bg-input transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
        >
            <Download size={14} className="text-text-muted group-hover:text-primary" />
        </button>
      )
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

  const isSet = (v: any) => v !== undefined && v !== null && !isNaN(v);

  const autoApproval = useMemo(() => {
    return isSet(formData.calcinationLoss) && isSet(formData.incorporatedAir) && isSet(formData.ckPercentageByDrx);
  }, [formData.calcinationLoss, formData.incorporatedAir, formData.ckPercentageByDrx]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <RefreshCcw className="text-indigo-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-main tracking-tight uppercase">Cambio de Producto</h3>
            <p className="text-xs text-text-muted font-medium">Gestión de transición de líneas y validación de calidad.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              {isRangeLoading ? (
                <RefreshCcw size={14} className="text-primary animate-spin shrink-0" />
              ) : (
                (dateFrom && dateTo) ? (
                  <button 
                    onClick={() => setRefreshTrigger(p => p + 1)} 
                    title="Actualizar rango de datos" 
                    className="hover:text-primary transition-colors shrink-0 text-text-muted"
                  >
                    <RefreshCcw size={14} className="shrink-0" />
                  </button>
                ) : (
                  <Calendar size={14} className="text-primary shrink-0" />
                )
              )}
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] xs:max-w-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
              <span className="text-[10px] text-text-muted font-bold">A</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] xs:max-w-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1 hover:text-danger ml-1 shrink-0">
                <FilterX size={14} />
              </button>
            )}
          </div>

          {canEdit && (
              <GlassButton onClick={handleOpenAdd} className="h-11 px-6 shadow-xl shadow-primary/20 w-full sm:w-auto justify-center">
              <Plus size={20} className="mr-2" />
              Notificar Cambio
              </GlassButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <GlassCard className="p-0 overflow-hidden">
          <DataTable 
            title="Historial de Cambios" 
            countLabel="registros" 
            columns={columns} 
            data={prioritizedHistory} 
            keyExtractor={r => r.id}
          />
        </GlassCard>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? "Completar Registro de Cambio" : "Nuevo Cambio de Producto"}
        className="max-w-4xl"
      >
        <div className="space-y-8 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Operator Section */}
                <div className={cn("space-y-6", isLabUser && !isAdmin && "opacity-60 pointer-events-none")}>
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <CheckCircle2 size={16} className="text-primary" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-text-muted">Sección Maquinista</h4>
                    </div>

                    <GlassSelect 
                        label="Lugar de Muestreo"
                        options={samplingMachines.map(m => ({ label: m.name, value: m.id }))}
                        value={formData.machineId || ''}
                        onChange={(e:any) => setFormData({...formData, machineId: e.target.value})}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <GlassSelect 
                            label="Producto Anterior"
                            options={productiveMaterials.map(m => ({ label: m.name, value: m.id }))}
                            value={formData.previousMaterialId || ''}
                            onChange={(e:any) => setFormData({...formData, previousMaterialId: e.target.value})}
                        />
                        <GlassSelect 
                            label="Producto a Producir"
                            options={productiveMaterials.filter(m => m.id !== formData.previousMaterialId).map(m => ({ label: m.name, value: m.id }))}
                            value={formData.newMaterialId || ''}
                            onChange={(e:any) => setFormData({...formData, newMaterialId: e.target.value})}
                        />
                    </div>

                    <GlassSelect 
                        label="Motivo del Cambio"
                        options={[
                            { label: 'Demanda de producto', value: 'DEMAND' },
                            { label: 'Producto fuera de especificación', value: 'OUT_OF_SPEC' },
                            { label: 'Silo vacío', value: 'EMPTY_SILO' }
                        ]}
                        value={formData.changeReason || ''}
                        onChange={(e:any) => setFormData({...formData, changeReason: e.target.value})}
                    />

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-bg-input/50 rounded-2xl border border-border">
                        <ToggleItem 
                            label="Cierre Válvula Silo" 
                            checked={!!formData.siloValveClosed} 
                            onChange={v => setFormData({...formData, siloValveClosed: v})} 
                        />
                        <ToggleItem 
                            label="Vaciado Circuito" 
                            checked={!!formData.circuitEmptied} 
                            onChange={v => setFormData({...formData, circuitEmptied: v})} 
                        />
                        <ToggleItem 
                            label="Limpieza Máquina" 
                            checked={!!formData.machineCleaned} 
                            onChange={v => setFormData({...formData, machineCleaned: v})} 
                        />
                        <ToggleItem 
                            label="Vaciado Tolva" 
                            checked={!!formData.hopperEmptied} 
                            onChange={v => setFormData({...formData, hopperEmptied: v})} 
                        />
                        <ToggleItem 
                            label="Cambio de Silo" 
                            checked={!!formData.siloChanged} 
                            onChange={v => setFormData({...formData, siloChanged: v})} 
                        />
                        <ToggleItem 
                            label="Setup de Máquina" 
                            checked={!!formData.setupChanged} 
                            onChange={v => setFormData({...formData, setupChanged: v})} 
                        />
                        <ToggleItem 
                            label="Cambio de Envases" 
                            checked={!!formData.packagingChanged} 
                            onChange={v => setFormData({...formData, packagingChanged: v})} 
                        />
                        <ToggleItem 
                            label="Paletizado de dos Big Bag" 
                            checked={!!formData.twoBigBagsPalletized} 
                            onChange={v => setFormData({...formData, twoBigBagsPalletized: v})} 
                        />
                        <ToggleItem 
                            label="Muestreo de Color" 
                            checked={!!formData.colorSampling} 
                            onChange={v => setFormData({...formData, colorSampling: v})} 
                        />
                         <ToggleItem 
                            label="Muestra enviada" 
                            checked={!!formData.sampleSentToLab} 
                            onChange={v => setFormData({...formData, sampleSentToLab: v})} 
                        />
                        <ToggleItem 
                            label="Liberación Producto" 
                            checked={!!formData.productReleased} 
                            onChange={v => setFormData({...formData, productReleased: v})} 
                        />
                    </div>
                </div>

                {/* Lab Section */}
                <div className={cn("space-y-6", !isLabUser && !isAdmin && "opacity-60 pointer-events-none")}>
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                            <FlaskConical size={16} className="text-indigo-500" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-text-muted">Sección Laboratorio</h4>
                        </div>
                        {isLabUser && (
                            <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-bold">
                                MODO LABORATORISTA
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/20 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                             <Info size={14} className="text-indigo-400" />
                             <p className="text-[10px] font-medium text-indigo-300">Complete los parámetros para habilitar la aprobación.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <GlassInput 
                                label="Pérdida por Calinación (%)" 
                                type="number" 
                                value={formData.calcinationLoss || ''} 
                                onChange={(e:any) => setFormData({...formData, calcinationLoss: parseFloat(e.target.value)})} 
                            />
                            <GlassInput 
                                label="Aire Incorporado (%)" 
                                type="number" 
                                value={formData.incorporatedAir || ''} 
                                onChange={(e:any) => setFormData({...formData, incorporatedAir: parseFloat(e.target.value)})} 
                            />
                            <GlassInput 
                                label="% CK por DRX" 
                                type="number" 
                                value={formData.ckPercentageByDrx || ''} 
                                onChange={(e:any) => setFormData({...formData, ckPercentageByDrx: parseFloat(e.target.value)})} 
                            />
                        </div>

                        {autoApproval && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="pt-4 space-y-4 border-t border-indigo-500/20"
                            >
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-text-main">Aprobación Final</span>
                                    <div className="flex items-center gap-2 bg-bg p-1 rounded-xl border border-border">
                                        <button 
                                            onClick={() => setFormData({...formData, approvalStatus: 'APROBADO', rejectionObservation: ''})}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                                formData.approvalStatus === 'APROBADO' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-text-muted hover:text-emerald-500"
                                            )}
                                        >
                                            APROBAR
                                        </button>
                                        <button 
                                            onClick={() => setFormData({...formData, approvalStatus: 'RECHAZADO'})}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                                formData.approvalStatus === 'RECHAZADO' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-text-muted hover:text-red-500"
                                            )}
                                        >
                                            RECHAZAR
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {formData.approvalStatus === 'RECHAZADO' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            <GlassInput 
                                                label="Observación del Rechazo (Obligatorio)" 
                                                value={formData.rejectionObservation || ''} 
                                                onChange={(e:any) => setFormData({...formData, rejectionObservation: e.target.value})} 
                                                placeholder="Describa el motivo del rechazo..."
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {!autoApproval && (
                            <div className="flex flex-col items-center justify-center p-8 bg-surface/30 rounded-2xl border border-border/40 text-center opacity-50 italic">
                                <Clock size={24} className="mb-2 text-text-muted" />
                                <p className="text-[10px]">Esperando carga de datos técnicos...</p>
                                <div className="mt-2 px-2 py-1 bg-orange-500/10 text-orange-500 rounded font-black text-[9px] uppercase">Pendiente</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <GlassButton variant="secondary" className="w-full sm:flex-1 h-12" onClick={() => setIsModalOpen(false)}>Cancelar</GlassButton>
                <GlassButton className="w-full sm:flex-1 h-12 shadow-xl shadow-primary/20" onClick={handleSave}>
                   {isLabUser ? "Guardar Análisis" : "Guardar Registro"}
                </GlassButton>
            </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deletingId}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro de cambio de producto?"
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) {
            onDelete(deletingId);
            if (localRangeHistory) {
              setLocalRangeHistory(prev => prev ? prev.filter(item => item.id !== deletingId) : null);
            }
          }
          setDeletingId(null);
        }}
      />
    </div>
  );
}

function ToggleItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between gap-4 p-2.5 bg-bg/50 rounded-xl border border-border/50 group hover:border-primary/30 transition-all">
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider leading-tight group-hover:text-text-main transition-colors">{label}</span>
            <button 
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative w-7 h-4 rounded-full transition-all duration-300 shadow-inner",
                    checked ? "bg-emerald-500 shadow-emerald-900/20" : "bg-red-500 shadow-red-900/20"
                )}
            >
                <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-[0_1px_3px_rgba(0,0,0,0.2)]",
                    checked ? "left-3.5" : "left-0.5"
                )} />
            </button>
        </div>
    );
}
