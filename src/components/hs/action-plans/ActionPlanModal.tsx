import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, User, MapPin, Camera, Play } from 'lucide-react';
import { HSActionPlan, HSActionPlanStatus } from '../types';

interface ActionPlanModalProps {
  plan: HSActionPlan;
  onClose: () => void;
  onUpdateStatus: (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string) => void;
}

export function ActionPlanModal({ plan, onClose, onUpdateStatus }: ActionPlanModalProps) {
  // Separar los campos si fueron concatenados previamente
  const initialActionPlan = plan.resolutionNotes?.split('---RESOLUCION---')[0]?.trim() || '';
  const initialResolution = plan.resolutionNotes?.split('---RESOLUCION---')[1]?.trim() || '';

  const [actionPlanText, setActionPlanText] = useState(initialActionPlan);
  const [resolutionText, setResolutionText] = useState(initialResolution);
  const [dueDateText, setDueDateText] = useState(plan.dueDate);

  const handleSubmit = (newStatus: HSActionPlanStatus) => {
    let combinedNotes = actionPlanText;
    if (resolutionText) {
      combinedNotes += `\n---RESOLUCION---\n${resolutionText}`;
    }
    onUpdateStatus(plan.id, newStatus, plan.assignedTo, combinedNotes, dueDateText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg/50 rounded-t-2xl shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
              Detalle de Hallazgo e Incidencia
            </span>
            <h3 className="text-sm font-black text-text-main">Gestión de Plan de Acción</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto scrollbar-thin space-y-6">
          {/* Bloque 1: Datos del Hallazgo (Lectura) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-text-main border-b border-border/50 pb-2">
              1. Datos del Hallazgo
            </h4>
            
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-border">
                  <tr className="bg-bg/50 hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3 flex items-center gap-1.5"><MapPin size={14}/> Objeto</td>
                    <td className="py-2.5 px-4 font-bold text-text-main">{plan.objectName}</td>
                  </tr>
                  <tr className="hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3 flex items-center gap-1.5"><MapPin size={14} className="opacity-0"/> Sector</td>
                    <td className="py-2.5 px-4 text-text-muted">{plan.sectorName}</td>
                  </tr>
                  <tr className="bg-bg/50 hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3 flex items-center gap-1.5"><User size={14}/> Reportado Por</td>
                    <td className="py-2.5 px-4 font-bold text-text-main">Inspector de Turno</td>
                  </tr>
                  <tr className="hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3">Fecha de Reporte</td>
                    <td className="py-2.5 px-4 font-mono text-text-muted">{plan.createdAt}</td>
                  </tr>
                  <tr className="bg-bg/50 hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3">Ítem Observado</td>
                    <td className="py-2.5 px-4 font-bold text-text-main">{plan.title}</td>
                  </tr>
                  <tr className="hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3">Detalle / Problema</td>
                    <td className="py-2.5 px-4 text-text-muted">{plan.description}</td>
                  </tr>
                  <tr className="bg-bg/50 hover:bg-surface transition-colors">
                    <td className="py-2.5 px-4 font-bold text-text-muted w-1/3">Nivel de Severidad</td>
                    <td className="py-2.5 px-4">
                      {plan.severity === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider">
                          <AlertTriangle size={12} /> Crítico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                          No Crítico
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Placeholder de Foto */}
            <div className="flex items-center justify-between p-3 bg-bg border border-border border-dashed rounded-xl text-text-muted text-xs">
              <div className="flex items-center gap-2">
                <Camera size={16} />
                <span>Evidencia fotográfica</span>
              </div>
              <span className="text-[10px] font-bold uppercase">Sin adjuntos</span>
            </div>
          </div>

          {/* Bloque 2: Formulario de Resolución */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-text-main border-b border-border/50 pb-2">
              2. Plan de Acción y Resolución
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Plan de Acción / Medida Correctiva</label>
                  <textarea
                    rows={3}
                    value={actionPlanText}
                    onChange={e => setActionPlanText(e.target.value)}
                    placeholder="Describe las acciones que se tomarán para solucionar el hallazgo..."
                    className="w-full p-3 rounded-xl border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Fecha Límite (Due Date)</label>
                  <input
                    type="date"
                    value={dueDateText}
                    onChange={e => setDueDateText(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
              </div>

              {plan.status !== 'OPEN' && (
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Resolución Final (Llenar al resolver)</label>
                  <textarea
                    rows={2}
                    value={resolutionText}
                    onChange={e => setResolutionText(e.target.value)}
                    placeholder="Detalles de la resolución final una vez ejecutada la medida..."
                    className="w-full p-3 rounded-xl border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="p-4 border-t border-border bg-bg/50 rounded-b-2xl flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-text-muted text-xs font-bold hover:bg-surface transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            {plan.status === 'OPEN' && (
              <button
                onClick={() => handleSubmit('IN_PROGRESS')}
                className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold rounded-lg shadow-sm hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play size={14} /> En Proceso
              </button>
            )}
            {plan.status !== 'OPEN' && (
              <button
                onClick={() => handleSubmit('RESOLVED')}
                className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={16} /> Marcar como Resuelto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}