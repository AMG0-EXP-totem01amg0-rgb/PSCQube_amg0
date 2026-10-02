import React, { useState } from 'react';
import { CheckCircle2, XCircle, Camera, MessageSquare, ShieldAlert, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
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
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string; actionPlan?: string }[];
  }) => Promise<any> | void;
  onClearSelection: () => void;
}

export function ActiveChecklistForm({
  selectedObject,
  checklistItems,
  currentUser,
  onSubmit,
  onClearSelection
}: ActiveChecklistFormProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [answers, setAnswers] = useState<Record<string, { status: HSChecklistAnswerStatus; observation: string; actionPlan: string; hasPhoto?: boolean; photoBase64?: string }>>(
    () => {
      const initial: Record<string, { status: HSChecklistAnswerStatus; observation: string; actionPlan: string; hasPhoto?: boolean; photoBase64?: string }> = {};
      checklistItems.forEach(ci => {
        initial[ci.id] = { status: 'N_A', observation: '', actionPlan: '', hasPhoto: false, photoBase64: '' };
      });
      return initial;
    }
  );

  const [showGeneralComments, setShowGeneralComments] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [generalComments, setGeneralComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPhotoEvidence, setHasPhotoEvidence] = useState(false);

  if (checklistItems.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-2xl shadow-xs">
        <h3 className="text-lg font-black uppercase tracking-wider text-text-main mb-2">Sin Checklist Configurado</h3>
        <p className="text-text-muted text-sm mb-6">
          El punto de inspección seleccionado (<strong className="text-primary">{selectedObject.name}</strong>) no tiene un modelo de checklist asignado o el modelo no contiene ítems.
        </p>
        <button
          onClick={onClearSelection}
          className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-hover transition-colors"
        >
          Seleccionar otro activo
        </button>
      </div>
    );
  }

  // Estado del Modal de Incidencia (MALO)
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ observation: '', actionPlan: '', hasPhoto: false });

  const total = checklistItems.length;
  const isFinalStep = currentIndex === total;
  const currentItem = isFinalStep ? null : checklistItems[currentIndex];

  const handleStatusChange = (itemId: string, status: HSChecklistAnswerStatus) => {
    if (status === 'OK' || status === 'N_A') {
      // Guardar status OK/N_A y resetear observaciones
      setAnswers(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], status, observation: '', actionPlan: '' }
      }));
      // Avanzar automáticamente si es BIEN
      if (status === 'OK') {
        setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
      }
    } else if (status === 'NO_OK') {
      // Abrir modal, cargar datos existentes si los hay
      const currentAns = answers[itemId];
      setModalData({
        observation: currentAns.observation || '',
        actionPlan: currentAns.actionPlan || '',
        hasPhoto: currentAns.hasPhoto || false
      });
      setShowModal(true);
    }
  };

  const confirmMalo = () => {
    // Guardar los datos del modal en la pregunta actual
    if (!currentItem) return;
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        status: 'NO_OK',
        observation: modalData.observation,
        actionPlan: modalData.actionPlan,
        hasPhoto: modalData.hasPhoto
      }
    }));
    setShowModal(false);
    // Avanzar a la siguiente pregunta o al paso final
    setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
  };

  const cancelMalo = () => {
    if (!currentItem) return;
    setShowModal(false);
    // Opcional: Revertir a N_A si no se confirma
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: { ...prev[currentItem.id], status: 'N_A' }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formattedAnswers = (Object.entries(answers) as [string, { status: HSChecklistAnswerStatus; observation: string; actionPlan: string; hasPhoto?: boolean; photoBase64?: string }][]).map(([checklistItemId, val]) => ({
      checklistItemId,
      status: val.status,
      observation: val.observation,
      actionPlan: val.actionPlan,
      hasPhoto: val.hasPhoto,
      photoBase64: val.photoBase64
    }));

    await onSubmit({
      objectId: selectedObject.id,
      operatorDni: currentUser?.dni || 'OPER-01',
      operatorName: currentUser?.name || 'Operario de Planta',
      comments: generalComments,
      answers: formattedAnswers
    });

    setIsSubmitting(false);
    
    // Close the form and reset state
    setCurrentIndex(0);
    setGeneralComments('');
    onClearSelection();
  };

  const hasAnyNoOk = checklistItems.some(ci => answers[ci.id]?.status === 'NO_OK');
  const hasUnansweredItems = checklistItems.some(ci => answers[ci.id]?.status === 'N_A');
  const isSubmitDisabled = isSubmitting || hasUnansweredItems;

  const currentAnswer = currentItem ? (answers[currentItem.id] || { status: 'N_A', observation: '', actionPlan: '', hasPhoto: false }) : null;

  return (
    <div className="relative">
      <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              Checklist de Inspección Activo
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Identificador del activo: <strong className="text-primary">{selectedObject.name}</strong>
            </p>
          </div>

          <div className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
            hasAnyNoOk
              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
          }`}>
            {hasAnyNoOk ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
            <span>{hasAnyNoOk ? 'NO HABILITADO' : 'HABILITADO'}</span>
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-text-main dark:text-white">
            <span>{isFinalStep ? 'Paso Final' : `Pregunta ${currentIndex + 1} de ${total}`}</span>
            <span>{Math.round(((checklistItems.filter(ci => answers[ci.id]?.status !== 'N_A').length) / total) * 100)}% Completado</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${((checklistItems.filter(ci => answers[ci.id]?.status !== 'N_A').length) / total) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isFinalStep && currentItem && currentAnswer ? (
            /* Tarjeta de Pregunta Actual */
            <div className="p-6 rounded-2xl border border-border bg-black/5 dark:bg-white/5 shadow-inner space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-white font-black flex items-center justify-center text-sm shadow-md">
                  {currentIndex + 1}
                </span>
                <div>
                  <h4 className="text-sm font-black text-text-main leading-snug">
                    {currentItem.label}
                    {currentItem.isCritical && (
                      <span className="inline-block ml-2 align-middle text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Crítico
                      </span>
                    )}
                  </h4>
                  {currentItem.description && (
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{currentItem.description}</p>
                  )}
                </div>
              </div>

            {/* Opciones de Respuesta */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleStatusChange(currentItem.id, 'OK')}
                className={`py-4 px-4 rounded-xl text-sm font-black transition-all flex flex-col items-center justify-center gap-2 border-2 cursor-pointer ${
                  currentAnswer.status === 'OK'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-[1.02]'
                    : 'bg-surface border-border text-text-muted hover:border-emerald-500/30 hover:bg-emerald-500/5'
                }`}
              >
                <CheckCircle2 size={24} className={currentAnswer.status === 'OK' ? 'text-white' : ''} /> 
                BIEN
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange(currentItem.id, 'NO_OK')}
                className={`py-4 px-4 rounded-xl text-sm font-black transition-all flex flex-col items-center justify-center gap-2 border-2 cursor-pointer ${
                  currentAnswer.status === 'NO_OK'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-md scale-[1.02]'
                    : 'bg-surface border-border text-text-muted hover:border-rose-500/30 hover:bg-rose-500/5'
                }`}
              >
                <XCircle size={24} className={currentAnswer.status === 'NO_OK' ? 'text-white' : ''} /> 
                MALO
              </button>
            </div>
            
            {/* Botón de Foto para Críticos o Malos */}
            {(currentItem.isCritical || currentAnswer.status === 'NO_OK') && (
              <div className="pt-2 flex justify-start flex-col gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800;
                        const scaleSize = MAX_WIDTH / img.width;
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;

                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        const base64 = canvas.toDataURL('image/webp', 0.7);
                        setAnswers(prev => ({
                          ...prev,
                          [currentItem.id]: { ...prev[currentItem.id], hasPhoto: true, photoBase64: base64 }
                        }));
                      };
                      img.src = ev.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-[10px] w-fit font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    currentAnswer.hasPhoto
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'border-border bg-bg text-text-main hover:bg-surface'
                  }`}
                >
                  <Camera size={14} className={currentAnswer.hasPhoto ? '' : 'text-primary'} />
                  {currentAnswer.hasPhoto ? 'REEMPLAZAR FOTO ADJUNTADA' : 'ADJUNTAR FOTO (EVIDENCIA)'}
                </button>
                {currentAnswer.photoBase64 && (
                  <div className="mt-2 w-32 h-32 rounded-lg overflow-hidden border border-border shadow-sm">
                    <img src={currentAnswer.photoBase64} alt="Evidencia" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}
            
            {/* Si ya respondió MALO y el modal está cerrado, mostramos un resumen */}
            {currentAnswer.status === 'NO_OK' && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2 mt-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-500 uppercase">Observación Registrada</span>
                  <button type="button" onClick={() => setShowModal(true)} className="text-[10px] text-primary hover:underline cursor-pointer font-bold">Editar</button>
                </div>
                <p className="text-xs text-text-main line-clamp-2">{currentAnswer.observation}</p>
              </div>
            )}
          </div>
          ) : null}

          {/* Comentarios Generales y Finalizar (Solo en el paso final) */}
          {isFinalStep && (
            <div className="p-4 rounded-2xl border border-border bg-surface space-y-4 animate-fade-in">
              {!showGeneralComments ? (
                 <button
                   type="button"
                   onClick={() => setShowGeneralComments(true)}
                   className="w-full py-3 px-2 rounded-xl border border-dashed border-border bg-surface text-text-main text-xs font-bold hover:bg-bg transition-colors flex flex-col sm:flex-row items-center justify-center gap-2 cursor-pointer text-center whitespace-normal"
                 >
                   <MessageSquare size={16} /> AGREGAR OBSERVACIONES GENERALES (OPCIONAL)
                 </button>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-primary" /> Observaciones Generales
                    </label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setShowGeneralComments(false)}
                        className="text-[10px] text-text-muted hover:text-text-main font-bold cursor-pointer"
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={generalComments}
                    onChange={e => setGeneralComments(e.target.value)}
                    placeholder="Ingrese notas finales, contexto adicional o recomendaciones generales..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-bg text-text-main text-xs focus:ring-2 focus:ring-primary/50 outline-hidden resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Navegación y Acciones Finales */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-xs font-bold text-text-main hover:bg-bg rounded-lg transition-colors flex items-center gap-1 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={16} /> Atrás
            </button>

            {isFinalStep ? (
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSubmitDisabled 
                    ? 'bg-bg border border-border text-text-muted cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                GUARDAR Y FINALIZAR INSPECCIÓN
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.min(total, prev + 1))}
                disabled={currentAnswer?.status === 'N_A'}
                className="px-6 py-2 bg-surface border border-border text-text-main hover:bg-bg text-xs font-bold rounded-xl transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* MODAL PARA RESPUESTA "MALO" */}
      {showModal && currentItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="bg-rose-500/10 px-5 py-4 border-b border-rose-500/20 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider">Reporte de Incidencia</h3>
                <p className="text-xs text-rose-500/80 font-medium">Ítem #{currentIndex + 1}: {currentItem.label}</p>
              </div>
            </div>

            {/* Contenido del Modal (Scrollable si es muy largo) */}
            <div className="p-5 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-rose-500">
                  Detalle del Problema / Observación *
                </label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  value={modalData.observation}
                  onChange={e => setModalData(prev => ({ ...prev, observation: e.target.value }))}
                  placeholder="Describa la falla, rotura o irregularidad encontrada..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/5 text-text-main text-xs focus:ring-2 focus:ring-rose-500/50 outline-hidden resize-none"
                />
              </div>

              {/* Botón de adjuntar foto dentro del modal */}
              <div>
                <button
                  type="button"
                  onClick={() => setModalData(prev => ({ ...prev, hasPhoto: !prev.hasPhoto }))}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    modalData.hasPhoto
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'border-border bg-bg text-text-main hover:bg-border'
                  }`}
                >
                  <Camera size={14} className={modalData.hasPhoto ? '' : 'text-primary'} />
                  {modalData.hasPhoto ? 'FOTO ADJUNTADA' : 'Capturar Foto de la Incidencia (Opcional)'}
                </button>
              </div>

              {/* Si es crítico, se exige Plan de Acción */}
              {currentItem.isCritical && (
                <div className="space-y-1.5 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-amber-500">
                      Generar Plan de Acción / Aviso de Mantenimiento *
                    </label>
                    <span className="text-[8px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase">Urgent</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={modalData.actionPlan}
                    onChange={e => setModalData(prev => ({ ...prev, actionPlan: e.target.value }))}
                    placeholder="Indique qué medidas deben tomarse, quién es responsable y si amerita parada de equipo..."
                    className="w-full px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 text-text-main text-xs focus:ring-2 focus:ring-amber-500/50 outline-hidden resize-none"
                  />
                </div>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="p-4 border-t border-border bg-bg flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={cancelMalo}
                className="px-5 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmMalo}
                disabled={!modalData.observation.trim() || (currentItem.isCritical && !modalData.actionPlan.trim())}
                className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Confirmar Detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

