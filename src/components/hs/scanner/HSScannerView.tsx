import React, { useState, useEffect } from 'react';
import { ScheduledInspectionsFilter } from './ScheduledInspectionsFilter';
import { ActiveChecklistForm } from './ActiveChecklistForm';
import { HSObject, HSChecklistItem, HSInspection, HSChecklistAnswerStatus } from '../types';
import { AppUser } from '../../../types';
import { FileCheck2, ShieldCheck } from 'lucide-react';

interface HSScannerViewProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  checklistItems: HSChecklistItem[];
  allChecklistItems?: HSChecklistItem[];
  inspectionHistory: HSInspection[];
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
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function HSScannerView({
  objects,
  selectedObject,
  checklistItems,
  allChecklistItems = [],
  inspectionHistory,
  allInspections = [],
  currentUser,
  onSelectQR,
  onSubmitInspection,
  addToast
}: HSScannerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'CHECKLIST' | 'HISTORY'>('CHECKLIST');
  const [isChecklistUnlocked, setIsChecklistUnlocked] = useState(false);

  useEffect(() => {
    setIsChecklistUnlocked(false);
    setActiveSubTab('CHECKLIST');
  }, [selectedObject?.id]);

  const handleFormSubmit = (data: {
    objectId: string;
    operatorDni: string;
    operatorName: string;
    comments?: string;
    answers: { checklistItemId: string; status: HSChecklistAnswerStatus; observation?: string; actionPlan?: string }[];
  }) => {
    onSubmitInspection(data);
    if (addToast) {
      addToast('Inspección registrada con éxito', 'success');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros en Cascada para Inspecciones Programadas */}
      <ScheduledInspectionsFilter
        objects={objects}
        inspections={allInspections}
        checklistItems={allChecklistItems.length > 0 ? allChecklistItems : checklistItems}
        selectedObject={selectedObject}
        onSelectObject={onSelectQR}
      />

      {/* Detalle del Objeto Seleccionado */}
      {selectedObject ? (
        <div className="space-y-4">
          {/* Navegación interna */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveSubTab('CHECKLIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'CHECKLIST'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg'
                }`}
            >
              <FileCheck2 size={14} />
              <span>Realizar Inspección</span>
            </button>
          </div>

          {/* Contenido según SubTab */}
          {activeSubTab === 'CHECKLIST' && (
            isChecklistUnlocked ? (
              <ActiveChecklistForm
                selectedObject={selectedObject}
                checklistItems={checklistItems}
                currentUser={currentUser}
                onSubmit={handleFormSubmit}
              />
            ) : (
              <div className="space-y-4 animate-fade-in p-8 bg-surface border border-border rounded-2xl text-center shadow-xs">
                <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-base font-black uppercase tracking-wider text-text-main">
                  Autorización Requerida
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Para realizar una inspección programada, debe confirmar su identidad como personal autorizado.
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
            )
          )}
        </div>
      ) : (
        <div className="p-12 text-center bg-surface rounded-2xl border border-border text-text-muted text-xs">
          escanee un código QR arriba para comenzar la inspección del objeto.
        </div>
      )}
    </div>
  );
}

