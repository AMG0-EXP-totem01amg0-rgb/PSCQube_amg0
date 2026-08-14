import React, { useState } from 'react';
import { ActionPlanCard } from './ActionPlanCard';
import { ActionPlanModal } from './ActionPlanModal';
import { HSActionPlan, HSActionPlanStatus } from '../types';
import { ShieldAlert, Filter, CheckCircle2, Clock, AlertOctagon } from 'lucide-react';

interface HSActionPlansViewProps {
  actionPlans: HSActionPlan[];
  onUpdateStatus: (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string) => void;
}

export function HSActionPlansView({ actionPlans, onUpdateStatus }: HSActionPlansViewProps) {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('ALL');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<HSActionPlan | null>(null);

  const filteredPlans = actionPlans.filter(plan => {
    const matchesStatus = selectedStatusFilter === 'ALL' || plan.status === selectedStatusFilter;
    const matchesSeverity = selectedSeverityFilter === 'ALL' || plan.severity === selectedSeverityFilter;
    return matchesStatus && matchesSeverity;
  });

  const openCount = actionPlans.filter(p => p.status === 'OPEN').length;
  const inProgressCount = actionPlans.filter(p => p.status === 'IN_PROGRESS').length;
  const resolvedCount = actionPlans.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED').length;
  const criticalCount = actionPlans.filter(p => p.severity === 'CRITICAL' && (p.status === 'OPEN' || p.status === 'IN_PROGRESS')).length;

  return (
    <div className="space-y-4">
      {/* Tarjetas resumen KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-border bg-surface shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
            <AlertOctagon size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Críticos Activos</span>
            <span className="text-base font-black text-rose-500">{criticalCount}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-surface shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">En Proceso</span>
            <span className="text-base font-black text-amber-500">{inProgressCount}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-surface shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Abiertos</span>
            <span className="text-base font-black text-blue-500">{openCount}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-surface shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Resueltos</span>
            <span className="text-base font-black text-emerald-500">{resolvedCount}</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <span className="text-xs font-bold text-text-main">Filtrar por:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="OPEN">Abiertos</option>
            <option value="IN_PROGRESS">En Proceso</option>
            <option value="RESOLVED">Resueltos</option>
            <option value="CLOSED">Cerrados</option>
          </select>

          <select
            value={selectedSeverityFilter}
            onChange={e => setSelectedSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
          >
            <option value="ALL">Todas las Severidades</option>
            <option value="CRITICAL">Crítica</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Media</option>
            <option value="LOW">Baja</option>
          </select>
        </div>
      </div>

      {/* Grid de Planes de Acción */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlans.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-surface rounded-2xl border border-border text-text-muted text-xs">
            No se encontraron Planes de Acción con los filtros aplicados.
          </div>
        ) : (
          filteredPlans.map(plan => (
            <ActionPlanCard
              key={plan.id}
              plan={plan}
              onOpenModal={setSelectedPlanForModal}
            />
          ))
        )}
      </div>

      {/* Modal de edición de plan de acción */}
      {selectedPlanForModal && (
        <ActionPlanModal
          plan={selectedPlanForModal}
          onClose={() => setSelectedPlanForModal(null)}
          onUpdateStatus={onUpdateStatus}
        />
      )}
    </div>
  );
}
