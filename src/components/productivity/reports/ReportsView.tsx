import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Download, Calendar, Search, RefreshCw, 
  ChevronDown, ChevronUp, AlertTriangle, Package, Clock, 
  User, Eye, FilterX, HelpCircle, Layers, Sliders, Settings
} from 'lucide-react';
import { 
  GlassCard, GlassButton, GlassInput, Modal 
} from '../../ui/GlassUI';
import { fetchTable } from '../../../lib/dataService';
import { MasterData, UserContext, MachineStop, ProductionReport } from '../../../types';
import { cn } from '../../../lib/utils';

interface Props {
  masters: MasterData;
  currentUser: any;
  userContext: UserContext;
}

export default function ReportsView({ masters, currentUser, userContext }: Props) {
  const [activeTab, setActiveTab] = useState<'PAROS' | 'PRODUCCION'>('PAROS');
  
  // Date range states (Default to last 7 days ending at userContext.selectedDate or today)
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const defaultTo = userContext.selectedDate || new Date().toISOString().split('T')[0];
    const d = new Date(defaultTo);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return userContext.selectedDate || new Date().toISOString().split('T')[0];
  });

  const [stops, setStops] = useState<MachineStop[]>([]);
  const [prodReports, setProdReports] = useState<ProductionReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded states for accordion grouping
  // Keys: "YYYY-MM-DD" for Level 1, "YYYY-MM-DD|ShiftId" for Level 2, "YYYY-MM-DD|ShiftId|LineId" for Level 3
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({});
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal States
  const [selectedStopDetail, setSelectedStopDetail] = useState<MachineStop | null>(null);
  const [selectedProductionDetail, setSelectedProductionDetail] = useState<{
    date: string;
    shiftName: string;
    palletizerName: string;
    machinists: string;
    totalTons: number;
    baggersText: string;
    runHours: number;
    availability: number;
    performance: number;
    oee: number;
    reports: ProductionReport[];
  } | null>(null);

  // Load data for the selected range
  const loadReportData = async () => {
    if (!dateFrom || !dateTo) {
      setError('Por favor selecciona un rango de fechas.');
      return;
    }
    if (dateFrom > dateTo) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Parallel fetches for efficiency
      const [stopsRes, prodRes] = await Promise.all([
        fetchTable("PAROSV2", true, { dateFrom, dateTo }, "ReportsView"),
        fetchTable("PRODUCCIONV2", true, { dateFrom, dateTo }, "ReportsView")
      ]);

      if (stopsRes.success) {
        setStops((stopsRes.data || []) as MachineStop[]);
      } else {
        console.error("Error fetching stops for reports:", stopsRes.error);
      }

      if (prodRes.success) {
        setProdReports((prodRes.data || []) as ProductionReport[]);
      } else {
        console.error("Error fetching production for reports:", prodRes.error);
      }

      // Reset expand states on fresh load to prevent confusion
      setExpandedDates({});
      setExpandedShifts({});
      setExpandedLines({});
      setCurrentPage(1);
    } catch (err: any) {
      setError(err?.message || 'Error al recuperar los datos del servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount or when dates are adjusted
  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo]);

  // Robust Helpers for machine/shift checks
  const isStopForMachine = (stop: any, machineId: string) => {
    if (!stop || !machineId) return false;
    const targetId = machineId.trim().toUpperCase();
    const stopMacId = String(stop.machineId || stop.palletizerId || '').trim().toUpperCase();
    if (stopMacId === targetId) return true;

    // Check master references
    const selectedMac = (masters.palletizers || []).find((p: any) => p && (
      String(p.id).trim().toUpperCase() === targetId ||
      String(p.hacId || '').trim().toUpperCase() === targetId ||
      String(p.name || '').trim().toUpperCase() === targetId
    ));

    if (!selectedMac) return false;
    const macId = String(selectedMac.id).trim().toUpperCase();
    const macName = String(selectedMac.name || '').trim().toUpperCase();
    const macHacId = String(selectedMac.hacId || '').trim().toUpperCase();

    const stopMachineId = String(stop.machineId || '').trim().toUpperCase();
    const stopMachineName = String(stop.machineName || '').trim().toUpperCase();
    const stopMachineHacText = String(stop.machineHacText || '').trim().toUpperCase();

    return [stopMachineId, stopMachineName, stopMachineHacText].some(val => 
      val && (val === macId || val === macName || val === macHacId)
    );
  };

  const isStopForShift = (stop: any, shiftId: string) => {
    if (!stop || !shiftId) return false;
    const targetId = shiftId.trim().toUpperCase();
    const stopShiftId = String(stop.shiftId || '').trim().toUpperCase();
    if (stopShiftId === targetId) return true;

    const selectedS = (masters.shifts || []).find((s: any) => s && String(s.id).trim().toUpperCase() === targetId);
    if (!selectedS) return false;

    const sId = String(selectedS.id).trim().toUpperCase();
    const sName = String(selectedS.name || '').trim().toUpperCase();
    const stopShiftName = String(stop.shiftName || stop.turno || '').trim().toUpperCase();

    return stopShiftId === sId || stopShiftName === sName || stopShiftId === sName;
  };

  // Helper formatting dates to Spanish DD/MM/YYYY
  const formatToSpanishDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const formatToHhMm = (timeStr: string): string => {
    if (!timeStr) return '';
    const cleaned = timeStr.trim();
    if (cleaned.length >= 5) {
      return cleaned.substring(0, 5);
    }
    return cleaned;
  };

  // Toggle Collapse handlers
  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const toggleShift = (shiftKey: string) => {
    setExpandedShifts(prev => ({ ...prev, [shiftKey]: !prev[shiftKey] }));
  };

  const toggleLine = (lineKey: string) => {
    setExpandedLines(prev => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  // ----------------- PAROS DATA PROCESSING (GROUPING) -----------------
  const groupedParos = useMemo(() => {
    const rawStops = stops || [];
    // Sort chronological: oldest date first
    const sortedStops = [...rawStops].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.startTime || '';
      const timeB = b.startTime || '';
      return timeA.localeCompare(timeB);
    });

    const groups: Record<string, {
      date: string;
      totalStopsCount: number;
      totalDurationMinutes: number;
      shifts: Record<string, {
        shiftId: string;
        shiftName: string;
        stopsCount: number;
        durationMinutes: number;
        lines: Record<string, {
          lineId: string;
          lineName: string;
          stops: MachineStop[];
        }>;
      }>;
    }> = {};

    sortedStops.forEach(stop => {
      if (!stop || !stop.date) return;
      const dateKey = stop.date;
      const shiftId = stop.shiftId || 'S_DESCONOCIDO';
      const shiftObj = masters.shifts.find(s => s.id === shiftId || s.name === stop.shiftId);
      const shiftName = shiftObj?.name || stop.shiftId || 'Shift';

      // Find Palletizer/Line
      const lineId = stop.palletizerId || stop.machineId || 'L_DESCONOCIDA';
      const lineObj = masters.palletizers.find(p => p.id === lineId || p.hacId === lineId || p.name === lineId);
      const lineName = lineObj?.name || lineId;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          totalStopsCount: 0,
          totalDurationMinutes: 0,
          shifts: {}
        };
      }

      if (!groups[dateKey].shifts[shiftId]) {
        groups[dateKey].shifts[shiftId] = {
          shiftId,
          shiftName,
          stopsCount: 0,
          durationMinutes: 0,
          lines: {}
        };
      }

      if (!groups[dateKey].shifts[shiftId].lines[lineId]) {
        groups[dateKey].shifts[shiftId].lines[lineId] = {
          lineId,
          lineName,
          stops: []
        };
      }

      groups[dateKey].shifts[shiftId].lines[lineId].stops.push(stop);
      groups[dateKey].totalStopsCount += 1;
      groups[dateKey].totalDurationMinutes += Number(stop.durationMinutes) || 0;
      groups[dateKey].shifts[shiftId].stopsCount += 1;
      groups[dateKey].shifts[shiftId].durationMinutes += Number(stop.durationMinutes) || 0;
    });

    return Object.values(groups);
  }, [stops, masters.shifts, masters.palletizers]);

  // ----------------- PRODUCCION DATA PROCESSING (GROUPING & METRICS) -----------------
  const groupedProduccion = useMemo(() => {
    const rawProd = prodReports || [];
    const sortedProd = [...rawProd].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const groups: Record<string, {
      date: string;
      totalTons: number;
      shifts: Record<string, {
        shiftId: string;
        shiftName: string;
        totalTons: number;
        lines: Record<string, {
          lineId: string;
          lineName: string;
          machinists: string[];
          baggers: string[];
          totalTons: number;
          reports: ProductionReport[];
          // Calculations
          runHours: number;
          availability: number;
          performance: number;
          oee: number;
        }>;
      }>;
    }> = {};

    sortedProd.forEach(rep => {
      if (!rep || !rep.date) return;
      const dateKey = rep.date;
      const shiftId = rep.shiftId || 'S_DESCONOCIDO';
      const shiftObj = masters.shifts.find(s => s.id === shiftId || s.name === rep.shiftId);
      const shiftName = shiftObj?.name || rep.shiftId || 'Shift';

      const lineId = rep.palletizerId || 'L_DESCONOCIDA';
      const lineObj = masters.palletizers.find(p => p.id === lineId || p.hacId === lineId || p.name === lineId);
      const lineName = lineObj?.name || lineId;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          totalTons: 0,
          shifts: {}
        };
      }

      if (!groups[dateKey].shifts[shiftId]) {
        groups[dateKey].shifts[shiftId] = {
          shiftId,
          shiftName,
          totalTons: 0,
          lines: {}
        };
      }

      if (!groups[dateKey].shifts[shiftId].lines[lineId]) {
        groups[dateKey].shifts[shiftId].lines[lineId] = {
          lineId,
          lineName,
          machinists: [],
          baggers: [],
          totalTons: 0,
          reports: [],
          runHours: 0,
          availability: 0,
          performance: 0,
          oee: 0
        };
      }

      const lGroup = groups[dateKey].shifts[shiftId].lines[lineId];
      lGroup.reports.push(rep);
      
      const repTons = Number(rep.tonsProduced) || 0;
      lGroup.totalTons += repTons;
      groups[dateKey].shifts[shiftId].totalTons += repTons;
      groups[dateKey].totalTons += repTons;

      // Machinist collection
      const machName = rep.machinistName || (rep.machinistId ? (masters.users.find(u => u.dni === rep.machinistId || u.name === rep.machinistId)?.name || rep.machinistId) : '');
      if (machName && !lGroup.machinists.includes(machName)) {
        lGroup.machinists.push(machName);
      }

      // Bagger collection
      const bagName = masters.baggers.find(b => b.id === rep.baggerId)?.name || rep.baggerId || 'Ensacadora';
      if (bagName && !lGroup.baggers.includes(bagName)) {
        lGroup.baggers.push(bagName);
      }
    });

    // Compute Metrics for each group (OEE, availability, performance, runHours)
    Object.keys(groups).forEach(dateK => {
      const dGroup = groups[dateK];
      Object.keys(dGroup.shifts).forEach(shiftK => {
        const sGroup = dGroup.shifts[shiftK];
        const shiftObj = masters.shifts.find(s => s.id === sGroup.shiftId);
        const shiftTotalHours = shiftObj ? shiftObj.durationHours : 8;

        Object.keys(sGroup.lines).forEach(lineK => {
          const lGroup = sGroup.lines[lineK];

          // Find ALL stops for this specific Date, Shift, and Line
          const lineStops = stops.filter(s => 
            s && s.date === dateK && 
            isStopForShift(s, sGroup.shiftId) && 
            isStopForMachine(s, lGroup.lineId)
          );

          const stopMinutes = lineStops.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
          const stopHours = stopMinutes / 60;

          // runHours is 0 if no stops registered, otherwise shiftHours - stopHours
          const runHours = lineStops.length === 0 ? 0 : Math.max(0, shiftTotalHours - stopHours);

          // External stops
          const externalStopMinutes = lineStops
            .filter(s => {
              const causeObj = masters.causes.find(c => c.id === s.causeId || c.text === s.causeText);
              const type = String(s.stopType || causeObj?.stopType || 'INTERNO').toUpperCase();
              return type === 'EXTERNO';
            })
            .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
          const externalStopHours = externalStopMinutes / 60;

          // Availability
          const actualHsMarchaVal = shiftTotalHours - stopHours;
          let availVal = shiftTotalHours > 0 ? (externalStopHours + Math.max(0, actualHsMarchaVal)) / shiftTotalHours : 0;
          availVal = Math.min(1, Math.max(0, availVal));

          // Performance
          let perfVal = 0;
          const actualHsMarchaUsed = Math.max(0, actualHsMarchaVal);
          if (lGroup.reports.length > 0 && actualHsMarchaUsed > 0) {
            const totalTons = lGroup.reports.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
            const sumTonsOverBDP = lGroup.reports.reduce((sum, r) => sum + ((Number(r.tonsProduced) || 0) / (Number(r.bdp) || 100)), 0);
            const theoreticBDPWeighted = sumTonsOverBDP > 0 ? totalTons / sumTonsOverBDP : 100;
            perfVal = Math.min(1.5, (totalTons / actualHsMarchaUsed) / theoreticBDPWeighted);
          }

          const oeeVal = availVal * perfVal;

          lGroup.runHours = Number(runHours.toFixed(1));
          lGroup.availability = Math.round(availVal * 100);
          lGroup.performance = Math.round(perfVal * 100);
          lGroup.oee = Math.round(oeeVal * 100);
        });
      });
    });

    return Object.values(groups);
  }, [prodReports, stops, masters.shifts, masters.palletizers, masters.users, masters.causes, masters.baggers]);

  // Paginated elements
  const currentGroupedItems = useMemo(() => {
    const list = activeTab === 'PAROS' ? groupedParos : groupedProduccion;
    const startIndex = (currentPage - 1) * pageSize;
    return list.slice(startIndex, startIndex + pageSize);
  }, [activeTab, groupedParos, groupedProduccion, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    const list = activeTab === 'PAROS' ? groupedParos : groupedProduccion;
    return Math.ceil(list.length / pageSize) || 1;
  }, [activeTab, groupedParos, groupedProduccion, pageSize]);

  // Excel Export logic
  const handleExportExcel = () => {
    if (activeTab === 'PAROS') {
      const sortedStops = [...stops].sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });

      const headers = [
        'TEXTO DE CAUSA', 'PUESTO DE TRABAJO', 'CENTRO', 'USUARIO', 'HAC', 'EQUIPO',
        'FECHA', 'INICIO', 'FECHAFIN', 'FIN', 'MÁQUINA AFECTADA', 'GPO.CÓD. OBJETO',
        'PARTE OBJETO', 'GPO.CÓD. SINTOMA', 'CÓD. SINTOMA', 'TEXTO SÍNTOMA',
        'TEXTO DE CAUSA', 'GPO.COD. CAUSA', 'CÓDIGO CAUSA'
      ];

      const dataRows = sortedStops.map(stop => {
        const causeObj = masters.causes.find(c => c.id === stop.causeId || c.text === stop.causeText);
        const lineObj = masters.palletizers.find(p => p.id === stop.palletizerId || p.id === stop.machineId);
        
        return [
          stop.causeText || causeObj?.text || '',
          stop.workCenter || 'OPEREXP',
          stop.center || 'AMG0',
          stop.user || '',
          stop.hacName || stop.hacId || 'N/A',
          stop.equipment || '',
          formatToSpanishDate(stop.date),
          formatToHhMm(stop.startTime),
          formatToSpanishDate(stop.finishDate || ''),
          formatToHhMm(stop.endTime || ''),
          lineObj?.name || stop.palletizerId || stop.machineId || 'N/A',
          stop.gpoCodObjeto || '',
          stop.partObject || '',
          stop.symptomGroup || '',
          stop.symptomCode || '',
          stop.symptomText || '',
          stop.causeText || causeObj?.text || '',
          stop.causeGroup || '',
          stop.causeCode || causeObj?.causeCode || stop.causeId || ''
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Paros");
      
      const startF = dateFrom.replace(/-/g, '');
      const endF = dateTo.replace(/-/g, '');
      XLSX.writeFile(wb, `Reporte_Paros_${startF}_${endF}.xlsx`);

    } else {
      // Export Production
      const flatRows: any[] = [];
      const headers = [
        'FECHA', 'TURNO', 'LÍNEA (PALETIZADORA)', 'MAQUINISTAS', 'TN PRODUCIDAS', 'TN POR PRODUCTO',
        'ENSACADORAS', 'HS MARCHA', 'RENDIMIENTO (%)', 'DISPONIBILIDAD (%)', 'OEE (%)'
      ];

      // Walk through grouped production data chronologically
      groupedProduccion.forEach(dGroup => {
        Object.keys(dGroup.shifts).forEach(shiftK => {
          const sGroup = dGroup.shifts[shiftK];
          Object.keys(sGroup.lines).forEach(lineK => {
            const lGroup = sGroup.lines[lineK];

            // Calculate tons per product
            const productTonsMap: Record<string, number> = {};
            lGroup.reports.forEach((r: any) => {
              if (r.materialsDetails && r.materialsDetails.length > 0) {
                r.materialsDetails.forEach((detail: any) => {
                  const matName = masters.materials.find(m => m.id === detail.materialId)?.name || detail.materialId || 'N/A';
                  productTonsMap[matName] = (productTonsMap[matName] || 0) + (Number(detail.tonsProduced) || 0);
                });
              } else {
                const matName = masters.materials.find(m => m.id === r.materialId)?.name || r.materialId || 'N/A';
                productTonsMap[matName] = (productTonsMap[matName] || 0) + (Number(r.tonsProduced) || 0);
              }
            });
            const productTonsStr = Object.entries(productTonsMap)
              .map(([prodName, tons]) => `${prodName}: ${tons.toFixed(1)} Tn`)
              .join(', ') || 'N/A';

            flatRows.push([
              formatToSpanishDate(dGroup.date),
              sGroup.shiftName,
              lGroup.lineName,
              lGroup.machinists.join(', ') || 'N/A',
              lGroup.totalTons,
              productTonsStr,
              lGroup.baggers.join(', ') || 'N/A',
              lGroup.runHours,
              lGroup.performance,
              lGroup.availability,
              lGroup.oee
            ]);
          });
        });
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...flatRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Producción");
      
      const startF = dateFrom.replace(/-/g, '');
      const endF = dateTo.replace(/-/g, '');
      XLSX.writeFile(wb, `Reporte_Produccion_${startF}_${endF}.xlsx`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="layout-container py-8 space-y-8"
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-6 rounded-2xl border border-border shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Informes Operacionales</h2>
            <p className="text-xs text-text-muted">Consulta consolidada y exportación con agrupación multinivel</p>
          </div>
        </div>

        {/* Date Filters & Search Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary shrink-0" />
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] cursor-pointer dark:invert-0"
              />
              <span className="text-[10px] text-text-muted font-bold">AL</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="bg-transparent border-none text-[11px] p-0 focus:ring-0 uppercase font-bold text-text-main max-w-[110px] cursor-pointer dark:invert-0"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => { 
                  const defaultTo = userContext.selectedDate || new Date().toISOString().split('T')[0];
                  const d = new Date(defaultTo);
                  d.setDate(d.getDate() - 7);
                  setDateFrom(d.toISOString().split('T')[0]);
                  setDateTo(defaultTo);
                }} 
                className="p-1 hover:text-danger ml-1 shrink-0"
                title="Restablecer"
              >
                <FilterX size={14} />
              </button>
            )}
          </div>

          <GlassButton 
            onClick={loadReportData} 
            className="h-10 px-4 w-full sm:w-auto text-xs font-bold uppercase tracking-wider gap-2 shrink-0 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary"
          >
            {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />} 
            Buscar
          </GlassButton>
        </div>
      </div>

      {/* Selector de Solapa (Tabs) and Export */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-4">
        {/* Sliders Segmented Tab Selector */}
        <div className="flex bg-bg/55 p-1 rounded-xl border border-border w-full sm:w-auto max-w-sm">
          <button 
            onClick={() => { setActiveTab('PAROS'); setCurrentPage(1); }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === 'PAROS' 
                ? "bg-primary text-white shadow-lg" 
                : "text-text-muted hover:text-text-main"
            )}
          >
            <AlertTriangle size={14} /> Reporte Paros
          </button>
          <button 
            onClick={() => { setActiveTab('PRODUCCION'); setCurrentPage(1); }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === 'PRODUCCION' 
                ? "bg-primary text-white shadow-lg" 
                : "text-text-muted hover:text-text-main"
            )}
          >
            <Package size={14} /> Reporte Producción
          </button>
        </div>

        {/* Export Button */}
        <GlassButton 
          onClick={handleExportExcel}
          disabled={isLoading || (activeTab === 'PAROS' ? stops.length === 0 : prodReports.length === 0)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 h-10 px-5 text-xs font-bold uppercase tracking-wider w-full sm:w-auto"
        >
          <Download size={14} /> Exportar Excel
        </GlassButton>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Main Table Segment */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={32} className="text-primary animate-spin" />
          <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Cargando reportes operacionales...</p>
        </div>
      ) : (activeTab === 'PAROS' ? stops.length === 0 : prodReports.length === 0) ? (
        <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center text-text-muted/50 border border-border/50 mb-4">
            <FileSpreadsheet size={28} />
          </div>
          <h3 className="text-sm font-bold text-text-main">No hay registros cargados</h3>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            No se encontraron datos registrados de {activeTab === 'PAROS' ? 'paros de máquina' : 'producción diaria'} para el rango de fechas seleccionado ({formatToSpanishDate(dateFrom)} al {formatToSpanishDate(dateTo)}).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Row */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border pb-3">
            <div className="col-span-12">Detalle de Agrupaciones (Fecha / Turno / Línea)</div>
          </div>

          {/* List of Dates (Level 1) */}
          <div className="space-y-4">
            {currentGroupedItems.map((item: any) => {
              const isExpanded = !!expandedDates[item.date];
              return (
                <div key={item.date} className="border border-border/60 rounded-xl overflow-hidden bg-surface/30">
                  {/* Date Header Row (Level 1) */}
                  <div 
                    onClick={() => toggleDate(item.date)}
                    className="flex items-center justify-between p-4 bg-surface/85 hover:bg-surface cursor-pointer select-none transition-colors border-b border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                        <Calendar size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text-main">{formatToSpanishDate(item.date)}</h4>
                        <p className="text-[10px] text-text-muted font-semibold mt-0.5 uppercase tracking-wider">
                          {activeTab === 'PAROS' 
                            ? `${item.totalStopsCount} paros registrados` 
                            : `Producción Total: ${item.totalTons.toFixed(1)} Tn`}
                        </p>
                      </div>
                    </div>
                    <div>
                      {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                    </div>
                  </div>

                  {/* Level 2 (Shifts) */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-bg/20 divide-y divide-border/30"
                      >
                        {Object.values(item.shifts).map((shift: any) => {
                          const shiftKey = `${item.date}|${shift.shiftId}`;
                          const isShiftExpanded = !!expandedShifts[shiftKey];
                          return (
                            <div key={shiftKey} className="px-4 py-2">
                              {/* Shift Header Row (Level 2) */}
                              <div 
                                onClick={() => toggleShift(shiftKey)}
                                className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated/45 hover:bg-surface-elevated/80 cursor-pointer select-none transition-colors border border-border/40"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shrink-0">
                                    <Clock size={12} />
                                  </div>
                                  <span className="text-[11px] font-bold text-text-main">Turno: {shift.shiftName}</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/10">
                                    {activeTab === 'PAROS' 
                                      ? `${shift.stopsCount} paros` 
                                      : `${shift.totalTons.toFixed(1)} Tn`}
                                  </span>
                                </div>
                                <div>
                                  {isShiftExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                                </div>
                              </div>

                              {/* Level 3 (Lines/Palletizers) */}
                              <AnimatePresence initial={false}>
                                {isShiftExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden mt-2 space-y-2 pl-4"
                                  >
                                    {Object.values(shift.lines).map((line: any) => {
                                      const lineKey = `${item.date}|${shift.shiftId}|${line.lineId}`;
                                      const isLineExpanded = !!expandedLines[lineKey];

                                      if (activeTab === 'PAROS') {
                                        return (
                                          <div key={lineKey} className="border border-border/40 rounded-lg overflow-hidden bg-surface-elevated/20">
                                            {/* Line Header for Paros */}
                                            <div 
                                              onClick={() => toggleLine(lineKey)}
                                              className="flex items-center justify-between p-2.5 hover:bg-surface-elevated/30 cursor-pointer transition-colors border-b border-border/30"
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shrink-0">
                                                  <Layers size={10} />
                                                </div>
                                                <span className="text-[11px] font-bold text-text-main">{line.lineName}</span>
                                                <span className="text-[9px] font-extrabold text-danger/80">({line.stops.length} PAROS)</span>
                                              </div>
                                              <div>
                                                {isLineExpanded ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
                                              </div>
                                            </div>

                                            {/* Stops table inside Line */}
                                            {isLineExpanded && (
                                              <div className="p-3 overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                  <thead>
                                                    <tr className="border-b border-border/40 text-[9px] font-black text-text-muted uppercase tracking-wider">
                                                      <th className="py-2">HAC PRODUCTIVO</th>
                                                      <th className="py-2">TEXTO CAUSA</th>
                                                      <th className="py-2">INICIO</th>
                                                      <th className="py-2">FIN</th>
                                                      <th className="py-2">DURACIÓN</th>
                                                      <th className="py-2">CAUSA SAP</th>
                                                      <th className="py-2 text-right">ACCIONES</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-border/20">
                                                    {line.stops.map((stop: MachineStop) => {
                                                      const causeObj = masters.causes.find(c => c.id === stop.causeId || c.text === stop.causeText);
                                                      return (
                                                        <tr 
                                                          key={stop.id}
                                                          className="text-[11px] text-text-main hover:bg-surface-elevated/45 transition-colors group"
                                                        >
                                                          <td className="py-2 font-semibold text-text-muted uppercase tracking-tighter">{stop.hacName || stop.hacId || 'N/A'}</td>
                                                          <td className="py-2 font-medium">{stop.causeText || causeObj?.text || 'N/A'}</td>
                                                          <td className="py-2 font-mono text-text-muted">{formatToHhMm(stop.startTime)}</td>
                                                          <td className="py-2 font-mono text-text-muted">{formatToHhMm(stop.endTime || '')}</td>
                                                          <td className="py-2 font-mono text-emerald-400 font-extrabold">{stop.durationMinutes} min</td>
                                                          <td className="py-2 font-mono text-text-muted/80">{stop.causeCode || causeObj?.causeCode || stop.causeId || ''}</td>
                                                          <td className="py-2 text-right">
                                                            <button 
                                                              onClick={() => setSelectedStopDetail(stop)}
                                                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-primary hover:text-primary-hover border border-primary/20 px-1.5 py-0.5 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                                                            >
                                                              <Eye size={10} /> Detalle
                                                            </button>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      } else {
                                        // Producción row style
                                        const totalMachinists = line.machinists.join(', ') || 'Sin designar';
                                        const totalBaggers = line.baggers.join(', ') || 'N/A';

                                        // Calculate tons per product
                                        const productTonsMap: Record<string, number> = {};
                                        line.reports.forEach((r: any) => {
                                          if (r.materialsDetails && r.materialsDetails.length > 0) {
                                            r.materialsDetails.forEach((detail: any) => {
                                              const matName = masters.materials.find(m => m.id === detail.materialId)?.name || detail.materialId || 'N/A';
                                              productTonsMap[matName] = (productTonsMap[matName] || 0) + (Number(detail.tonsProduced) || 0);
                                            });
                                          } else {
                                            const matName = masters.materials.find(m => m.id === r.materialId)?.name || r.materialId || 'N/A';
                                            productTonsMap[matName] = (productTonsMap[matName] || 0) + (Number(r.tonsProduced) || 0);
                                          }
                                        });

                                        return (
                                          <div key={lineKey} className="border border-border/40 rounded-lg overflow-hidden bg-surface-elevated/20 p-3">
                                            {/* Production table with aggregated stats for that line */}
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-left border-collapse">
                                                <thead>
                                                  <tr className="border-b border-border/40 text-[9px] font-black text-text-muted uppercase tracking-wider">
                                                    <th className="py-1">LÍNEA</th>
                                                    <th className="py-1">MAQUINISTA</th>
                                                    <th className="py-1">TN PRODUCIDAS</th>
                                                    <th className="py-1">ENSACADORAS</th>
                                                    <th className="py-1 text-center">REND</th>
                                                    <th className="py-1 text-center">DISP</th>
                                                    <th className="py-1 text-center">OEE</th>
                                                    <th className="py-1 text-center">HS MARCHA</th>
                                                    <th className="py-1 text-right">ACCIONES</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  <tr className="text-[11px] text-text-main">
                                                    <td className="py-2 font-bold text-primary">{line.lineName}</td>
                                                    <td className="py-2 font-medium max-w-[150px] truncate" title={totalMachinists}>{totalMachinists}</td>
                                                    <td className="py-2">
                                                      <div className="font-mono font-extrabold text-emerald-400">{line.totalTons.toFixed(1)} Tn</div>
                                                      {Object.entries(productTonsMap).map(([prodName, tons]) => (
                                                        <div key={prodName} className="text-[9px] text-text-muted mt-0.5 leading-tight">
                                                          <span className="font-semibold text-text-main">{prodName}:</span> {tons.toFixed(1)} Tn
                                                        </div>
                                                      ))}
                                                    </td>
                                                    <td className="py-2 text-text-muted text-[10px] font-semibold">{totalBaggers}</td>
                                                    <td className="py-2 text-center font-mono font-bold">{line.performance}%</td>
                                                    <td className="py-2 text-center font-mono font-bold text-blue-400">{line.availability}%</td>
                                                    <td className="py-2 text-center font-mono font-extrabold text-emerald-400">{line.oee}%</td>
                                                    <td className="py-2 text-center font-mono font-bold text-orange-400">{line.runHours} hs</td>
                                                    <td className="py-2 text-right">
                                                      <button 
                                                        onClick={() => setSelectedProductionDetail({
                                                          date: item.date,
                                                          shiftName: shift.shiftName,
                                                          palletizerName: line.lineName,
                                                          machinists: totalMachinists,
                                                          totalTons: line.totalTons,
                                                          baggersText: totalBaggers,
                                                          runHours: line.runHours,
                                                          availability: line.availability,
                                                          performance: line.performance,
                                                          oee: line.oee,
                                                          reports: line.reports
                                                        })}
                                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-primary hover:text-primary-hover border border-primary/20 px-1.5 py-0.5 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                                                      >
                                                        <Eye size={10} /> Detalle
                                                      </button>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      }
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Simple Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/40 text-text-muted text-xs">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select 
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-bg-input border border-border rounded-lg text-xs py-1 px-2 text-text-main focus:ring-1 focus:ring-primary/20 outline-none"
              >
                <option value={10}>10 fechas</option>
                <option value={20}>20 fechas</option>
                <option value={50}>50 fechas</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 font-mono">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 bg-bg/50 border border-border rounded-lg text-[10px] font-black uppercase tracking-wider hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Anterior
              </button>
              <span className="text-[11px] font-bold">
                PÁGINA {currentPage} DE {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 bg-bg/50 border border-border rounded-lg text-[10px] font-black uppercase tracking-wider hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- DETAIL MODAL: STOP DETAILED INFO ----------------- */}
      <Modal
        isOpen={selectedStopDetail !== null}
        onClose={() => setSelectedStopDetail(null)}
        title="Detalles del Paro de Máquina"
        className="max-w-lg"
      >
        {selectedStopDetail && (() => {
          const stop = selectedStopDetail;
          const causeObj = masters.causes.find(c => c.id === stop.causeId || c.text === stop.causeText);
          const lineObj = masters.palletizers.find(p => p.id === stop.palletizerId || p.id === stop.machineId);
          const shiftObj = masters.shifts.find(s => s.id === stop.shiftId);

          return (
            <div className="space-y-6 pt-2 text-text-main">
              {/* Header Badge style */}
              <div className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={18} />
                  <span className="text-xs font-black uppercase tracking-widest text-red-400">Duración: {stop.durationMinutes} min</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                  {String(stop.stopType || causeObj?.stopType || 'INTERNO').toUpperCase()}
                </span>
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Fecha</div>
                  <div className="mt-1 font-bold text-text-main">{formatToSpanishDate(stop.date)}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Turno</div>
                  <div className="mt-1 font-bold text-text-main">{shiftObj?.name || stop.shiftId || 'N/A'}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Línea (Paletizadora)</div>
                  <div className="mt-1 font-bold text-text-main">{lineObj?.name || stop.palletizerId || stop.machineId || 'N/A'}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Equipo / HAC</div>
                  <div className="mt-1 font-bold text-text-main text-primary">{stop.hacName || stop.hacId || 'N/A'}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Hora Inicio</div>
                  <div className="mt-1 font-bold text-text-main font-mono">{formatToHhMm(stop.startTime)}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Hora Fin</div>
                  <div className="mt-1 font-bold text-text-main font-mono">{formatToHhMm(stop.endTime || '')}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40 col-span-2">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Causa del Paro</div>
                  <div className="mt-1 font-bold text-text-main">{stop.causeText || causeObj?.text || 'N/A'}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Causa SAP</div>
                  <div className="mt-1 font-bold text-text-main font-mono text-primary">{stop.causeCode || causeObj?.causeCode || stop.causeId || 'N/A'}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Registrado por</div>
                  <div className="mt-1 font-bold text-text-main flex items-center gap-1.5">
                    <User size={12} className="text-text-muted" /> {stop.user || 'Desconocido'}
                  </div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40 col-span-2">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Observaciones</div>
                  <div className="mt-1 font-medium text-text-muted italic leading-relaxed">
                    {stop.observations || 'Sin observaciones registradas.'}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end border-t border-border/40 pt-4">
                <GlassButton 
                  onClick={() => setSelectedStopDetail(null)}
                  className="h-9 text-xs font-bold px-4 bg-surface"
                >
                  Cerrar
                </GlassButton>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ----------------- DETAIL MODAL: PRODUCTION GROUP DETAILED INFO ----------------- */}
      <Modal
        isOpen={selectedProductionDetail !== null}
        onClose={() => setSelectedProductionDetail(null)}
        title="Detalle de Producción de la Línea"
        className="max-w-2xl"
      >
        {selectedProductionDetail && (() => {
          const d = selectedProductionDetail;
          return (
            <div className="space-y-6 pt-2 text-text-main">
              {/* Aggregated Header Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-center">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block mb-0.5">OEE</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{d.oee}%</span>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-center">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block mb-0.5">DISP</span>
                  <span className="text-base font-black text-blue-400 font-mono">{d.availability}%</span>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-center">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block mb-0.5">REND</span>
                  <span className="text-base font-black font-mono text-text-main">{d.performance}%</span>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-center">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block mb-0.5">TN</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{d.totalTons.toFixed(1)}</span>
                </div>
              </div>

              {/* General Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Fecha y Turno</div>
                  <div className="mt-1 font-bold text-text-main">{formatToSpanishDate(d.date)} - Turno {d.shiftName}</div>
                </div>

                <div className="bg-bg/40 p-3 rounded-lg border border-border/40">
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-wider">Maquinista(s)</div>
                  <div className="mt-1 font-bold text-text-main truncate" title={d.machinists}>{d.machinists}</div>
                </div>
              </div>

              {/* Individual Production Entries Table */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-0.5">Registros de Ensacado</h5>
                <div className="border border-border/40 rounded-xl overflow-hidden bg-bg/35 max-h-[250px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 bg-surface/50 text-[9px] font-black text-text-muted uppercase tracking-wider">
                        <th className="p-3">ENSACADORA</th>
                        <th className="p-3">MATERIAL</th>
                        <th className="p-3">SACOS</th>
                        <th className="p-3">TONELADAS</th>
                        <th className="p-3">BDP</th>
                        <th className="p-3">BOQUILLAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 text-xs">
                      {d.reports.map((r, idx) => {
                        const baggerObj = masters.baggers.find(b => b.id === r.baggerId);
                        
                        if (r.materialsDetails && r.materialsDetails.length > 0) {
                          return r.materialsDetails.map((detail, dIdx) => {
                            const matObj = masters.materials.find(m => m.id === detail.materialId);
                            return (
                              <tr key={`${r.id || idx}-${dIdx}`} className="hover:bg-surface-elevated/25 transition-colors">
                                <td className="p-3 font-semibold text-text-muted uppercase tracking-tight">{baggerObj?.name || r.baggerId || 'Ensacadora'}</td>
                                <td className="p-3 font-bold text-text-main">{matObj?.name || detail.materialId || 'N/A'}</td>
                                <td className="p-3 font-mono">{detail.bagsProduced || 0}</td>
                                <td className="p-3 font-mono font-extrabold text-emerald-400">{Number(detail.tonsProduced || 0).toFixed(1)} Tn</td>
                                <td className="p-3 font-mono text-text-muted">{detail.bdp || 100} t/h</td>
                                <td className="p-3 font-mono font-bold text-primary">{r.availableNozzlesShift || 4}</td>
                              </tr>
                            );
                          });
                        }

                        const matObj = masters.materials.find(m => m.id === r.materialId);
                        return (
                          <tr key={r.id || idx} className="hover:bg-surface-elevated/25 transition-colors">
                            <td className="p-3 font-semibold text-text-muted uppercase tracking-tight">{baggerObj?.name || r.baggerId || 'Ensacadora'}</td>
                            <td className="p-3 font-bold text-text-main">{matObj?.name || r.materialId || 'N/A'}</td>
                            <td className="p-3 font-mono">{r.bagsProduced || 0}</td>
                            <td className="p-3 font-mono font-extrabold text-emerald-400">{Number(r.tonsProduced || 0).toFixed(1)} Tn</td>
                            <td className="p-3 font-mono text-text-muted">{r.bdp || 100} t/h</td>
                            <td className="p-3 font-mono font-bold text-primary">{r.availableNozzlesShift || 4}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end border-t border-border/40 pt-4">
                <GlassButton 
                  onClick={() => setSelectedProductionDetail(null)}
                  className="h-9 text-xs font-bold px-4 bg-surface"
                >
                  Cerrar
                </GlassButton>
              </div>
            </div>
          );
        })()}
      </Modal>
    </motion.div>
  );
}
