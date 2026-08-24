import React, { useState } from 'react';
import { CheckCircle2, XCircle, Send, Camera, MessageSquare, ShieldAlert } from 'lucide-react';
import { HSChecklistItem, HSChecklistAnswerStatus, HSObject } from '../types';
import { AppUser } from '../../../types';

interface ActiveChecklistFormProps {
  selectedObject: HSObject;
  checklistItems: HSChecklistItem[];
  currentUser?: AppUser;
  onSubmit: (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string }[];
  }) => void;
}

export function ActiveChecklistForm({
  selectedObject,
  checklistItems,
  currentUser,
  onSubmit
}: ActiveChecklistFormProps) {
  const [answers, setAnswers] = useState<Record<string, { status: HSChecklistAnswerStatus; observation: string }>>(
    () => {
      const initial: Record<string, { status: HSChecklistAnswerStatus; observation: string }> = {};
      checklistItems.forEach(ci => {
        initial[ci.id] = { status: 'N_A', observation: '' };
      });
      return initial;
    }
  );

  const [generalComments, setGeneralComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPhotoEvidence, setHasPhotoEvidence] = useState(false);

  const handleStatusChange = (itemId: string, status: HSChecklistAnswerStatus) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }));
  };

  const handleObservationChange = (itemId: string, observation: string) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], observation }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formattedAnswers = (Object.entries(answers) as [string, { status: HSChecklistAnswerStatus; observation: string }][]).map(([checklistItemId, val]) => ({
      checklistItemId,
      status: val.status,
      observation: val.observation
    }));

    onSubmit({
      objectId: selectedObject.id,
      operatorDni: currentUser?.dni || 'OPER-01',
      operatorName: currentUser?.name || 'Operario de Planta',
      comments: generalComments,
      answers: formattedAnswers
    });

    setIsSubmitting(false);
  };

  const hasCriticalFailure = checklistItems.some(ci => ci.isCritical && answers[ci.id]?.status === 'NO_OK');
  const hasUnansweredItems = checklistItems.some(ci => answers[ci.id]?.status === 'N_A');
  const isSubmitDisabled = isSubmitting || hasUnansweredItems;

  return (
    <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Checklist de Inspección Activo
          </h3>
          <p className="text-xs text-text-muted">
            Responda cada ítem de control para completar la inspección periódica.
          </p>
        </div>
        {hasCriticalFailure && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1 animate-pulse">
            <ShieldAlert size={12} /> Alerta Crítica
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {checklistItems.map((item, index) => {
          const currentAnswer = answers[item.id] || { status: 'OK', observation: '' };
          const isNoOk = currentAnswer.status === 'NO_OK';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all space-y-2 ${isNoOk
                ? item.isCritical
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : 'bg-amber-500/5 border-amber-500/30'
                : 'bg-bg/40 border-border'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                      {index + 1}
                    </span>
                    <h4 className="text-xs font-bold text-text-main">{item.label}</h4>
                    {item.isCritical && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Crítico
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-text-muted mt-1 ml-7">{item.description}</p>
                  )}
                </div>

                {/* Botones de respuesta */}
                <div className="flex items-center gap-1 shrink-0 ml-7 sm:ml-0">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'OK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${currentAnswer.status === 'OK'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-surface text-text-muted hover:bg-bg border border-border'
                      }`}
                  >
                    <CheckCircle2 size={14} /> OK
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'NO_OK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${currentAnswer.status === 'NO_OK'
                      ? item.isCritical
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-amber-500 text-white shadow-xs'
                      : 'bg-surface text-text-muted hover:bg-bg border border-border'
                      }`}
                  >
                    <XCircle size={14} /> NO OK
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'N_A')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentAnswer.status === 'N_A'
                      ? 'bg-text-muted text-white shadow-xs'
                      : 'bg-surface text-text-muted hover:bg-bg border border-border'
                      }`}
                  >
                    N/A
                  </button>
                </div>
              </div>

              {/* Campo de observación si es NO OK */}
              {isNoOk && (
                <div className="ml-7 pt-2 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    Detalle del hallazgo u observación *
                  </label>
                  <input
                    type="text"
                    required
                    value={currentAnswer.observation}
                    onChange={e => handleObservationChange(item.id, e.target.value)}
                    placeholder="Describa el motivo de la no conformidad..."
                    className="w-full px-3 py-1.5 rounded-lg border border-rose-500/30 bg-surface text-text-main text-xs focus:ring-1 focus:ring-rose-500 outline-hidden"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Comentarios Generales y Adjuntar Foto */}
        <div className="p-3.5 rounded-xl border border-border bg-bg/40 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <MessageSquare size={14} className="text-primary" /> Observaciones generales de la Inspección
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHasPhotoEvidence(!hasPhotoEvidence)}
                className={`text-[11px] font-bold px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors ${hasPhotoEvidence
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'text-primary hover:bg-primary/10'
                  }`}
              >
                <Camera size={14} />
                {hasPhotoEvidence ? 'Foto Adjuntada' : 'Adjuntar Foto (Opcional)'}
              </button>
            </div>
          </div>
          <textarea
            rows={2}
            value={generalComments}
            onChange={e => setGeneralComments(e.target.value)}
            placeholder="Ingrese notas adicionales o sugerencias sobre el estado del objeto..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
          />
        </div>

        {/* Botón Finalizar Inspección */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`w-full sm:w-auto px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${isSubmitDisabled ? 'bg-bg border border-border text-text-muted cursor-not-allowed' : 'bg-primary hover:bg-primary/90'
              }`}
          >
            Finalizar y registrar inspección
          </button>
        </div>
      </form>
    </div>
  );
}
