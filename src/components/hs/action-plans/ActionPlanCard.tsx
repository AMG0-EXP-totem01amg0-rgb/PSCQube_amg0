import React from 'react';
import { AlertOctagon, AlertTriangle, Clock, User, Calendar, MapPin } from 'lucide-react';
import { HSActionPlan } from '../types';

interface ActionPlanCardProps {
  plan: HSActionPlan;
  onOpenModal: (plan: HSActionPlan) => void;
}

export function ActionPlanCard({ plan, onOpenModal }: ActionPlanCardProps) {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20"><AlertOctagon size={12} /> Crítico</span>;
      case 'HIGH':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20"><AlertTriangle size={12} /> Alta</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20"><AlertTriangle size={12} /> Media</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20"><Clock size={12} /> Baja</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">Abierto</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">En Proceso</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Resuelto</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-text-muted/10 text-text-muted border border-border">Cerrado</span>;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={() => onOpenModal(plan)}
      className="p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-all shadow-xs cursor-pointer flex flex-col justify-between space-y-3"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getSeverityBadge(plan.severity)}
            {getStatusBadge(plan.status)}
          </div>
          <span className="text-[10px] font-mono text-text-muted">{plan.createdAt}</span>
        </div>

        <h4 className="text-xs font-bold text-text-main hover:text-primary transition-colors">
          {plan.title}
        </h4>

        <p className="text-xs text-text-muted line-clamp-2">
          {plan.description}
        </p>

        <div className="text-[11px] text-text-muted flex items-center gap-1 font-medium">
          <MapPin size={12} className="text-primary" />
          <span>{plan.objectName} ({plan.sectorName})</span>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <User size={12} /> {plan.assignedTo}
        </span>
        <span className="flex items-center gap-1 font-mono font-bold text-text-main">
          <Calendar size={12} className="text-primary" /> {plan.dueDate}
        </span>
      </div>
    </div>
  );
}
