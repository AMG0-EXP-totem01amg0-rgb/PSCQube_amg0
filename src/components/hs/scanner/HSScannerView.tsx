import React, { useState, useEffect, useRef } from 'react';
import { ScheduledInspectionsFilter } from './ScheduledInspectionsFilter';
import { ActiveChecklistForm } from './ActiveChecklistForm';
import { HSObject, HSChecklistItem, HSInspection, HSChecklistAnswerStatus, HSChecklistModel } from '../types';
import { AppUser } from '../../../types';
import { FileCheck2, ShieldCheck, QrCode, Search, Camera, AlertCircle, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

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
  onPendingChecklistHandled
}: HSScannerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'CHECKLIST' | 'HISTORY'>('CHECKLIST');
  const [isChecklistUnlocked, setIsChecklistUnlocked] = useState(false);

  const [manualCode, setManualCode] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Nuevos estados para el flujo del modal de modelos
  const [isSummaryAccepted, setIsSummaryAccepted] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

  // Stop scanner if component unmounts or if we successfully found an object
  useEffect(() => {
    if (selectedObject && scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
      setIsScanning(false);
    }
  }, [selectedObject]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

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

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!manualCode.trim()) return;
    
    const success = onSelectQR(manualCode.trim());
    if (!success) {
      setSearchError('Objeto no encontrado o no registrado.');
    } else {
      setManualCode('');
    }
  };

  const startScanner = () => {
    setSearchError('');
    setIsScanning(true);
    
    // timeout to ensure the DOM element exists
    setTimeout(() => {
      if (!document.getElementById('reader')) return;
      
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scannerRef.current = scanner;
      
      scanner.render((decodedText) => {
        const success = onSelectQR(decodedText);
        if (success) {
          scanner.clear().catch(console.error);
          scannerRef.current = null;
          setIsScanning(false);
        } else {
          setSearchError(`Código escaneado "${decodedText}" no corresponde a un activo registrado.`);
        }
      }, (err) => {
        // Ignore continuous scan errors
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startInspectionProcess = () => {
    if (!selectedObject) return;
    
    // Check how many models this object type has
    const availableModels = checklistModels.filter(m => m.objectTypeId === selectedObject.typeId || m.objectTypeId === selectedObject.typeName);
    
    if (availableModels.length > 1) {
      setIsModelSelectorOpen(true);
    } else {
      setSelectedModelId(availableModels[0]?.id || null);
      setIsSummaryAccepted(true);
    }
  };

  const confirmModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
    setIsModelSelectorOpen(false);
    setIsSummaryAccepted(true);
  };

  return (
    <div className="space-y-6">
      {/* Filtros en Cascada para Inspecciones Programadas */}
      <ScheduledInspectionsFilter
        objects={objects}
        inspections={allInspections}
        checklistItems={allChecklistItems.length > 0 ? allChecklistItems : checklistItems}
        selectedObject={selectedObject}
        onSelectObject={onSelectQR}
        onViewCertificate={onViewCertificate}
      />

      {/* Flujo de Inicio de Inspección */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <FileCheck2 size={20} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider text-text-main">
            Realizar Nueva Inspección
          </h2>
        </div>

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
          /* PANTALLA DE SELECCIÓN CUANDO NO HAY OBJETO SELECCIONADO */
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
            ) : (
              <div className="p-8 bg-surface border border-border rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-text-main">Identificación del Activo</h3>
                  <p className="text-xs text-text-muted">Escanee el código QR del equipo o ingrese su ID manualmente para desplegar su checklist de inspección.</p>
                </div>

                {searchError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-500">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold">{searchError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lector de Cámara */}
                  <div className="space-y-3 bg-bg p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase">
                      <Camera size={16} />
                      <span>Escanear QR</span>
                    </div>
                    
                    {isScanning ? (
                      <div className="space-y-3">
                        <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border border-border"></div>
                        <button
                          type="button"
                          onClick={stopScanner}
                          className="w-full px-4 py-2 bg-surface border border-border text-text-main text-xs font-bold rounded-lg hover:bg-bg transition-colors cursor-pointer"
                        >
                          Cancelar Escáner
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                          <QrCode size={24} />
                        </div>
                        <button
                          type="button"
                          onClick={startScanner}
                          className="w-full px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                        >
                          Activar Cámara
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ingreso Manual */}
                  <div className="space-y-3 bg-bg p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase">
                      <Search size={16} />
                      <span>Ingreso Manual</span>
                    </div>
                    
                    <form onSubmit={handleManualSearch} className="pt-2 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-text-muted">
                          Código ID del Equipo
                        </label>
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          placeholder="Ej: QR-EXT-001"
                          className="w-full px-3 py-2 text-sm font-mono font-medium bg-surface border border-border rounded-lg text-text-main focus:ring-2 focus:ring-primary/50 outline-hidden"
                        />
                      </div>
                      
                      <button
                        type="submit"
                        disabled={!manualCode.trim()}
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text-main text-xs font-bold rounded-xl hover:bg-bg transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Buscar Equipo
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Selector de Modelo */}
      {isModelSelectorOpen && selectedObject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main mb-4">
              Seleccionar Tipo de Inspección
            </h3>
            <p className="text-xs text-text-muted mb-4">
              El activo <strong>{selectedObject.name}</strong> cuenta con múltiples modelos de checklist. Seleccione cuál desea ejecutar:
            </p>

            <div className="space-y-2">
              {checklistModels.filter(m => m.objectTypeId === selectedObject.typeId || m.objectTypeId === selectedObject.typeName).map(model => (
                <button
                  key={model.id}
                  onClick={() => confirmModelSelection(model.id)}
                  className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{model.name}</h4>
                  <p className="text-[11px] text-text-muted mt-1">
                    {checklistItems.filter(ci => ci.checklistModelId === model.id).length} ítems configurados
                  </p>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsModelSelectorOpen(false)}
                className="px-4 py-2 rounded-lg text-text-muted text-xs font-bold hover:bg-bg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

