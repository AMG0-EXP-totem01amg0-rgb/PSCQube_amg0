import React, { useState } from 'react';
import { QRScannerSimulator } from './QRScannerSimulator';
import { ObjectInspectionHistory } from './ObjectInspectionHistory';
import { ActiveChecklistForm } from './ActiveChecklistForm';
import { HSObject, HSChecklistItem, HSInspection, HSChecklistAnswerStatus } from '../types';
import { AppUser } from '../../../types';
import { MapPin, CheckCircle2, AlertCircle, Clock, FileCheck2 } from 'lucide-react';

interface HSScannerViewProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  checklistItems: HSChecklistItem[];
  inspectionHistory: HSInspection[];
  currentUser?: AppUser;
  onSelectQR: (qrCode: string) => boolean;
  onSubmitInspection: (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string }[];
  }) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function HSScannerView({
  objects,
  selectedObject,
  checklistItems,
  inspectionHistory,
  currentUser,
  onSelectQR,
  onSubmitInspection,
  addToast
}: HSScannerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'CHECKLIST' | 'HISTORY'>('CHECKLIST');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle2 size={14}/> Operativo</span>;
      case 'WARNING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20"><AlertCircle size={14}/> Observado</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20"><AlertCircle size={14}/> Falla Crítica</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20"><Clock size={14}/> Pendiente</span>;
    }
  };

  const handleFormSubmit = (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string }[];
  }) => {
    onSubmitInspection(data);
    if (addToast) {
      addToast('Inspección registrada con éxito', 'success');
    }
  };

  return (
    <div className="space-y-4">
      {/* Módulo Escáner QR */}
      <QRScannerSimulator
        objects={objects}
        selectedObject={selectedObject}
        onSelectQR={onSelectQR}
      />

      {/* Detalle del Objeto Seleccionado */}
      {selectedObject ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-primary/10 text-primary border border-primary/20">
                    {selectedObject.qrCode}
                  </span>
                  <h3 className="text-sm font-black text-text-main">{selectedObject.name}</h3>
                </div>
                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                  <MapPin size={12} className="text-primary" />
                  <span>{selectedObject.sectorName} — {selectedObject.locationDetail}</span>
                </p>
              </div>

              <div>{getStatusBadge(selectedObject.status)}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-bg border border-border">
                <span className="text-[10px] font-bold text-text-muted uppercase block">Tipo de Objeto</span>
                <span className="font-bold text-text-main">{selectedObject.typeName}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-bg border border-border">
                <span className="text-[10px] font-bold text-text-muted uppercase block">Último Control</span>
                <span className="font-mono text-text-main font-bold">{selectedObject.lastInspectedAt || 'Sin registros'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-bg border border-border col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-text-muted uppercase block">Próximo Vencimiento</span>
                <span className="font-mono text-primary font-bold">{selectedObject.nextInspectionDue}</span>
              </div>
            </div>
          </div>

          {/* Navegación interna (Checklist / Historial) */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveSubTab('CHECKLIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'CHECKLIST'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg'
              }`}
            >
              <FileCheck2 size={14} />
              <span>Realizar Inspección</span>
            </button>

            <button
              onClick={() => setActiveSubTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'HISTORY'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg'
              }`}
            >
              <Clock size={14} />
              <span>Historial ({inspectionHistory.length})</span>
            </button>
          </div>

          {/* Contenido según SubTab */}
          {activeSubTab === 'CHECKLIST' && (
            <ActiveChecklistForm
              selectedObject={selectedObject}
              checklistItems={checklistItems}
              currentUser={currentUser}
              onSubmit={handleFormSubmit}
            />
          )}

          {activeSubTab === 'HISTORY' && (
            <ObjectInspectionHistory history={inspectionHistory} />
          )}
        </div>
      ) : (
        <div className="p-12 text-center bg-surface rounded-2xl border border-border text-text-muted text-xs">
          Seleccione o escanee un código QR arriba para comenzar la inspección del objeto.
        </div>
      )}
    </div>
  );
}
