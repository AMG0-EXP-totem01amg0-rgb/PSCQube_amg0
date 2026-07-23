import React from 'react';
import { motion } from 'motion/react';
import { Package, Truck, Activity, Share2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../../ui/GlassUI';
import { cn } from '../../../lib/utils';
import { Shift, MachineStop } from '../../../types';
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
  allProductionReports?: any[];
  allDispatchEntries?: any[];
}

const MaterialStatCard = ({ item }: { item: any; key?: React.Key }) => {
  const unit = item.isUnitary ? 'U' : 'TN';
  const decimals = item.isProductive ? 0 : (item.isUnitary ? 0 : 1);
  
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
              
              {item.isProductive && item.shiftProduction && item.shiftProduction.length > 0 ? (
                <div className="space-y-2 border-b border-white/5 pb-2">
                  <div className="space-y-1 bg-white/[0.01] border border-white/5 p-2 rounded-lg">
                    {item.shiftProduction.map((sp: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-baseline">
                        <span className="text-[10px] text-text-muted font-medium">Ttal {sp.shiftName} (+)</span>
                        <span className="font-mono text-xs font-semibold text-emerald-400">{(sp.amount || 0).toFixed(decimals)} {unit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Total Producido</span>
                    <span className="font-mono text-base font-bold text-emerald-400">{(item.production || 0).toFixed(decimals)} {unit}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Prod. Turno (+)</span>
                  <span className="font-mono text-base font-bold text-emerald-400">{(item.production || 0).toFixed(decimals)} {unit}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Despacho (-)</span>
                <span className="font-mono text-base font-bold text-red-500">{(item.dispatch || 0).toFixed(decimals)} {unit}</span>
              </div>
            </>
          )}
          {item.isBigBag ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-1 gap-2 sm:gap-4">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Total Disponible BigBag</span>
              <span className="font-mono text-2xl font-black text-primary">{item.total.toFixed(decimals)} {unit}</span>
            </div>
          ) : (
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-[11px] text-text-main font-black uppercase tracking-widest">Total Disp.</span>
              <span className="font-mono text-2xl font-black text-primary">{item.total.toFixed(decimals)} {unit}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NozzleObservationItem = ({ observation }: { observation: string; key?: React.Key }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isLong = observation.length > 100;

  return (
    <div className="text-[10px] text-text-muted mt-1 border-t border-white/5 pt-1.5 leading-snug w-full text-left">
      <div 
        className={cn(
          "transition-all duration-300", 
          !isExpanded && isLong && "line-clamp-3"
        )}
        style={{
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          lineHeight: '1.35',
          maxWidth: '100%',
        }}
      >
        • {observation}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-amber-500 hover:text-amber-400 font-extrabold text-[8px] uppercase tracking-wider mt-1 hover:underline focus:outline-none transition-all block cursor-pointer"
        >
          {isExpanded ? 'Ver Menos' : 'Ver Más'}
        </button>
      )}
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

  if (!selectedMac) {
    // If we can't find reference in master tables, check if stop's fields strictly equal targetId
    return stopMachineId === targetId || stopMachineHacText === targetId || stopMachineName === targetId;
  }

  // Machine's fields
  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();

  // Strict match among any of the stop and mac fields
  const stopFields = [stopMachineId, stopMachineName, stopMachineHacText].filter(Boolean);
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

  return false;
};

export default function DashboardView({ 
  masters, 
  selectedShift, 
  selectedDate, 
  onTabChange, 
  stops, 
  productionReports, 
  inventoryEntries, 
  dispatchEntries, 
  laneStatuses,
  allProductionReports = [],
  allDispatchEntries = []
}: Props) {
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

    const getShiftStartTime = (shiftId: string) => {
      const shift = (masters.shifts || []).find((s: any) => s.id === shiftId);
      return shift ? shift.startTime : "00:00";
    };

    const getShiftOrder = (shId: string) => {
      const normalized = String(shId).toUpperCase().trim();
      if (normalized.includes('S3') || normalized.includes('T3') || normalized.includes('NOCHE')) return 1;
      if (normalized.includes('S1') || normalized.includes('T1') || normalized.includes('MAÑANA') || normalized.includes('MANANA')) return 2;
      if (normalized.includes('S2') || normalized.includes('T2') || normalized.includes('TARDE')) return 3;
      return 4;
    };

    const indexedEntries = (inventoryEntries || []).map((e, index) => ({ ...e, index }));
    const sortedEntries = indexedEntries.sort((a, b) => {
      const timeA = getShiftStartTime(a.shiftId);
      const timeB = getShiftStartTime(b.shiftId);
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
      return a.index - b.index;
    });

    const currentOrder = selectedShift ? getShiftOrder(selectedShift.id) : 2;

    masters.materials.forEach((m: any) => {
      const isUnitary = m.isPallet || m.isSupply || m.isBigBag;

      let stockVal = 0;
      let productionVal = 0;
      let dispatchVal = 0;
      let totalVal = 0;
      let shiftProduction: { shiftName: string; amount: number }[] = [];

      if (m.isProductive) {
        // Special cumulative logic for productive materials
        // 1. Stock: sum of physical stock entries up to the current shift
        const stockEntriesUpToCurrent = (inventoryEntries || [])
          .filter(e => e.materialId === m.id && getShiftOrder(e.shiftId) <= currentOrder);
        stockVal = stockEntriesUpToCurrent.reduce((sum, e) => sum + (Number(e.weightTn) || 0), 0);

        // 2. Production: sum of production from shifts up to current shift
        const prodData = allProductionReports || productionReports || [];
        productionVal = prodData
          .filter(r => getShiftOrder(r.shiftId) <= currentOrder)
          .reduce((sum, r) => {
            const details = r.materialsDetails || [];
            if (details.length > 0) {
              const matchedDetails = details.filter((det: any) => det.materialId === m.id);
              const subSum = matchedDetails.reduce((dSum: number, det: any) => {
                const val = det.tonsProduced || 0;
                return dSum + (Number(val) || 0);
              }, 0);
              return sum + subSum;
            } else if (r.materialId === m.id) {
              const val = r.tonsProduced || 0;
              return sum + (Number(val) || 0);
            }
            return sum;
          }, 0);

        // Calculate shift production breakdown
        const sortedShifts = [...(masters.shifts || [])].sort((a, b) => getShiftOrder(a.id) - getShiftOrder(b.id));
        sortedShifts.forEach((sh: any) => {
          if (getShiftOrder(sh.id) <= currentOrder) {
            const shProd = prodData
              .filter(r => r.shiftId === sh.id)
              .reduce((sum, r) => {
                const details = r.materialsDetails || [];
                if (details.length > 0) {
                  const matchedDetails = details.filter((det: any) => det.materialId === m.id);
                  const subSum = matchedDetails.reduce((dSum: number, det: any) => {
                    const val = det.tonsProduced || 0;
                    return dSum + (Number(val) || 0);
                  }, 0);
                  return sum + subSum;
                } else if (r.materialId === m.id) {
                  const val = r.tonsProduced || 0;
                  return sum + (Number(val) || 0);
                }
                return sum;
              }, 0);
            shiftProduction.push({
              shiftName: sh.name,
              amount: shProd
            });
          }
        });

        // 3. Dispatch: Calculate raw dispatches for S3, S1, S2
        const dispData = allDispatchEntries || dispatchEntries || [];
        const s3Dispatch = dispData
          .filter(d => d.materialId === m.id && getShiftOrder(d.shiftId) === 1)
          .reduce((sum, d) => sum + (Number(d.tons) || 0), 0);

        const s1Dispatch = dispData
          .filter(d => d.materialId === m.id && getShiftOrder(d.shiftId) === 2)
          .reduce((sum, d) => sum + (Number(d.tons) || 0), 0);

        const s2RawDispatch = dispData
          .filter(d => d.materialId === m.id && getShiftOrder(d.shiftId) === 3)
          .reduce((sum, d) => sum + (Number(d.tons) || 0), 0);

        // Afternoon net dispatch is raw S2 dispatch minus S1 dispatch
        const s2Dispatch = Math.max(0, s2RawDispatch - s1Dispatch);

        let totalDispatchToSubtract = 0;
        if (currentOrder === 1) {
          dispatchVal = s3Dispatch;
          totalDispatchToSubtract = s3Dispatch;
        } else if (currentOrder === 2) {
          dispatchVal = s1Dispatch;
          totalDispatchToSubtract = s3Dispatch + s1Dispatch;
        } else if (currentOrder === 3) {
          dispatchVal = s2Dispatch; // Net afternoon dispatch
          totalDispatchToSubtract = s3Dispatch + s1Dispatch + s2Dispatch;
        } else {
          dispatchVal = dispData
            .filter(d => d.materialId === m.id && d.shiftId === selectedShift?.id)
            .reduce((sum, d) => sum + (Number(d.tons) || 0), 0);
          totalDispatchToSubtract = dispatchVal;
        }

        totalVal = stockVal + productionVal - totalDispatchToSubtract;
      } else {
        // Standard single-shift logic for other materials
        const materialEntries = sortedEntries.filter(e => e.materialId === m.id);
        const latestEntry = materialEntries.length > 0 ? materialEntries[materialEntries.length - 1] : null;
        stockVal = latestEntry ? (Number(latestEntry.weightTn) || 0) : 0;

        productionVal = (productionReports || []).reduce((sum, r) => {
          const details = r.materialsDetails || [];
          if (details.length > 0) {
            const matchedDetails = details.filter((det: any) => det.materialId === m.id);
            const subSum = matchedDetails.reduce((dSum: number, det: any) => {
              const val = isUnitary ? (det.bagsProduced || 0) : (det.tonsProduced || 0);
              return dSum + (Number(val) || 0);
            }, 0);
            return sum + subSum;
          } else if (r.materialId === m.id) {
            const val = isUnitary ? (r.bagsProduced || 0) : (r.tonsProduced || 0);
            return sum + (Number(val) || 0);
          }
          return sum;
        }, 0);

        dispatchVal = (dispatchEntries || []).filter(d => d.materialId === m.id)
          .reduce((sum, d) => sum + (Number(d.tons) || 0), 0);

        stockVal = Math.max(0, stockVal);
        productionVal = Math.max(0, productionVal);
        dispatchVal = Math.max(0, dispatchVal);
        totalVal = Math.max(0, stockVal + productionVal - dispatchVal);
      }

      const isBulk = Boolean(m.isBulk || m['es_granel?'] || m.es_granel || m['es_granel']);
      const materialEntries = sortedEntries.filter(e => e.materialId === m.id);
      // Always show productive materials individually, otherwise check for actual activity or records
      if (m.isProductive || materialEntries.length > 0 || productionVal > 0 || dispatchVal > 0) {
        const item = {
          id: m.id,
          name: m.name,
          stock: stockVal,
          production: productionVal,
          dispatch: dispatchVal,
          total: totalVal,
          isUnitary,
          isProductive: m.isProductive,
          isBigBag: m.isBigBag,
          isBulk,
          shiftProduction: m.isProductive ? shiftProduction : undefined
        };

        if (m.isPallet) {
          groups.tarimas.push(item);
        } else if (m.isBigBag) {
          groups.bigbags.push(item);
        } else if (m.isSupply) {
          if (!isBulk) {
            groups.insumos.push(item);
          }
        } else if (m.isProductive) {
          groups.productive.push(item);
        } else {
          if (!isBulk) {
            groups.others.push(item);
          }
        }
      }
    });

    return groups;
  }, [inventoryEntries, productionReports, dispatchEntries, allProductionReports, allDispatchEntries, masters.materials, masters.shifts, selectedShift]);

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
      const activeNozzles = lineReports.map(r => {
        const details = r.materialsDetails || [];
        const observations = details
          .map((det: any) => det.observacion || det.observation)
          .filter((obs: any) => obs && String(obs).trim() !== "")
          .map((obs: any) => String(obs).trim());

        return {
          baggerName: masters.baggers.find((b: any) => b.id === r.baggerId)?.name || 'Bagger',
          nozzles: r.availableNozzlesShift,
          observations
        };
      });

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
          <div className="w-full md:w-auto md:shrink-0">
            <GlassButton
              onClick={() => setIsShareOpen(true)}
              className="h-12 px-6 text-xs font-black tracking-widest flex items-center justify-center gap-2.5 bg-primary hover:bg-primary-hover text-white border-none shadow-lg uppercase w-full md:w-auto"
            >
              <Share2 size={14} className="text-white" />
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

          {/* Tarjetas de Materiales Productivos */}
          {inventorySummary.productive.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {inventorySummary.productive.map((item, idx) => (
                <MaterialStatCard key={item.id || idx} item={item} />
              ))}
            </div>
          )}

          {/* Totalizador de BigBag (Opción B: Bloque independiente de ancho completo por debajo) */}
          {inventorySummary.bigbags.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {inventorySummary.bigbags.map((item, idx) => (
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
                              const decimals = 0;
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

        {/* Tabla Resumen de Rendimiento de Paletizadoras (Formato PDF adaptado) */}
        <GlassCard className="p-0 overflow-hidden border-primary/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg/40 text-[10px] uppercase font-black text-text-muted tracking-widest">
                <tr>
                  <th className="px-6 py-4">Paletizadora</th>
                  <th className="px-6 py-4 text-center">Marcha</th>
                  <th className="px-6 py-4 text-center">OEE</th>
                  <th className="px-6 py-4 text-center">Disponibilidad</th>
                  <th className="px-6 py-4 text-center">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {palletizerData.map(({ palletizer, runHours, oee, availability, performance }, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-text-main uppercase">{palletizer.name}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-sm font-bold text-text-main">{runHours} hs</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-sm font-extrabold text-emerald-400">{Math.round(oee || 0).toFixed(0)}%</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-sm font-extrabold text-blue-400">{Math.round(availability || 0).toFixed(0)}%</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-sm font-extrabold text-pink-400">{Math.round(performance || 0).toFixed(0)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Detalle por Paletizadora en Formato Estructurado de 3 Columnas (Como en el PDF) */}
        <div className="space-y-6">
          {palletizerData.map(({ palletizer, topStops, tonsByMaterial, activeNozzles, totalTons }) => (
            <GlassCard key={palletizer.id} className="p-6 sm:p-8 overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-500">
              <h3 className="text-lg font-black text-primary uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                {palletizer.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-text-main">
                {/* Columna 1: Producción */}
                <div className="border-b md:border-b-0 md:border-r border-white/5 pb-6 md:pb-0 md:pr-6">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block mb-3">Producción</span>
                  {Object.entries(tonsByMaterial).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(tonsByMaterial).map(([mId, tons]) => {
                        const t = tons as number;
                        const mName = masters.materials.find((m: any) => m.id === mId)?.name || 'Material';
                        return (
                          <div key={mId} className="flex justify-between items-baseline font-semibold text-text-main uppercase">
                            <span className="truncate max-w-[150px]">{mName}</span>
                            <span className="font-mono text-sm font-bold text-text-main">{Math.round(t).toFixed(0)} TN</span>
                          </div>
                        );
                      })}
                      <div className="pt-2 mt-2 border-t border-dashed border-white/10 flex justify-between font-extrabold text-sm text-primary">
                        <span>TOTAL</span>
                        <span className="font-mono text-sm font-black">{Math.round(totalTons).toFixed(0)} TN</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-muted italic font-medium">Sin producción registrada</p>
                  )}
                </div>

                {/* Columna 2: Boquillas Activas / Envasadora */}
                <div className="border-b md:border-b-0 md:border-r border-white/5 pb-6 md:pb-0 md:pr-6">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block mb-3">Boquillas Activas / Envasadora</span>
                  {activeNozzles.length > 0 ? (
                    <div className="space-y-3">
                      {activeNozzles.map((nozzle, nidx) => (
                        <div key={nidx} className="flex flex-col gap-1 pb-2 border-b border-white/5 last:border-none last:pb-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-text-main uppercase truncate mr-2">{nozzle.baggerName}</span>
                            <span className="font-mono font-black text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded text-xs">{nozzle.nozzles} bq.</span>
                          </div>
                          {nozzle.observations && nozzle.observations.length > 0 && (
                            <div className="flex flex-col gap-1 w-full">
                              {nozzle.observations.map((obs: string, oIdx: number) => (
                                <NozzleObservationItem key={oIdx} observation={obs} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-muted italic font-medium">No hay boquillas reportadas</p>
                  )}
                </div>

                {/* Columna 3: Paros / Alarmas de Operación */}
                <div>
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block mb-3">Paros / Alarmas de Operación</span>
                  {topStops.length > 0 ? (
                    <div className="space-y-2">
                      {topStops.slice(0, 4).map((stop, sidx) => {
                        const causeText = stop.causeText || masters.causes.find((c: any) => c.id === stop.causeId)?.text || 'Error registrado';
                        return (
                          <div key={sidx} className="flex justify-between items-start leading-tight border-b border-white/5 pb-2 last:border-none last:pb-0">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-red-400 uppercase leading-snug break-words text-xs">
                                {causeText}
                              </p>
                              <span className="text-[9px] text-text-muted font-mono block mt-0.5 font-semibold">
                                HAC: {stop.hacName || 'Genérico'}
                              </span>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="font-mono text-red-400 font-black bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-xs block">
                                {Math.round(stop.durationMinutes).toFixed(0)}m
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-muted italic font-medium">Operación limpia. Sin paros registrados.</p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="hidden">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeNozzles.length > 0 ? activeNozzles.map((nozzle, idx) => (
                        <div key={idx} className="bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 rounded-xl flex flex-col justify-between h-auto gap-1">
                          <div className="flex justify-between items-baseline">
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">{nozzle.baggerName}</p>
                            <p className="text-sm font-black text-amber-500 font-mono tracking-tighter">{nozzle.nozzles}</p>
                          </div>
                          {nozzle.observations && nozzle.observations.length > 0 && (
                            <div className="flex flex-col gap-1 w-full">
                              {nozzle.observations.map((obs: string, oIdx: number) => (
                                <NozzleObservationItem key={oIdx} observation={obs} />
                              ))}
                            </div>
                          )}
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
                          <td className="px-8 py-5">
                            <span className="text-sm font-black text-text-main uppercase tracking-wider">{lp.name}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                                isEnabled ? "bg-emerald-500 shadow-emerald-500/50" : "bg-red-500 shadow-red-500/50"
                              )} />
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider",
                                isEnabled ? "text-emerald-500" : "text-red-500"
                              )}>
                                {isEnabled ? 'OPERATIVA' : 'FUERA DE SERVICIO'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            {isEnabled ? (
                              <div className="flex flex-wrap gap-2">
                                {status.materialIds.length > 0 ? (
                                  status.materialIds.map((mid: string) => (
                                    <span key={mid} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black border border-primary/20 uppercase tracking-tighter">
                                      {masters.materials.find((m: any) => m.id === mid)?.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] font-semibold text-emerald-500/40 uppercase italic tracking-wider">Disponible para carga general</span>
                                )}
                              </div>
                            ) : (
                              <div className="bg-red-500/5 border border-red-500/20 px-4 py-1.5 rounded-xl">
                                <p className="text-xs font-bold text-red-400 italic">
                                   Reporte: {status.observation || 'Sin detalles adicionales'}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        <tr key={lp.id} className="opacity-40">
                          <td className="px-8 py-5">
                            <span className="text-sm font-black text-text-main uppercase tracking-wider">{lp.name}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider italic">Sin reporte de turno</span>
                          </td>
                          <td className="px-8 py-5 text-text-muted/40 italic text-[11px]">
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
