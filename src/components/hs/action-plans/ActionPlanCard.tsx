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
      className={`p-4 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between space-y-3 ${plan.status === 'IN_PROGRESS' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
    >
      <div className="space-y-2">
        {/* Cabecera limpia: Solo la fecha arriba a la derecha (sin las etiquetas de la foto) */}
        <div className="flex items-center justify-end">
          <span className="text-[10px] font-mono text-text-muted">{plan.createdAt}</span>
        </div>

        {/* Nombre / Título del Plan (Se mantiene intacto) */}
        <h4 className="text-xs font-bold text-text-main hover:text-primary transition-colors">
          {plan.title}
        </h4>

        {/* Descripción del Plan */}
        <p className="text-xs text-text-muted line-clamp-2">
          {plan.description}
        </p>

        {/* Observaciones de Resolución (Si el plan ya fue resuelto) */}
        {plan.resolutionNotes && (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium flex items-start gap-1.5 mt-1">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>{plan.resolutionNotes}</span>
          </div>
        )}

        {/* Activo / Ubicación / Sector */}
        <div className="text-[11px] text-text-muted flex items-center gap-1 font-medium pt-1">
          <MapPin size={12} className="text-primary" />
          <span>{plan.objectName} ({plan.sectorName})</span>
        </div>
      </div>

      {/* Pie de tarjeta: Responsable Asignado y Fecha Límite */}
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