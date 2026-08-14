import React from 'react';
import { History, CheckCircle2, AlertTriangle, XCircle, Calendar, User } from 'lucide-react';
import { HSInspection } from '../types';

interface ObjectInspectionHistoryProps {
  history: HSInspection[];
}

export function ObjectInspectionHistory({ history }: ObjectInspectionHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-border bg-surface text-center text-text-muted text-xs">
        Sin historial de inspecciones registradas para este objeto.
      </div>
    );
  }

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'CONFORME':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={12} /> Conforme
          </span>
        );
      case 'NO_CONFORME_MENOR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle size={12} /> Observado Menor
          </span>
        );
      case 'NO_CONFORME_CRITICA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle size={12} /> Falla Crítica
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <History size={16} className="text-primary" />
        <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
          Historial de Inspecciones ({history.length})
        </h4>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
        {history.map(insp => (
          <div
            key={insp.id}
            className="p-3 rounded-xl border border-border bg-bg/50 space-y-2 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                <Calendar size={13} className="text-text-muted" />
                <span>{insp.date}</span>
              </div>
              {getResultBadge(insp.overallResult)}
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <User size={12} /> {insp.operatorName}
              </span>
              {insp.actionPlanGenerated && (
                <span className="font-bold text-rose-500">Generó Plan de Acción</span>
              )}
            </div>

            {insp.comments && (
              <p className="text-xs text-text-muted italic bg-surface p-2 rounded-lg border border-border">
                "{insp.comments}"
              </p>
            )}

            {/* Detalle de ítems no conformes */}
            {insp.answers.some(a => a.status === 'NO_OK') && (
              <div className="pt-2 border-t border-border space-y-1">
                <span className="text-[10px] font-bold text-rose-500 uppercase">Observaciones:</span>
                {insp.answers.filter(a => a.status === 'NO_OK').map((a, i) => (
                  <div key={i} className="text-[11px] text-text-main flex items-center justify-between">
                    <span>• {a.checklistItemLabel}</span>
                    {a.observation && <span className="text-text-muted font-mono text-[10px]">({a.observation})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
