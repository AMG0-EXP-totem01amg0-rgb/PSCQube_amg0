import React, { useState, useEffect } from 'react';
import { ShieldCheck, QrCode, Settings, ClipboardList } from 'lucide-react';
import { useHSModule } from './useHSModule';
import { HSScannerView } from './scanner/HSScannerView';
import { HSAdminView } from './admin/HSAdminView';
import { HSActionPlansView } from './action-plans/HSActionPlansView';
import { InspectionCertificateView } from './scanner/InspectionCertificateView';
import { AppUser } from '../../types';

interface HSModuleViewProps {
  currentUser?: AppUser;
  isDark?: boolean;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type MainHSTab = 'SCANNER' | 'ADMIN' | 'ACTION_PLANS';

export default function HSModuleView({ currentUser, isDark, addToast }: HSModuleViewProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainHSTab>('SCANNER');
  const [pendingChecklistQr, setPendingChecklistQr] = useState<string | null>(() => {
    return sessionStorage.getItem('pending_checklist_qr');
  });
  const [sharedInspectionParam, setSharedInspectionParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('inspection') || params.get('id') || params.get('qr') || null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('inspection') || params.get('id') || params.get('qr');
    if (param) {
      setSharedInspectionParam(param);
    }
  }, []);

  const {
    objectTypes,
    sectors,
    objects,
    checklistItems,
    inspections,
    actionPlans,
    selectedObject,
    setSelectedObjectId,
    activeChecklistForSelectedObject,
    selectedObjectInspectionHistory,
    selectObjectByQR,
    submitInspection,
    addOrUpdateObjectType,
    deleteObjectType,
    addOrUpdateSector,
    deleteSector,
    addOrUpdateObject,
    deleteObject,
    toggleChecklistItem,
    addChecklistItem,
    checklistModels,
    addChecklistModel,
    deleteChecklistModel,
    migrateOrphanedItems,
    updateActionPlanStatus
  } = useHSModule();

  const activeActionPlansCount = actionPlans.filter(p => p.status === 'OPEN' || p.status === 'IN_PROGRESS').length;

  if (sharedInspectionParam && !pendingChecklistQr) {
    return (
      <InspectionCertificateView
        inspectionParam={sharedInspectionParam}
        objects={objects}
        inspections={inspections}
        checklistItems={checklistItems}
        onClose={() => {
          window.history.pushState({}, '', window.location.pathname);
          setSharedInspectionParam(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Header del Módulo H&S */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black uppercase tracking-wider text-text-main">
                Higiene y Seguridad: Inspecciones Programadas
              </h2>


            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Control periódico y gestión de hallazgos críticos.
            </p>
          </div>
        </div>

        {/* Botones de Navegación Principal por Pestañas */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-bg border border-border self-start md:self-auto">
          <button
            onClick={() => setActiveMainTab('SCANNER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeMainTab === 'SCANNER'
              ? 'bg-primary text-white shadow-md'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
          >
            <ClipboardList size={16} />
            <span>Resumen Inspecciones</span>
          </button>

          <button
            onClick={() => setActiveMainTab('ACTION_PLANS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${activeMainTab === 'ACTION_PLANS'
              ? 'bg-primary text-white shadow-md'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
          >
            <ClipboardList size={16} />
            <span>Planes de Acción</span>
            {activeActionPlansCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-rose-500 text-white">
                {activeActionPlansCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('ADMIN')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeMainTab === 'ADMIN'
              ? 'bg-primary text-white shadow-md'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
          >
            <Settings size={16} />
            <span>Administración</span>
          </button>
        </div>
      </div>

      {/* Renderizado de Vistas */}
      {activeMainTab === 'SCANNER' && (
        <HSScannerView
          pendingChecklistQr={pendingChecklistQr}
          onPendingChecklistHandled={() => {
            sessionStorage.removeItem('pending_checklist_qr');
            setPendingChecklistQr(null);
            setSharedInspectionParam(null);
          }}
          objects={objects}
          selectedObject={selectedObject}
          checklistModels={checklistModels}
          checklistItems={activeChecklistForSelectedObject}
          allChecklistItems={checklistItems}
          inspectionHistory={selectedObjectInspectionHistory}
          allInspections={inspections}
          currentUser={currentUser}
          onSelectQR={selectObjectByQR}
          onSubmitInspection={submitInspection}
          onClearSelection={() => setSelectedObjectId(null)}
          addToast={addToast}
          onViewCertificate={setSharedInspectionParam}
        />
      )}

      {activeMainTab === 'ACTION_PLANS' && (
        <HSActionPlansView
          actionPlans={actionPlans}
          inspections={inspections}
          objects={objects}
          objectTypes={objectTypes}
          onUpdateStatus={updateActionPlanStatus}
        />
      )}

      {activeMainTab === 'ADMIN' && (
        <HSAdminView
          objectTypes={objectTypes}
          sectors={sectors}
          objects={objects}
          checklistModels={checklistModels}
          checklistItems={checklistItems}
          onSaveObjectType={addOrUpdateObjectType}
          onDeleteObjectType={deleteObjectType}
          onSaveSector={addOrUpdateSector}
          onDeleteSector={deleteSector}
          onSaveObject={addOrUpdateObject}
          onDeleteObject={deleteObject}
          onAddChecklistModel={addChecklistModel}
          onToggleChecklistItem={toggleChecklistItem}
          onAddChecklistItem={addChecklistItem}
          onMigrateOrphanedItems={migrateOrphanedItems}
        />
      )}
    </div>
  );
}
