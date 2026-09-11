import React from 'react';
import { User, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { HSActionPlan } from '../types';

interface ActionPlanCardProps {
  key?: string;
  plan: HSActionPlan;
  onOpenModal: (plan: HSActionPlan) => void;
}

export function ActionPlanCard({ plan, onOpenModal }: ActionPlanCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', plan.id);
  };

  return (
    <div
      draggable={plan.status === 'IN_PROGRESS'}
      onDragStart={handleDragStart}
      onClick={() => onOpenModal(plan)}
      className={`p-4 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all shadow-xs flex flex-col gap-3 ${
        plan.status === 'IN_PROGRESS' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      <div className="space-y-2">
        {/* Encabezado: Objeto y Sector + Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted bg-bg px-2 py-1 rounded-md border border-border shrink-0 max-w-[70%]">
            <MapPin size={12} className="text-primary shrink-0" />
            <span className="truncate">{plan.objectName} — {plan.sectorName}</span>
          </div>
          {plan.severity === 'CRITICAL' ? (
            <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-black uppercase tracking-wider">
              Crítico
            </span>
          ) : (
            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider">
              No Crítico
            </span>
          )}
        </div>

        {/* Cuerpo: Pregunta y Detalle */}
        <div className="pt-1">
          <h4 className="text-xs font-bold text-text-main line-clamp-2 leading-tight hover:text-primary transition-colors">
            {plan.title}
          </h4>
          <p className="text-[11px] text-text-muted line-clamp-1 mt-1">
            {plan.description}
          </p>
        </div>

        {/* Observaciones (Si resuelto) */}
        {plan.resolutionNotes && (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium flex items-start gap-1.5 mt-2">
            <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
            <span className="line-clamp-2">{plan.resolutionNotes.replace('---RESOLUCION---', ' ')}</span>
          </div>
        )}
      </div>

      {/* Pie: Responsable y Fecha */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted font-medium">
        <span className="flex items-center gap-1.5 truncate pr-2">
          <User size={12} className="shrink-0" /> <span className="truncate">{plan.assignedTo}</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono text-text-main shrink-0">
          <Calendar size={12} className="text-primary shrink-0" /> {plan.dueDate}
        </span>
      </div>
    </div>
  );
}