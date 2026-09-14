import React, { useState, useEffect } from 'react';
import { ScheduledInspectionsFilter } from './ScheduledInspectionsFilter';
import { ActiveChecklistForm } from './ActiveChecklistForm';
import { HSObject, HSChecklistItem, HSInspection, HSChecklistAnswerStatus, HSChecklistModel } from '../types';
import { AppUser } from '../../../types';
import { FileCheck2, ShieldCheck, Search, AlertCircle, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';

interface HSScannerViewProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  checklistModels?: HSChecklistModel[];
  checklistItems: HSChecklistItem[];
  allChecklistItems?: HSChecklistItem[];
  inspectionHistory?: HSInspection[];
  allInspections?: HSInspection[];
  currentUser?: AppUser;
  onSelectQR: (qrCode: string) => boolean;
  onSubmitInspection: (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string; actionPlan?: string }[];
  }) => void;
  onClearSelection: () => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onViewCertificate?: (inspectionId: string) => void;
  pendingChecklistQr?: string | null;
  onPendingChecklistHandled?: () => void;
  isStandaloneChecklist?: boolean;
}

export function HSScannerView({
  objects,
  selectedObject,
  checklistModels = [],
  checklistItems,
  allChecklistItems = [],
  inspectionHistory = [],
  allInspections = [],
  currentUser,
  onSelectQR,
  onSubmitInspection,
  onClearSelection,
  addToast,
  onViewCertificate,
  pendingChecklistQr,
  onPendingChecklistHandled,
  isStandaloneChecklist = false
}: HSScannerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'CHECKLIST' | 'HISTORY'>('CHECKLIST');
  const [isChecklistUnlocked, setIsChecklistUnlocked] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Nuevos estados para el flujo del modal de modelos
  const [isSummaryAccepted, setIsSummaryAccepted] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  type ModalStep = 'CLOSED' | 'SELECT_OBJECT' | 'SELECT_MODEL' | 'FILL_CHECKLIST';
  const [modalStep, setModalStep] = useState<ModalStep>('CLOSED');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-handle pending QR for checklists
  useEffect(() => {
    if (pendingChecklistQr) {
      const success = onSelectQR(pendingChecklistQr);
      if (success) {
        setIsSummaryAccepted(true);
        setIsChecklistUnlocked(true);
      } else {
        if (addToast) addToast('No se encontró el objeto correspondiente al código QR para inspeccionar.', 'error');
      }
      if (onPendingChecklistHandled) {
        onPendingChecklistHandled();
      }
    }
  }, [pendingChecklistQr, onSelectQR, onPendingChecklistHandled, addToast]);

  const handleFormSubmit = async (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string; actionPlan?: string }[];
  }) => {
    await onSubmitInspection(data);
    if (addToast) {
      addToast('Inspección registrada con éxito', 'success');
    }
  };

  // FUNCIÓN PARA FORMATEAR FECHA A DD/MM/AAAA HH:mm
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

  const handleObjectSelection = (qrCode: string) => {
    setSearchError('');
    const success = onSelectQR(qrCode);
    if (!success) {
      setSearchError('Punto de inspección no encontrado.');
    } else {
      if (isStandaloneChecklist) {
        setIsChecklistUnlocked(true);
      } else {
        const obj = objects.find(o => o.qrCode === qrCode);
        if (obj) {
          const availableModels = checklistModels?.filter(m => m.objectTypeId === obj.typeId || m.objectTypeId === obj.typeName) || [];
          if (availableModels.length > 1) {
            setModalStep('SELECT_MODEL');
          } else {
            setSelectedModelId(availableModels[0]?.id || null);
            setModalStep('FILL_CHECKLIST');
          }
        }
      }
    }
  };

  const startInspectionProcess = () => {
    if (!selectedObject) return;
    
    // Check how many models this object type has
    const availableModels = checklistModels?.filter(m => m.objectTypeId === selectedObject.typeId || m.objectTypeId === selectedObject.typeName) || [];
    
    if (availableModels.length > 1) {
      setModalStep('SELECT_MODEL');
    } else {
      setSelectedModelId(availableModels[0]?.id || null);
      setIsSummaryAccepted(true);
    }
  };

  const confirmModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
    if (isStandaloneChecklist) {
      setModalStep('CLOSED');
      setIsSummaryAccepted(true);
    } else {
      setModalStep('FILL_CHECKLIST');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros en Cascada para Inspecciones Programadas */}
      {!isStandaloneChecklist && (
        <ScheduledInspectionsFilter
          objects={objects}
          inspections={allInspections}
          checklistItems={allChecklistItems.length > 0 ? allChecklistItems : checklistItems}
          selectedObject={selectedObject}
          onSelectObject={onSelectQR}
          onViewCertificate={onViewCertificate}
          onNewInspectionClick={() => setModalStep('SELECT_OBJECT')}
        />
      )}

      {/* Flujo de Inicio de Inspección para Módulo Standalone */}
      {isStandaloneChecklist && (
        <div className="border-t border-border pt-6">
          {selectedObject ? (
          <div className="space-y-4 animate-fade-in">
            {!isChecklistUnlocked ? (
              <div className="space-y-4 animate-fade-in p-8 bg-surface border border-border rounded-2xl text-center shadow-xs">
                <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-base font-black uppercase tracking-wider text-text-main">
                  Autorización Requerida
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Para realizar una inspección programada en el equipo <strong>{selectedObject.name}</strong>, debe confirmar su identidad como personal autorizado.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => setIsChecklistUnlocked(true)}
                    className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    Confirmar Autorización
                  </button>
                </div>
              </div>
            ) : !isSummaryAccepted ? (
              // PANTALLA DE RESUMEN DEL ACTIVO
              <div className="p-6 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-black text-text-main">{selectedObject.name}</h3>
                  <p className="text-xs font-mono text-text-muted mt-1">{selectedObject.qrCode}</p>
                </div>

                <div className="bg-bg rounded-xl p-4 border border-border grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-text-muted font-bold block mb-1">Tipo de Activo:</span>
                    <span className="text-text-main">{selectedObject.typeName}</span>
                  </div>
                  <div>
                    <span className="text-text-muted font-bold block mb-1">Sector:</span>
                    <span className="text-text-main">{selectedObject.sectorName}</span>
                  </div>
                  <div>
                    <span className="text-text-muted font-bold block mb-1">Última Inspección:</span>
                    <span className="text-text-main">{selectedObject.lastInspectedAt ? formatDate(selectedObject.lastInspectedAt) : 'Sin registros'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted font-bold block mb-1">Estado Actual:</span>
                    {selectedObject.status === 'OK' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                        <CheckCircle2 size={14} /> HABILITADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                        <AlertTriangle size={14} /> NO HABILITADO
                      </span>
                    )}
                  </div>
                </div>
                
                {inspectionHistory && inspectionHistory.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase text-text-muted mb-2 border-b border-border pb-1">Respuestas Última Inspección</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                      {inspectionHistory[0].answers.map((ans: any, idx: number) => (
                        <div key={idx} className="text-[11px] flex items-center justify-between p-2 rounded-lg bg-bg border border-border/50">
                          <span className="truncate pr-2">{ans.checklistItemLabel}</span>
                          <span className={`font-bold shrink-0 ${ans.status === 'NO_OK' ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {ans.status === 'NO_OK' ? 'MALO' : 'BIEN'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-border">
                  <button
                    onClick={() => {
                      onClearSelection();
                      setIsChecklistUnlocked(false);
                    }}
                    className="px-4 py-2 text-text-muted hover:text-text-main text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={startInspectionProcess}
                    className="px-6 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    Realizar Inspección
                  </button>
                </div>
              </div>
            ) : (
              // FORMULARIO ACTIVO DEL CHECKLIST
              <ActiveChecklistForm
                selectedObject={selectedObject}
                checklistItems={selectedModelId ? checklistItems.filter(ci => ci.checklistModelId === selectedModelId) : checklistItems}
                currentUser={currentUser}
                onSubmit={handleFormSubmit}
                onClearSelection={() => {
                  setIsChecklistUnlocked(false);
                  setIsSummaryAccepted(false);
                  setSelectedModelId(null);
                  onClearSelection();
                }}
              />
            )}
          </div>
        ) : (
          /* PANTALLA DE SELECCIÓN CUANDO NO HAY OBJETO SELECCIONADO Y ES STANDALONE */
          <div className="space-y-4 animate-fade-in">
            {isStandaloneChecklist && !isChecklistUnlocked && (
              <div className="space-y-4 animate-fade-in p-8 bg-surface border border-border rounded-2xl text-center shadow-xs">
                <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-base font-black uppercase tracking-wider text-text-main">
                  Autorización Requerida
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Para iniciar el proceso de inspecciones programadas, debe confirmar su identidad como personal autorizado.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => setIsChecklistUnlocked(true)}
                    className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    Confirmar Autorización
                  </button>
                </div>
              </div>
            )}
            {isStandaloneChecklist && isChecklistUnlocked && (
               <div className="p-8 bg-surface border border-border rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6 text-center">
                 <h3 className="text-lg font-black text-text-main">Listo para escanear</h3>
                 <p className="text-xs text-text-muted">Por favor, utilice el código QR que se encuentra en el equipo.</p>
               </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* Modal Multi-paso de Nueva Inspección */}
      {modalStep !== 'CLOSED' && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto pt-8 pb-8">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
            <div className="p-4 border-b border-border bg-black/5 dark:bg-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
                {modalStep === 'SELECT_OBJECT' ? 'Seleccionar Punto de Inspección' : 
                 modalStep === 'SELECT_MODEL' ? 'Seleccionar Tipo de Inspección' :
                 'Completar Inspección'}
              </h3>
              <button 
                onClick={() => {
                  setModalStep('CLOSED');
                  onClearSelection();
                }}
                className="p-2 text-text-muted hover:text-text-main transition-colors cursor-pointer rounded-lg hover:bg-surface"
              >
                Cancelar
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {modalStep === 'SELECT_OBJECT' && (
                <>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar por código, nombre o sector..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-medium text-text-main focus:ring-2 focus:ring-primary/50 outline-hidden"
                    />
                  </div>

                  <div className="space-y-2">
                    {objects.filter(obj => 
                      obj.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      obj.qrCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      obj.sectorName?.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(obj => (
                      <button
                        key={obj.id}
                        onClick={() => handleObjectSelection(obj.qrCode)}
                        className="w-full text-left p-4 rounded-xl border border-border bg-black/5 dark:bg-white/5 hover:border-primary transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted">
                              {obj.qrCode}
                            </span>
                            <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{obj.name}</h4>
                          </div>
                          <p className="text-[11px] text-text-muted">
                            Sector: {obj.sectorName || 'N/A'} • Tipo: {obj.typeName}
                          </p>
                        </div>
                        <CheckCircle2 size={18} className="text-text-muted group-hover:text-primary" />
                      </button>
                    ))}
                    {objects.filter(obj => 
                      obj.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      obj.qrCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      obj.sectorName?.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-12 text-text-muted">
                        No se encontraron puntos de inspección que coincidan con la búsqueda.
                      </div>
                    )}
                  </div>
                </>
              )}

              {modalStep === 'SELECT_MODEL' && selectedObject && (
                <div className="space-y-4 max-w-md mx-auto py-8">
                  <p className="text-sm text-text-muted text-center mb-6">
                    El activo <strong className="text-text-main">{selectedObject.name}</strong> cuenta con múltiples modelos de checklist. Seleccione cuál desea ejecutar:
                  </p>
                  <div className="space-y-2">
                    {checklistModels?.filter(m => m.objectTypeId === selectedObject.typeId || m.objectTypeId === selectedObject.typeName).map(model => (
                      <button
                        key={model.id}
                        onClick={() => confirmModelSelection(model.id)}
                        className="w-full text-left p-4 rounded-xl border border-border bg-black/5 dark:bg-white/5 hover:border-primary transition-colors group flex items-center justify-between cursor-pointer"
                      >
                        <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{model.name}</h4>
                        <p className="text-[11px] text-text-muted mt-1">
                          {checklistItems.filter(ci => ci.checklistModelId === model.id).length} ítems configurados
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalStep === 'FILL_CHECKLIST' && selectedObject && (
                <div className="pb-8">
                  <ActiveChecklistForm
                    selectedObject={selectedObject}
                    checklistItems={selectedModelId ? checklistItems.filter(ci => ci.checklistModelId === selectedModelId) : checklistItems}
                    currentUser={currentUser}
                    onSubmit={async (data) => {
                      await handleFormSubmit(data);
                      setModalStep('CLOSED');
                    }}
                    onClearSelection={() => {
                      setModalStep('CLOSED');
                      onClearSelection();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

