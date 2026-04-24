import React from 'react';
import { motion } from 'motion/react';
import { Clock, Package, ClipboardList, TrendingUp, ShieldCheck, AlertCircle } from 'lucide-react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard, KPICircle } from '../ui/GlassUI';
import { cn } from '../../lib/utils';
import ShiftTimeline from './ShiftTimeline';
import { Shift, MachineStop } from '../../types';

interface Props {
  kpis: any;
  masters: any;
  selectedPalletizer: any;
  selectedShift: Shift | null;
  onTabChange: (tab: any) => void;
  stops: MachineStop[];
  productionReports: any[];
}

export default function DashboardView({ kpis, masters, selectedPalletizer, selectedShift, onTabChange, stops, productionReports }: Props) {
  const oee = (kpis.availability * kpis.performance) / 100;

  // Operating Hours Calculation
  const timeMetrics = React.useMemo(() => {
    if (!selectedShift) return { marchHours: 0, stopMinutes: 0, stopHoursStr: '0h 0m' };
    const totalStopMinutes = stops.reduce((acc, s) => acc + s.durationMinutes, 0);
    const shiftMinutes = selectedShift.durationHours * 60;
    const marchMinutes = Math.max(0, shiftMinutes - totalStopMinutes);
    const marchHours = marchMinutes / 60;
    
    const stopHours = Math.floor(totalStopMinutes / 60);
    const stopRemainingMinutes = totalStopMinutes % 60;
    
    return {
      marchHours,
      stopMinutes: totalStopMinutes,
      stopHoursStr: `${stopHours}h ${stopRemainingMinutes}m`
    };
  }, [selectedShift, stops]);

  // Aggregate Production Data
  const prodByBagger = React.useMemo(() => {
    const summary: Record<string, number> = {};
    productionReports.forEach(r => {
      summary[r.baggerId] = (summary[r.baggerId] || 0) + r.tonsProduced;
    });
    return Object.entries(summary).map(([id, tons]) => ({
      name: masters.baggers.find((b: any) => b.id === id)?.name || id,
      tons
    }));
  }, [productionReports, masters.baggers]);

  const prodByMaterial = React.useMemo(() => {
    const summary: Record<string, number> = {};
    productionReports.forEach(r => {
      summary[r.materialId] = (summary[r.materialId] || 0) + r.tonsProduced;
    });
    return Object.entries(summary).map(([id, tons]) => ({
      name: masters.materials.find((m: any) => m.id === id)?.name || id,
      tons
    }));
  }, [productionReports, masters.materials]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }} 
      className="layout-container py-8 space-y-8"
    >
      {/* Operational Status Section */}
      {selectedShift && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Performance Summary Quadrant */}
          <div className="lg:col-span-5 bg-surface-elevated rounded-2xl border border-border p-5 shadow-lg">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="flex flex-col justify-center border-r border-border/50 pr-4">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-2">HS MARCHA</h4>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-black text-emerald-500 tracking-tighter tabular-nums">
                    {timeMetrics.marchHours.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500/60 uppercase">hs</span>
                </div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-tight">
                  {timeMetrics.stopHoursStr} <span className="opacity-50 text-text-muted">en paros</span>
                </p>
              </div>

              <div className="flex flex-col justify-center pl-2">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-2">TN REPORTADAS</h4>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-black text-primary tracking-tighter tabular-nums">
                    {kpis.totalTons.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-primary/60 uppercase">tn</span>
                </div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-tight">
                   Turno Actual
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Línea de Tiempo Operativa</h4>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{selectedShift.name} • {selectedShift.startTime} - {selectedShift.endTime}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger" />
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Paro Interno</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral/40" />
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Paro Externo</span>
                </div>
              </div>
            </div>
            
            <ShiftTimeline 
              shift={selectedShift} 
              stops={stops} 
              masters={masters} 
              readOnly={true}
            />
          </div>
        </div>
      )}

      {/* KPI Section - SaaS Strip Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICircle label="Rendimiento" value={kpis.performance} color="indigo" />
        <KPICircle label="Disponibilidad" value={kpis.availability} color="emerald" />
        <KPICircle label="OEE Global" value={oee} color="indigo" />
        <div className="ui-card p-4 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-bold tracking-tight text-text-main">{kpis.hsMarcha.toFixed(1)}h</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-60 text-text-muted">Hs Marcha</div>
        </div>
      </div>

      {/* Production Summaries Section (New) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="ui-card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Package className="text-primary" size={16} />
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Producción por Ensacadora</h4>
          </div>
          <div className="space-y-3">
             {prodByBagger.length > 0 ? prodByBagger.map((item, idx) => (
               <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                    <span className="text-text-muted">{item.name}</span>
                    <span className="text-text-main">{item.tons.toFixed(1)} Tn</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${Math.min(100, (item.tons / 200) * 100)}%` }} 
                    />
                  </div>
               </div>
             )) : (
               <p className="text-[10px] text-text-muted font-bold uppercase py-4 text-center">Sin datos de carga</p>
             )}
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <ClipboardList className="text-emerald-500" size={16} />
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Producción por Material</h4>
          </div>
          <div className="space-y-3">
             {prodByMaterial.length > 0 ? prodByMaterial.map((item, idx) => (
               <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-bg/40 border border-border">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">{item.name}</span>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-text-main">{item.tons.toFixed(1)} Tn</span>
                  </div>
               </div>
             )) : (
               <p className="text-[10px] text-text-muted font-bold uppercase py-4 text-center">Sin datos de carga</p>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Main Chart Section - Protagonist */}
        <GlassCard className="p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="text-primary" size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main tracking-tight">Evolución de Rendimiento</h3>
                <p className="text-[11px] text-text-muted font-medium">Ciclo productivo real vs objetivo por hora.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="hidden sm:flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-1 bg-chart-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
                    <span className="text-[9px] font-bold text-text-main uppercase">Real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-1 border-t-2 border-dashed border-chart-target rounded-full" />
                    <span className="text-[9px] font-bold text-text-muted uppercase">Target</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 px-2 py-1 bg-surface-elevated border border-border rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse" />
                  <span className="text-[9px] font-bold text-text-main uppercase tracking-widest leading-none">Live</span>
               </div>
            </div>
          </div>

          <div className="min-h-[400px] w-full" style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dummyLineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis 
                  dataKey="h" 
                  stroke="var(--chart-axis)" 
                  fontSize={10} 
                  tickFormatter={(val) => `${val}h`} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="var(--chart-axis)" 
                  fontSize={10} 
                  domain={[0, 100]} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="v" 
                  name="Real"
                  stroke="var(--chart-primary)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'var(--chart-primary)', strokeWidth: 2, stroke: 'var(--bg)' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  name="Target"
                  stroke="var(--chart-target)" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface p-3 rounded-xl border border-border shadow-2xl space-y-2">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-primary" />
           <p className="text-[11px] font-bold text-text-main uppercase tracking-tight">Real: {payload[0].value.toFixed(1)}%</p>
        </div>
        {payload[1] && (
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <div className="w-2 h-2 rounded-full border border-text-muted border-dashed" />
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-tight">Target: {payload[1].value.toFixed(1)}%</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const dummyLineData = [ 
  { h: 6, v: 82, target: 85 }, 
  { h: 7, v: 88, target: 85 }, 
  { h: 8, v: 84, target: 85 }, 
  { h: 9, v: 92, target: 100 }, 
  { h: 10, v: 85, target: 100 }, 
  { h: 11, v: 96, target: 100 } 
];
