import React from 'react';
import { motion } from 'motion/react';
import { Package, Truck, Activity, Share2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../ui/GlassUI';
import { cn } from '../../lib/utils';
import { Shift, MachineStop } from '../../types';
import DashboardShareModal from './DashboardShareModal';

interface Props {
  masters: any;
  selectedShift: Shift | null;
  selectedDate: string;
  onTabChange: (tab: any) => void;
  stops: MachineStop[];
  productionReports: any[];
  inventoryEntries: any[];
  dispatchEntries: any[];
  laneStatuses: any[];
}

const MaterialStatCard = ({ item }: { item: any; key?: React.Key }) => {
  const unit = item.isUnitary ? 'U' : 'TN';
  const decimals = item.isUnitary ? 0 : 1;
  
  return (
    <div className="ui-card p-5 relative overflow-hidden group transition-all duration-500 border-primary/20">
      <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity rotate-12 z-0">
        <Package size={80} />
      </div>
      <div className="relative z-10">
        <h3 className="text-base font-black text-text-main uppercase tracking-tight truncate line-clamp-1 mb-4 border-b border-primary/20 pb-2">
          {item.name}
        </h3>
        
        <div className="space-y-3">
          {!item.isBigBag && (
            <>
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Stock Contado</span>
                <span className="font-mono text-base font-bold text-text-main">{item.stock.toFixed(decimals)} {unit}</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Prod. Turno (+)</span>
                <span className="font-mono text-base font-bold text-emerald-400">{(item.production || 0).toFixed(decimals)} {unit}</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Despacho (-)</span>
                <span className="font-mono text-base font-bold text-red-500">{(item.dispatch || 0).toFixed(decimals)} {unit}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline pt-2">
            <span className="text-[11px] text-text-main font-black uppercase tracking-widest">Total Disp.</span>
            <span className="font-mono text-2xl font-black text-primary">{item.total.toFixed(decimals)} {unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const isStopForMachine = (stop: MachineStop | null | undefined, machine: any, mastersAvailable: any) => {
  if (!stop || !machine) return false;
  
  // 1. Get the targetId helper
  let targetId = "";
  if (typeof machine === 'object' && machine !== null) {
    targetId = String(machine.id || machine.hacId || machine.hac_id || machine.name || machine.nombre || "").trim().toUpperCase();
  } else {
    targetId = String(machine).trim().toUpperCase();
  }
  
  if (!targetId) return false;

  // 2. Find the selected machine object in palletizers or baggers
  const selectedMac: any = (mastersAvailable.palletizers || []).find((p: any) => p && (
    String(p.id).trim().toUpperCase() === targetId ||
    String(p.hacId || p.hac_id || "").trim().toUpperCase() === targetId ||
    String(p.name || p.nombre || "").trim().toUpperCase() === targetId
  )) || (mastersAvailable.baggers || []).find((b: any) => b && (
    String(b.id).trim().toUpperCase() === targetId ||
    String(b.hacId || b.hac_id || "").trim().toUpperCase() === targetId ||
    String(b.name || b.nombre || "").trim().toUpperCase() === targetId
  ));

  // Stop's fields
  const stopMachineId = String(stop.machineId || "").trim().toUpperCase();
  const stopMachineName = String(stop.machineName || "").trim().toUpperCase();
  const stopMachineHacText = String(stop.machineHacText || "").trim().toUpperCase();
  const stopHacName = String(stop.hacName || (stop as any).hac || "").trim().toUpperCase();

  if (!selectedMac) {
    // If we can't find reference in master tables, check if stop's fields strictly equal targetId
    return stopMachineId === targetId || stopMachineHacText === targetId || stopMachineName === targetId || stopHacName === targetId;
  }

  // Machine's fields
  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();

  // Strict match among any of the stop and mac fields
  const stopFields = [stopMachineId, stopMachineName, stopMachineHacText, stopHacName].filter(Boolean);
  const macFields = [macId, macName, macHacId].filter(Boolean);

  for (const sField of stopFields) {
    for (const mField of macFields) {
      if (sField === mField) return true;
    }
  }

  // Double check loose comparison (ignoring punctuation / space / special characters)
  const cleanStr = (val: string) => val.replace(/[^A-Z0-9]/g, '');
  const cleanStopFields = stopFields.map(cleanStr).filter(Boolean);
  const cleanMacFields = macFields.map(cleanStr).filter(Boolean);

  for (const sClean of cleanStopFields) {
    for (const mClean of cleanMacFields) {
      if (sClean === mClean) return true;
    }
  }

  // Special inclusion match if they contain HAC ID (e.g. "MG.673-PZ1")
  if (macHacId && (stopMachineHacText.includes(macHacId) || macHacId.includes(stopMachineHacText))) return true;
  if (macHacId && (stopHacName.includes(macHacId) || macHacId.includes(stopHacName))) return true;

  return false;
};

export default function DashboardView({ masters, selectedShift, selectedDate, onTabChange, stops, productionReports, inventoryEntries, dispatchEntries, laneStatuses }: Props) {
  const [isShareOpen, setIsShareOpen] = React.useState(false);

  const displayDate = React.useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Inventory Analysis
  const inventorySummary = React.useMemo(() => {
    const groups: {
      productive: any[],
      tarimas: any[],
      bigbags: any[],
      insumos: any[],
      others: any[]
    } = { productive: [], tarimas: [], bigbags: [], insumos: [], others: [] };

    masters.materials.forEach((m: any) => {
      const materialEntries = (inventoryEntries || []).filter(e => e.materialId === m.id);
      const stockVal = materialEntries.reduce((sum, e) => sum + (Number(e.weightTn) || 0), 0);
      
      const isUnitary = m.isPallet || m.isSupply || m.isBigBag;
      
      const productionVal = m.isProductive 
        ? productionReports.filter(r => r.materialId === m.id)
            .reduce((sum, r) => {
              const val = isUnitary ? (r.bagsProduced || 0) : (r.tonsProduced || 0);
              return sum + (Number(val) || 0);
            }, 0)
        : 0;

      const dispatchVal = (m.isProductive || m.isBigBag || m.isPallet)
        ? (dispatchEntries || []).filter(d => d.materialId === m.id)
            .reduce((sum, d) => sum + (Number(d.tons) || 0), 0)
        : 0;

      // Only show if there is actual activity or a count record
      if (materialEntries.length > 0 || productionVal > 0 || dispatchVal > 0) {
        const item = {
          id: m.id,
          name: m.name,
          stock: stockVal,
          production: productionVal,
          dispatch: dispatchVal,
          total: stockVal + productionVal - dispatchVal,
          isUnitary,
          isProductive: m.isProductive,
          isBigBag: m.isBigBag
        };

        if (m.isPallet) {
          groups.tarimas.push(item);
        } else if (m.isBigBag) {
          groups.bigbags.push(item);
        } else if (m.isSupply) {
          groups.insumos.push(item);
        } else if (m.isProductive) {
          groups.productive.push(item);
        } else {
          groups.others.push(item);
        }
      }
    });

    return groups;
  }, [inventoryEntries, productionReports, dispatchEntries, masters.materials]);

  const hasAnyInventory = 
    inventorySummary.productive.length > 0 || 
    inventorySummary.bigbags.length > 0 ||
    inventorySummary.tarimas.length > 0 ||
    inventorySummary.insumos.length > 0 ||
    inventorySummary.others.length > 0;

  // Palletizer Detailed Analysis
  const palletizerData = React.useMemo(() => {
    return masters.palletizers.map((p: any) => {
      const lineStops = stops.filter(s => s && isStopForMachine(s, p, masters));
      const lineReports = productionReports.filter(r => r.palletizerId === p.id);

      // 1. Top 4 Relevant Internal Stops
      const topStops = [...lineStops]
        .filter(s => {
          const causeObj = masters.causes.find(c => c.id === s.causeId || c.text === s.causeText);
          const type = String(s.stopType || causeObj?.stopType || 'INTERNO').toUpperCase();
          return type === 'INTERNO' || type === 'INTERNAL';
        })
        .sort((a, b) => (Number(b.durationMinutes) || 0) - (Number(a.durationMinutes) || 0))
        .slice(0, 4);

      // 2. Tons per Material
      const tonsByMaterial = lineReports.reduce((acc, r) => {
        const details = r.materialsDetails || [];
        if (details.length > 0) {
          details.forEach((det: any) => {
            const mId = det.materialId;
            if (mId) {
              acc[mId] = (acc[mId] || 0) + (Number(det.tonsProduced) || 0);
            }
          });
        } else if (r.materialId) {
          acc[r.materialId] = (acc[r.materialId] || 0) + (Number(r.tonsProduced) || 0);
        }
        return acc;
      }, {} as Record<string, number>);

      // 2b. Detailed grouping by Bagger and Material (Option B breakdown)
      const prodByBaggerAndMaterial: Record<string, Record<string, number>> = {};
      lineReports.forEach(r => {
        const baggerName = masters.baggers.find((b: any) => b.id === r.baggerId)?.name || 'Ensacadora';
        if (!prodByBaggerAndMaterial[baggerName]) {
          prodByBaggerAndMaterial[baggerName] = {};
        }

        const details = r.materialsDetails || [];
        if (details.length > 0) {
          details.forEach((det: any) => {
            const mId = det.materialId;
            if (mId) {
              prodByBaggerAndMaterial[baggerName][mId] = (prodByBaggerAndMaterial[baggerName][mId] || 0) + (Number(det.tonsProduced) || 0);
            }
          });
        } else if (r.materialId) {
          prodByBaggerAndMaterial[baggerName][r.materialId] = (prodByBaggerAndMaterial[baggerName][r.materialId] || 0) + (Number(r.tonsProduced) || 0);
        }
      });

      // 3. Operating Hours (Run time)
      const shiftTotalHours = selectedShift ? selectedShift.durationHours : 8;
      const stopMinutes = lineStops.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
      const stopHours = stopMinutes / 60;

      // "las hs de marcha, por defecto deben aparecer en cero, solo si se registra algun tipo de paro.
      // si en el turno no se han reportado paros, deberían figurar en cero."
      const runHours = lineStops.length === 0 ? "0" : Math.max(0, shiftTotalHours - stopHours).toFixed(1);

      // Calculations of OEE, availability & performance
      const externalStopMinutes = lineStops
        .filter(s => {
          const causeObj = masters.causes.find(c => c.id === s.causeId || c.text === s.causeText);
          const type = String(s.stopType || causeObj?.stopType || 'INTERNO').toUpperCase();
          return type === 'EXTERNO';
        })
        .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
      const externalStopHours = externalStopMinutes / 60;

      const actualHsMarchaVal = shiftTotalHours - stopHours;
      let availVal = shiftTotalHours > 0 ? (externalStopHours + Math.max(0, actualHsMarchaVal)) / shiftTotalHours : 0;
      availVal = Math.min(1, Math.max(0, availVal));

      let perfVal = 0;
      const actualHsMarchaUsed = Math.max(0, actualHsMarchaVal);
      if (lineReports.length > 0 && actualHsMarchaUsed > 0) {
        const totalTons = lineReports.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
        const sumTonsOverBDP = lineReports.reduce((sum, r) => sum + ((Number(r.tonsProduced) || 0) / (Number(r.bdp) || 100)), 0);
        const theoreticBDPWeighted = sumTonsOverBDP > 0 ? totalTons / sumTonsOverBDP : 100;
        perfVal = Math.min(1.5, (totalTons / actualHsMarchaUsed) / theoreticBDPWeighted);
      }

      const oeeVal = availVal * perfVal;

      const oee = Math.round(oeeVal * 100);
      const availability = Math.round(availVal * 100);
      const performance = Math.round(perfVal * 100);

      // 4. Nozzles info
      const activeNozzles = lineReports.map(r => ({
        baggerName: masters.baggers.find((b: any) => b.id === r.baggerId)?.name || 'Bagger',
        nozzles: r.availableNozzlesShift
      }));

      return {
        palletizer: p,
        topStops,
        tonsByMaterial,
        prodByBaggerAndMaterial,
        runHours,
        oee,
        availability,
        performance,
        activeNozzles,
        totalTons: lineReports.reduce((sum, r) => {
          const details = r.materialsDetails || [];
          if (details.length > 0) {
            return sum + details.reduce((s, det) => s + (Number(det.tonsProduced) || 0), 0);
          }
          return sum + (Number(r.tonsProduced) || 0);
        }, 0)
      };
    });
  }, [masters.palletizers, masters.materials, masters.baggers, stops, productionReports, selectedShift]);

  // Group loading points by type
  const groupedLoadingPoints = React.useMemo(() => {
    return masters.loadingPoints.reduce((acc: any, lp: any) => {
      if (!acc[lp.type]) acc[lp.type] = [];
      acc[lp.type].push(lp);
      return acc;
    }, {} as Record<string, any[]>);
  }, [masters.loadingPoints]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }} 
      className="layout-container py-8 space-y-8"
    >
      {/* HEADER PRINCIPAL DEL DASHBOARD */}
      <GlassCard className="p-6 md:p-8 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-main uppercase tracking-[0.1em] leading-tight logo-glow">
              Dashboard de Operaciones
            </h1>
            <p className="text-[10px] sm:text-xs text-text-muted uppercase font-black tracking-widest mt-2">
              Resumen de <span className="text-primary font-black">{selectedShift?.name || 'Turno'}</span> con la fecha <span className="text-primary font-black">{displayDate}</span>
            </p>
          </div>
          <div className="shrink-0 flex items-center w-full md:w-auto">
            <GlassButton
              onClick={() => setIsShareOpen(true)}
              className="h-12 px-6 text-xs font-black tracking-widest flex items-center justify-center gap-2.5 btn-active-highlight shadow-lg uppercase w-full md:w-auto"
            >
              <Share2 size={14} className="text-text-main" />
              Compartir Resumen
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* SECCIÓN 1: RESUMEN DE STOCK E INSUMOS */}
      {hasAnyInventory && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-primary/20 pb-4 mb-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Package className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-text-main uppercase tracking-[0.15em] leading-tight">Resumen de Stock e Insumos</h2>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Conteo Físico + Producción Turno Actual</p>
              </div>
            </div>
            <GlassButton 
              onClick={() => onTabChange('STOCK')}
              className="h-10 px-6 text-[10px] font-black tracking-widest w-full sm:w-auto"
            >
              GESTIONAR INVENTARIO
            </GlassButton>
          </div>

          {/* Individual Cards (Productive & Bigbags) */}
          {(inventorySummary.productive.length > 0 || inventorySummary.bigbags.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...inventorySummary.productive, ...inventorySummary.bigbags].map((item, idx) => (
                <MaterialStatCard key={item.id || idx} item={item} />
              ))}
            </div>
          )}

          {/* Grouped Inventory Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              { [
                { label: 'Tarimas', data: inventorySummary.tarimas },
                { label: 'Insumos', data: inventorySummary.insumos },
                { label: 'No Productivos / Otros', data: inventorySummary.others },
              ].filter(g => g.data.length > 0).map((group, gIdx) => {
                const hasProductive = group.data.some((it: any) => it.isProductive);
                return (
                  <GlassCard key={gIdx} className="p-0 overflow-hidden border-primary/5">
                    <div className="px-5 py-4 bg-bg/20 border-b border-white/5 flex justify-between items-center">
                        <h5 className="text-sm font-black text-text-main uppercase tracking-[0.2em]">{group.label}</h5>
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">{group.data.length} ÍTEMS</span>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-bg/40 text-[10px] uppercase font-black text-text-muted tracking-widest">
                          <tr>
                              <th className="px-6 py-4">Material</th>
                              {hasProductive && <th className="px-6 py-4 text-right">Stock</th>}
                              {hasProductive && <th className="px-6 py-4 text-right">Prod.</th>}
                              {hasProductive && <th className="px-6 py-4 text-right">Desp.</th>}
                              <th className="px-6 py-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {group.data.map((item: any, idx: number) => {
                              const unit = item.isUnitary ? 'U' : 'TN';
                              const decimals = item.isUnitary ? 0 : 1;
                              return (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-text-main uppercase">{item.name}</span>
                                        {item.isProductive && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Productivo</span>}
                                    </div>
                                  </td>
                                  {hasProductive && (
                                    <td className="px-6 py-4 text-right font-mono text-xs text-text-muted">
                                      {item.isProductive ? item.stock.toFixed(decimals) : '-'}
                                    </td>
                                  )}
                                  {hasProductive && (
                                    <td className="px-6 py-4 text-right font-mono text-xs text-emerald-400">
                                      {item.isProductive && item.production > 0 ? `+${item.production.toFixed(decimals)}` : '-'}
                                    </td>
                                  )}
                                  {hasProductive && (
                                    <td className="px-6 py-4 text-right font-mono text-xs text-red-500">
                                      {item.isProductive && item.dispatch > 0 ? `-${item.dispatch.toFixed(decimals)}` : '-'}
                                    </td>
                                  )}
                                  <td className="px-6 py-4 text-right">
                                    <span className="font-mono text-base font-black text-primary">{item.total.toFixed(decimals)} {unit}</span>
                                  </td>
                                </tr>
                              );
                          })}
                        </tbody>
                    </table>
                  </GlassCard>
                );
              })}
          </div>
        </section>
      )}

      {/* SECCIÓN 2: PRODUCTIVIDAD */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-primary/20 pb-4 mb-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Activity className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main uppercase tracking-[0.15em] leading-tight">Productividad</h2>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Rendimiento de Líneas de Producción</p>
            </div>
          </div>
          <GlassButton 
            onClick={() => onTabChange('PRODUCCION')}
            className="h-10 px-6 text-[10px] font-black tracking-widest w-full sm:w-auto"
          >
            VER REPORTES
          </GlassButton>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {palletizerData.map(({ palletizer, topStops, tonsByMaterial, prodByBaggerAndMaterial, runHours, oee, availability, performance, activeNozzles, totalTons }) => (
            <GlassCard key={palletizer.id} className="p-8 overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-4">
                <h3 className="text-2xl font-black text-text-main uppercase tracking-tight">{palletizer.name}</h3>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* Hs Marcha */}
                  <div className="text-center flex flex-col items-center min-w-[55px]">
                     <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Hs Marcha</span>
                     <span className="text-xl sm:text-2xl font-black text-primary font-mono leading-none tracking-tighter">{runHours}</span>
                  </div>
                  {/* OEE */}
                  <div className="text-center flex flex-col items-center border-l border-white/10 pl-3 min-w-[45px]">
                     <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">OEE</span>
                     <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono leading-none tracking-tight">{oee}%</span>
                  </div>
                  {/* Disponibilidad */}
                  <div className="text-center flex flex-col items-center border-l border-white/10 pl-3 min-w-[55px]">
                     <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Dispon.</span>
                     <span className="text-lg sm:text-xl font-black text-blue-400 font-mono leading-none tracking-tight">{availability}%</span>
                  </div>
                  {/* Rendimiento */}
                  <div className="text-center flex flex-col items-center border-l border-white/10 pl-3 min-w-[55px]">
                     <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Rend.</span>
                     <span className="text-lg sm:text-xl font-black text-pink-400 font-mono leading-none tracking-tight">{performance}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Top 4 Paros */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 border-red-500 pl-3">
                     Incidentes Relevantes
                  </h4>
                  <div className="space-y-2.5">
                     {topStops.length > 0 ? topStops.map(stop => (
                       <div key={stop.id} className="bg-bg/40 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:border-red-500/30 transition-all">
                          <div>
                            <p className="text-xs font-bold text-text-main leading-tight line-clamp-1 group-hover:text-red-400 transition-colors">
                              {stop.causeText || masters.causes.find(c => c.id === stop.causeId)?.text || 'Sin causa'}
                            </p>
                            <p className="text-[9px] text-text-muted uppercase font-black mt-1 tracking-widest opacity-60">HAC: {stop.hacName || 'N/A'}</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-black text-red-500">{stop.durationMinutes}m</p>
                          </div>
                       </div>
                     )) : (
                       <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-xl">
                         <p className="text-[10px] text-text-muted italic uppercase font-bold">Sin paros reportados</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Producción por Material y Boquillas */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                       Producción por Ensacadora
                    </h4>
                    <div className="space-y-3 relative">
                      {Object.keys(prodByBaggerAndMaterial || {}).length > 0 ? Object.entries(prodByBaggerAndMaterial || {}).map(([baggerName, matTonsObj]) => (
                        <div key={baggerName} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl space-y-2 group transition-all duration-300 hover:border-emerald-500/10">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block border-b border-white/5 pb-1 select-none">
                            Línea: {baggerName}
                          </span>
                          <div className="space-y-1">
                            {Object.entries(matTonsObj).map(([mId, tons]) => {
                              const t = tons as number;
                              const mName = masters.materials.find((m: any) => m.id === mId)?.name || 'Material Desconocido';
                              return (
                                <div key={mId} className="flex items-center justify-between py-1 px-0.5 rounded transition-all">
                                  <span className="text-xs font-bold text-text-main uppercase">{mName}</span>
                                  <span className="text-xs font-black text-text-main font-mono text-right">{t.toFixed(1)} TN</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )) : (
                        <p className="text-[10px] text-text-muted italic py-4">Sin producción registrada</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 border-amber-500 pl-3">
                       Boquillas Activas
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {activeNozzles.length > 0 ? activeNozzles.map((nozzle, idx) => (
                        <div key={idx} className="bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 rounded-xl flex flex-col justify-center">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">{nozzle.baggerName}</p>
                          <p className="text-xl font-black text-amber-500 font-mono tracking-tighter">{nozzle.nozzles}</p>
                        </div>
                      )) : (
                        <p className="text-[10px] text-text-muted italic">Sin datos</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* SECCIÓN 3: CALLES DE CARGA */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-primary/20 pb-4 mb-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Truck className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main uppercase tracking-[0.15em] leading-tight">Calles de Carga</h2>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Disponibilidad de Despacho en Tiempo Real</p>
            </div>
          </div>
          <GlassButton 
            onClick={() => onTabChange('LOADING_LANES')}
            className="h-10 px-6 text-[10px] font-black tracking-widest w-full sm:w-auto"
          >
            GESTIONAR CALLES
          </GlassButton>
        </div>

        <GlassCard className="p-0 overflow-hidden border-primary/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg/40 text-[10px] uppercase font-black text-text-muted tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-5">Identificador de Calle</th>
                  <th className="px-8 py-5">Estado de Operación</th>
                  <th className="px-8 py-5">Materiales / Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(groupedLoadingPoints).map(([type, points]: [string, any]) => (
                  <React.Fragment key={type}>
                    <tr className={cn(
                      "border-b border-white/5",
                      type === 'BOLSA' ? "bg-blue-500/[0.05]" : "bg-amber-500/[0.05]"
                    )}>
                       <td colSpan={3} className="px-8 py-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-[0.3em]",
                            type === 'BOLSA' ? "text-blue-500" : "text-amber-500"
                          )}>{type === 'BOLSA' ? 'Logística Bolsa' : 'Logística Granel'}</span>
                       </td>
                    </tr>
                    {points.map((lp: any) => {
                      const status = laneStatuses.find((s: any) => s.loadingPointId === lp.id);
                      const isEnabled = status ? status.isEnabled : true;
                      
                      return ( status ? (
                        <tr key={lp.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-8 py-6">
                            <span className="text-lg font-black text-text-main uppercase tracking-tight">{lp.name}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                                isEnabled ? "bg-emerald-500 shadow-emerald-500/50" : "bg-red-500 shadow-red-500/50"
                              )} />
                              <span className={cn(
                                "text-xs font-black uppercase tracking-widest",
                                isEnabled ? "text-emerald-500" : "text-red-500"
                              )}>
                                {isEnabled ? 'OPERATIVA' : 'FUERA DE SERVICIO'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {isEnabled ? (
                              <div className="flex flex-wrap gap-2">
                                {status.materialIds.length > 0 ? (
                                  status.materialIds.map((mid: string) => (
                                    <span key={mid} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black border border-primary/20 uppercase tracking-tighter">
                                      {masters.materials.find((m: any) => m.id === mid)?.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs font-bold text-emerald-500/40 uppercase italic tracking-widest">Disponible para carga general</span>
                                )}
                              </div>
                            ) : (
                              <div className="bg-red-500/5 border border-red-500/20 px-4 py-2 rounded-xl">
                                <p className="text-sm font-bold text-red-400 italic">
                                   Reporte: {status.observation || 'Sin detalles adicionales'}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        <tr key={lp.id} className="opacity-40">
                          <td className="px-8 py-6">
                            <span className="text-lg font-black text-text-main uppercase tracking-tight">{lp.name}</span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-widest italic">Sin reporte de turno</span>
                          </td>
                          <td className="px-8 py-6 text-text-muted/40 italic text-xs">
                             Esperando actualización de estado...
                          </td>
                        </tr>
                      ));
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
      {/* MODAL DE EXPORTACIÓN Y COMPARTIR */}
      <DashboardShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        selectedShift={selectedShift}
        selectedDate={selectedDate}
        masters={masters}
        inventorySummary={inventorySummary}
        palletizerData={palletizerData}
        groupedLoadingPoints={groupedLoadingPoints}
        laneStatuses={laneStatuses}
      />
    </motion.div>
  );
}
