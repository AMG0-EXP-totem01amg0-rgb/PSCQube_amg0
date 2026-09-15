import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowLeft, Printer, Share2, Check, ShieldCheck } from 'lucide-react';
import { HSObject, HSInspection, HSChecklistItem } from '../types';

interface InspectionCertificateViewProps {
  inspectionParam: string;
  objects: HSObject[];
  inspections: HSInspection[];
  checklistItems: HSChecklistItem[];
  onClose: () => void;
  onNewInspectionRequest?: () => void;
  isLoading?: boolean;
}

export function InspectionCertificateView({
  inspectionParam,
  objects,
  inspections,
  checklistItems,
  onClose,
  onNewInspectionRequest,
  isLoading
}: InspectionCertificateViewProps) {
  const [isCopied, setIsCopied] = useState(false);

  // 1. Buscar si el inspectionParam es un ID directo de inspección
  const targetInspection = useMemo(() => {
    if (!inspectionParam) return null;
    return inspections.find(i => i.id === inspectionParam) || null;
  }, [inspectionParam, inspections]);

  // 2. Buscar objeto por id de inspección, o por id/qrCode si se pasó el objeto
  const targetObject = useMemo(() => {
    if (targetInspection) {
      return objects.find(o => o.id === targetInspection.objectId) || null;
    }
    if (!inspectionParam) return null;
    const cleanParam = inspectionParam.trim().toUpperCase();
    return objects.find(
      o => o.id.toUpperCase() === cleanParam ||
        o.qrCode.toUpperCase().trim() === cleanParam
    ) || null;
  }, [inspectionParam, objects, targetInspection]);

  // 3. Inspección activa a mostrar
  const activeInspection = useMemo(() => {
    if (targetInspection) return targetInspection;
    if (!targetObject) return null;
    return inspections.find(i => i.objectId === targetObject.id) || null;
  }, [targetInspection, targetObject, inspections]);

  // Formateador de fecha DD/MM/AAAA HH:mm
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/') && dateString.includes(':')) return dateString;

    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) {
        const parts = dateString.split('T')[0].split('-');
        if (parts.length >= 3) return `${parts[2].substring(0,2)}/${parts[1]}/${parts[0]}`;
        return dateString;
      }
      
      if (!dateString.includes('T') && !dateString.includes(' ') && !dateString.includes(':')) {
        const parts = dateString.split('-');
        if (parts.length >= 3) return `${parts[2].substring(0,2)}/${parts[1]}/${parts[0]}`;
      }
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  // Respuestas del checklist
  const answersList = useMemo(() => {
    if (!targetObject) return [];

    if (activeInspection && activeInspection.answers && activeInspection.answers.length > 0) {
      return activeInspection.answers;
    }

    const relevantItems = checklistItems.filter(c => c.objectTypeId === targetObject.typeId);
    if (relevantItems.length > 0) {
      return relevantItems.map(item => {
        const isNoOk = targetObject.status === 'NO_OK' && item.isCritical;
        return {
          checklistItemId: item.id,
          checklistItemLabel: item.label,
          status: (isNoOk ? 'NO_OK' : 'OK') as any,
          observation: isNoOk ? (targetObject.observations || targetObject.notes || 'Detalle del hallazgo registrado') : '',
          actionPlan: isNoOk ? 'Reemplazo de componente afectado y revisión técnica por mantenimiento.' : '',
          isCriticalFinding: item.isCritical
        };
      });
    }

    const defaultItems = [
      { id: 'cli-1', label: 'Acceso y visibilidad despejada', isCritical: false },
      { id: 'cli-2', label: 'Manómetro en rango de presión correcto', isCritical: true },
      { id: 'cli-3', label: 'Precinto y pasador de seguridad intacto', isCritical: true },
      { id: 'cli-4', label: 'Manguera y boquilla en buen estado', isCritical: false },
      { id: 'cli-5', label: 'Tarjeta de inspección vigente', isCritical: false }
    ];

    return defaultItems.map((item, idx) => {
      const isNoOk = targetObject.status === 'NO_OK' && idx === 1;
      return {
        checklistItemId: item.id,
        checklistItemLabel: item.label,
        status: (isNoOk ? 'NO_OK' : 'OK') as any,
        observation: isNoOk ? (targetObject.observations || 'Falla detectada durante la inspección') : '',
        actionPlan: isNoOk ? 'Plan de acción para reemplazo y calibración por mantenimiento.' : '',
        isCriticalFinding: item.isCritical
      };
    });
  }, [targetObject, activeInspection, checklistItems]);

  const isHabilitado = targetObject?.status === 'OK';
  const hasFailedAnswers = answersList.some(a => a.status === 'NO_OK');

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?inspection=${targetObject?.id || inspectionParam}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const isDataLoading = isLoading !== undefined ? isLoading : (objects.length === 0 && inspections.length === 0);

  if (isDataLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Cargando certificado...</p>
      </div>
    );
  }

  if (!targetObject) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertTriangle size={48} className="mx-auto text-amber-500" />
          <h2 className="text-lg font-bold text-slate-800">Inspección no encontrada</h2>
          <p className="text-xs text-slate-500">
            No se encontró un registro coincidente para el código <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{inspectionParam}</code>.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Volver al Sistema
          </button>
        </div>
      </div>
    );
  }

  const hasNoHistory = inspections.filter(i => i.objectId === targetObject.id).length === 0;

  if (hasNoHistory) {
    return (
      <div className="w-full flex items-center justify-center p-8 animate-fade-in">
        <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-200">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Punto de Inspección</h2>
            <p className="font-mono bg-slate-100 text-blue-800 px-2 py-1 rounded inline-block mt-2 text-sm font-bold">
              {targetObject.qrCode}
            </p>
            <p className="text-sm font-semibold text-slate-600 mt-2">{targetObject.name}</p>
          </div>
          
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <p className="text-sm font-medium text-amber-800">
              Este punto aún no tiene inspecciones registradas en el sistema.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {onNewInspectionRequest && (
              <button
                onClick={onNewInspectionRequest}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Registrar Primera Inspección
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Volver al Sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full font-sans text-slate-800 animate-fade-in py-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          #certificado-formal-content {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Barra Superior Flotante de Acciones */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between no-print bg-surface border border-border p-3 rounded-2xl shadow-xs">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-bg hover:bg-surface border border-border text-text-main rounded-xl font-bold transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al Sistema
        </button>

        <div className="flex items-center gap-2">
          {onNewInspectionRequest && (
            <button
              onClick={onNewInspectionRequest}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 size={16} /> Nueva Inspección
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer"
          >
            <Printer size={16} /> Imprimir Certificado
          </button>
        </div>
      </div>

      {/* DOCUMENTO CERTIFICADO FORMAL (Ficha Blanca con Encabezado Azul Holcim) */}
      <div
        id="certificado-formal-content"
        className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Encabezado Superior Azul Holcim */}
        <div className="bg-blue-900 text-white p-6 border-b-4 border-blue-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">

              <span className="text-xs text-blue-200 font-semibold tracking-wide">
                Holcim (Argentina) S.A.
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider mt-1 text-white">
              Certificado de Inspección Programada
            </h1>
            <p className="text-xs text-blue-200 mt-0.5">
              Sistema de Gestión de Higiene, Seguridad y Medio Ambiente — Planta Malagueño
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-blue-300 font-bold block">
              N° Certificado / ID
            </span>
            <span className="font-mono text-sm font-black bg-blue-950/60 text-blue-100 px-3 py-1 rounded-lg border border-blue-700/60 inline-block mt-0.5">
              {activeInspection ? activeInspection.id.toUpperCase() : `INSP-${targetObject.qrCode}`}
            </span>
          </div>
        </div>

        {/* Cuerpo del Certificado */}
        <div className="p-6 space-y-6">

          {/* DATOS DEL REGISTRO */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
              1. Datos Principales del Registro
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Punto de Inspección / Activo</span>
                <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">
                    {targetObject.qrCode}
                  </span>
                  {targetObject.name}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Tipo de Inspección</span>
                <p className="font-bold text-slate-900 mt-0.5">{targetObject.typeName}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sector / Área</span>
                <p className="font-bold text-slate-900 mt-0.5">{targetObject.sectorName}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Inspector Responsable</span>
                <p className="font-bold text-slate-900 mt-0.5">{targetObject.lastInspectedBy || activeInspection?.operatorName || 'Operario de Planta'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Fecha de Inspección</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatDate(activeInspection ? activeInspection.date : targetObject.lastInspectedAt)}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Estado de Habilitación</span>
                <div className="mt-1">
                  {activeInspection ? (activeInspection.overallResult === 'HABILITADO' || activeInspection.overallResult === 'CONFORME' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      HABILITADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                      NO HABILITADO
                    </span>
                  )) : isHabilitado ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      HABILITADO
                    </span>
                  ) : targetObject.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                      PENDIENTE INSPECCIÓN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                      NO HABILITADO
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CHECKLIST DE CONTROL */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
              2. Desarrollo del Checklist de Control
            </h3>
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
                    <th className="p-3 border-r border-slate-300 w-12 text-center">N°</th>
                    <th className="p-3 border-r border-slate-300">ÍTEM INSPECCIONADO</th>
                    <th className="p-3 w-32 text-center">RESULTADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {answersList.map((ans, idx) => {
                    const isNoOk = ans.status === 'NO_OK';
                    return (
                      <tr key={idx} className={isNoOk ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
                        <td className="p-3 border-r border-slate-200 font-mono text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-medium text-slate-900">
                          {ans.checklistItemLabel}
                          {ans.isCriticalFinding && (
                            <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">
                              CRÍTICO
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isNoOk ? (
                            <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-xs">
                              MALO
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs">
                              BIEN
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETALLE DEL HALLAZGO Y PLAN DE ACCIÓN (Si hay items NO OK o NO HABILITADO) */}
          {(hasFailedAnswers || (activeInspection && activeInspection.overallResult !== 'HABILITADO' && activeInspection.overallResult !== 'CONFORME') || (!activeInspection && !isHabilitado && targetObject.status !== 'PENDING')) && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-800 border-b border-rose-200 pb-1">
                3. Hallazgos y Plan de Acción Requerido
              </h3>

              {answersList.filter(a => a.status === 'NO_OK').map((fail, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-rose-50 border-2 border-rose-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <span className="font-bold text-xs text-rose-900 uppercase tracking-wider">
                      Ítem #{idx + 1}: {fail.checklistItemLabel}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-rose-600 text-white rounded">
                      NO CONFORME
                    </span>
                  </div>

                  {/* Caja 1: Detalle del Hallazgo */}
                  <div className="p-3 bg-white rounded-lg border border-rose-300 space-y-1">
                    <span className="font-black text-rose-700 uppercase text-[9px] tracking-wider block">
                      DETALLE DEL HALLAZGO U OBSERVACIÓN ENCONTRADA *
                    </span>
                    <p className="text-xs text-slate-800 font-medium">
                      {fail.observation || targetObject.observations || 'Sin detalle de observación registrado.'}
                    </p>
                  </div>

                  {/* Caja 2: Plan de Acción */}
                  {fail.isCriticalFinding && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 space-y-1">
                      <span className="font-black text-amber-800 uppercase text-[9px] tracking-wider block">
                        PLAN DE ACCIÓN (TAREAS Y SEGUIMIENTO) *
                      </span>
                      <p className="text-xs text-slate-800 font-medium">
                        {fail.actionPlan || 'Sin resolución registrada por el momento.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* FIRMA Y VALIDACIÓN FINAL */}
          <div className="pt-6 border-t-2 border-slate-300 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="w-56 border-b-2 border-slate-800 pb-1 font-serif italic text-base text-slate-900 font-bold">
                {activeInspection?.operatorName || targetObject.lastInspectedBy || 'Operario de Planta'}
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                FIRMA / VALIDACIÓN DEL INSPECTOR
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Emitido el {new Date().toLocaleDateString('es-AR')}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1">

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
