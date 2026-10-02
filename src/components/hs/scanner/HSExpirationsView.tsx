import React, { useState, useMemo } from 'react';
import { CalendarClock, Filter, RefreshCw, AlertTriangle, CheckCircle2, AlertCircle, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { HSObject } from '../types';

interface HSExpirationsViewProps {
  objects: HSObject[];
}

type GroupBy = 'OBJECT' | 'TYPE';

export function HSExpirationsView({ objects }: HSExpirationsViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('OBJECT');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Extract unique filter options
  const types = useMemo(() => Array.from(new Set(objects.map(o => o.typeName).filter(Boolean))) as string[], [objects]);
  const sectors = useMemo(() => Array.from(new Set(objects.map(o => o.sectorName).filter(Boolean))) as string[], [objects]);

  const clearFilters = () => {
    setSelectedType('');
    setSelectedSector('');
    setSelectedStatus('');
  };

  // Helper function to calculate days remaining
  const calculateDaysRemaining = (dueDate?: string) => {
    if (!dueDate) return null;
    try {
      // Intenta parsear la fecha. En muchos casos viene como 'YYYY-MM-DD' o ISO.
      // Si el formato es DD/MM/YYYY hay que invertirlo.
      let parsedDate = dueDate;
      if (dueDate.includes('/') && !dueDate.includes('T')) {
        const parts = dueDate.split('/');
        if (parts.length >= 3) {
          parsedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      const due = new Date(parsedDate);
      if (isNaN(due.getTime())) return null;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);

      const diffTime = due.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // Filter and process objects
  const processedObjects = useMemo(() => {
    let result = objects;
    if (selectedType) result = result.filter(o => o.typeName === selectedType);
    if (selectedSector) result = result.filter(o => o.sectorName === selectedSector);

    return result.map(obj => {
      const daysRemaining = calculateDaysRemaining(obj.nextInspectionDue);
      let status: 'VENCIDO' | 'PROXIMO' | 'VIGENTE' | 'SIN_FECHA' | 'PENDIENTE' = 'SIN_FECHA';
      
      if (!obj.lastInspectedAt) {
        status = 'PENDIENTE';
      } else if (daysRemaining !== null) {
        if (daysRemaining < 0) status = 'VENCIDO';
        else if (daysRemaining <= 7) status = 'PROXIMO';
        else status = 'VIGENTE';
      }

      return {
        ...obj,
        daysRemaining,
        expirationStatus: status
      };
    });
  }, [objects, selectedType, selectedSector]);

  const filteredObjects = useMemo(() => {
    if (!selectedStatus) return processedObjects;
    return processedObjects.filter(o => o.expirationStatus === selectedStatus);
  }, [processedObjects, selectedStatus]);

  // Chart Data based on processedObjects (not filtered by status)
  const chartData = useMemo(() => {
    const stats = new Map<string, any>();
    processedObjects.forEach(obj => {
      const type = obj.typeName || 'Sin Tipo';
      if (!stats.has(type)) {
        stats.set(type, { type, VENCIDO: 0, PROXIMO: 0, VIGENTE: 0, PENDIENTE: 0, SIN_FECHA: 0, total: 0 });
      }
      const data = stats.get(type);
      data[obj.expirationStatus] += 1;
      data.total += 1;
    });
    return Array.from(stats.values()).sort((a, b) => b.total - a.total);
  }, [processedObjects]);

  // Group by Type data based on filteredObjects
  const typeStats = useMemo(() => {
    if (groupBy !== 'TYPE') return [];

    const stats = new Map<string, { total: number, vencidos: number, proximos: number, vigentes: number, sinFecha: number, pendientes: number }>();
    
    filteredObjects.forEach(obj => {
      const type = obj.typeName || 'Sin Tipo';
      if (!stats.has(type)) {
        stats.set(type, { total: 0, vencidos: 0, proximos: 0, vigentes: 0, sinFecha: 0, pendientes: 0 });
      }
      const data = stats.get(type)!;
      data.total += 1;
      if (obj.expirationStatus === 'VENCIDO') data.vencidos += 1;
      else if (obj.expirationStatus === 'PROXIMO') data.proximos += 1;
      else if (obj.expirationStatus === 'VIGENTE') data.vigentes += 1;
      else if (obj.expirationStatus === 'PENDIENTE') data.pendientes += 1;
      else data.sinFecha += 1;
    });

    return Array.from(stats.entries()).map(([type, data]) => ({ type, ...data })).sort((a, b) => b.vencidos - a.vencidos || b.proximos - a.proximos);
  }, [filteredObjects, groupBy]);

  // Sort objects by days remaining for OBJECT view
  const sortedObjects = useMemo(() => {
    return [...filteredObjects].sort((a, b) => {
      if (a.daysRemaining === null && b.daysRemaining === null) return 0;
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });
  }, [filteredObjects]);


  const getStatusBadge = (status: 'VENCIDO' | 'PROXIMO' | 'VIGENTE' | 'SIN_FECHA' | 'PENDIENTE', days?: number | null) => {
    switch(status) {
      case 'VENCIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle size={12} /> VENCIDO ({Math.abs(days || 0)} días)
          </span>
        );
      case 'PROXIMO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle size={12} /> VENCE PRONTO ({days} días)
          </span>
        );
      case 'VIGENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={12} /> VIGENTE ({days} días)
          </span>
        );
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <AlertCircle size={12} /> PENDIENTE INSP.
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
            SIN FECHA
          </span>
        );
    }
  };

  const renderTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const total = payload[0].payload.total;
      return (
        <div className="bg-surface border border-border p-3 rounded-xl shadow-xl text-xs z-50">
          <p className="font-bold text-text-main mb-2 border-b border-border pb-1">{label}</p>
          {payload.map((entry: any, index: number) => {
            const val = entry.value;
            if (val === 0) return null;
            const pct = Math.round((val / total) * 100);
            return (
              <div key={index} className="flex items-center justify-between gap-4 py-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-text-muted">{entry.name}</span>
                </div>
                <span className="font-bold font-mono text-text-main">{val} ({pct}%)</span>
              </div>
            );
          })}
          <div className="mt-2 pt-1 border-t border-border flex justify-between font-bold text-text-main">
            <span>Total:</span>
            <span>{total}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Filters and Controls */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Filtros y Agrupación
            </h4>
          </div>
          <button
            onClick={clearFilters}
            className="text-[11px] font-bold text-text-muted hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> Limpiar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted">Agrupar por</label>
            <div className="flex bg-bg border border-border rounded-lg p-0.5">
              <button
                onClick={() => setGroupBy('OBJECT')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${groupBy === 'OBJECT' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'}`}
              >
                Punto de Inspección
              </button>
              <button
                onClick={() => setGroupBy('TYPE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${groupBy === 'TYPE' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'}`}
              >
                Tipo de Activo
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted">Tipo</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los tipos ]</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted">Sector</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los sectores ]</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted">Estado</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los estados ]</option>
              <option value="VENCIDO">Vencidos</option>
              <option value="PROXIMO">Por Vencer</option>
              <option value="PENDIENTE">Pendientes de Insp.</option>
              <option value="VIGENTE">Vigentes</option>
              <option value="SIN_FECHA">Sin Fecha</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs relative">
         <div className="flex items-center gap-2 mb-4">
           <PieChart size={18} className="text-primary" />
           <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Distribución de Estados por Tipo <span className="text-text-muted font-normal normal-case ml-2">(Click en las barras para filtrar)</span>
           </h4>
         </div>
         <div className="h-72 w-full">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData} stackOffset="expand" margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
               <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#888' }} angle={-25} textAnchor="end" height={60} />
               <YAxis tickFormatter={(val) => `${val * 100}%`} tick={{ fontSize: 10, fill: '#888' }} />
               <RechartsTooltip content={renderTooltip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
               <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
               <Bar name="Vencido" dataKey="VENCIDO" stackId="a" fill="#ef4444" cursor="pointer" onClick={(data) => { setSelectedType(data.type); setSelectedStatus('VENCIDO'); }} />
               <Bar name="Por Vencer" dataKey="PROXIMO" stackId="a" fill="#f59e0b" cursor="pointer" onClick={(data) => { setSelectedType(data.type); setSelectedStatus('PROXIMO'); }} />
               <Bar name="Pendiente" dataKey="PENDIENTE" stackId="a" fill="#3b82f6" cursor="pointer" onClick={(data) => { setSelectedType(data.type); setSelectedStatus('PENDIENTE'); }} />
               <Bar name="Vigente" dataKey="VIGENTE" stackId="a" fill="#10b981" cursor="pointer" onClick={(data) => { setSelectedType(data.type); setSelectedStatus('VIGENTE'); }} />
               <Bar name="Sin Fecha" dataKey="SIN_FECHA" stackId="a" fill="#6b7280" cursor="pointer" onClick={(data) => { setSelectedType(data.type); setSelectedStatus('SIN_FECHA'); }} />
             </BarChart>
           </ResponsiveContainer>
         </div>
      </div>

      {/* Results */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs relative">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={18} className="text-primary" />
          <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
            Reporte de Vencimientos
          </h4>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border max-h-[500px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/5 dark:bg-white/5 text-[10px] uppercase text-text-muted font-bold border-b border-border sticky top-0 z-10 backdrop-blur-md">
              {groupBy === 'OBJECT' ? (
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">CÓDIGO / QR</th>
                  <th className="px-4 py-3 whitespace-nowrap">PUNTO DE INSPECCIÓN</th>
                  <th className="px-4 py-3 whitespace-nowrap">TIPO</th>
                  <th className="px-4 py-3 whitespace-nowrap">SECTOR</th>
                  <th className="px-4 py-3 whitespace-nowrap">FECHA VENCIMIENTO</th>
                  <th className="px-4 py-3 whitespace-nowrap">ESTADO</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">TIPO DE ACTIVO</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">TOTAL PUNTOS</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">VENCIDOS</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">VENCEN &lt; 7 DÍAS</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">VIGENTES</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">PENDIENTES</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {groupBy === 'OBJECT' ? (
                sortedObjects.length > 0 ? (
                  sortedObjects.map(obj => (
                    <tr key={obj.id} className="hover:bg-bg/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-[10px] text-text-muted whitespace-nowrap">{obj.qrCode}</td>
                      <td className="px-4 py-3 font-bold text-text-main max-w-[250px] whitespace-normal break-words">{obj.name}</td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">{obj.typeName}</td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">{obj.sectorName}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{obj.nextInspectionDue || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(obj.expirationStatus, obj.daysRemaining)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No se encontraron activos para los filtros seleccionados.
                    </td>
                  </tr>
                )
              ) : (
                typeStats.length > 0 ? (
                  typeStats.map(stat => (
                    <tr key={stat.type} className="hover:bg-bg/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-text-main whitespace-normal max-w-[200px] break-words">{stat.type}</td>
                      <td className="px-4 py-3 text-center font-mono whitespace-nowrap">{stat.total}</td>
                      <td className="px-4 py-3 text-center font-mono text-rose-500 font-bold whitespace-nowrap">{stat.vencidos}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-500 font-bold whitespace-nowrap">{stat.proximos}</td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-500 font-bold whitespace-nowrap">{stat.vigentes}</td>
                      <td className="px-4 py-3 text-center font-mono text-blue-500 font-bold whitespace-nowrap">{stat.pendientes}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No se encontraron tipos de activos.
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
