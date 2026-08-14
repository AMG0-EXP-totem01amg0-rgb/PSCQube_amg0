import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { HSActionPlan, HSActionPlanStatus } from '../types';

interface ActionPlanModalProps {
  plan: HSActionPlan;
  onClose: () => void;
  onUpdateStatus: (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string) => void;
}

export function ActionPlanModal({ plan, onClose, onUpdateStatus }: ActionPlanModalProps) {
  const [status, setStatus] = useState<HSActionPlanStatus>(plan.status);
  const [assignedTo, setAssignedTo] = useState(plan.assignedTo);
  const [notes, setNotes] = useState(plan.resolutionNotes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStatus(plan.id, status, assignedTo, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold text-primary uppercase">
              Plan de Acción #{plan.id}
            </span>
            <h3 className="text-sm font-black text-text-main mt-0.5">{plan.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-bg border border-border space-y-1 text-xs">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Objeto & Sector</span>
            <p className="font-bold text-text-main">{plan.objectName} — {plan.sectorName}</p>
            <p className="text-text-muted mt-1">{plan.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1">Estado del Plan</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as HSActionPlanStatus)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value="OPEN">Abierto</option>
                <option value="IN_PROGRESS">En Proceso</option>
                <option value="RESOLVED">Resuelto</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted mb-1">Responsable Asignado</label>
              <input
                type="text"
                required
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted mb-1">Notas de Resolución / Cierre</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describa las acciones correctivas aplicadas o repuestos utilizados..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-text-muted text-xs font-bold hover:bg-bg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={16} /> Actualizar Estado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
