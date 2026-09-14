import React, { useState } from 'react';
import { useHSModule } from './useHSModule';
import { InspectionCertificateView } from './scanner/InspectionCertificateView';
import WelcomeScreen from '../auth/WelcomeScreen';
import { HSScannerView } from './scanner/HSScannerView';

interface PublicQRScannerWrapperProps {
  inspectionId: string;
  addToast: (msg: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

type PublicFlowStep = 'SUMMARY' | 'LOGIN' | 'CHECKLIST';

export function PublicQRScannerWrapper({ inspectionId, addToast }: PublicQRScannerWrapperProps) {
  const [step, setStep] = useState<PublicFlowStep>('SUMMARY');
  
  // Inicializamos el módulo de H&S para que cargue los maestros de Google Sheets necesarios
  const {
    objects,
    inspections,
    checklistItems,
    selectedObject,
    selectObjectByQR,
    submitInspection
  } = useHSModule();

  const handleNewInspectionClick = () => {
    // Si ya está logueado en esta sesión, ir directo al checklist. Si no, ir al login.
    if (sessionStorage.getItem('pscqube_user_dni')) {
      // Guardar la intención para que el scanner abra el checklist automáticamente
      sessionStorage.setItem('pending_checklist_qr', inspectionId);
      setStep('CHECKLIST');
    } else {
      setStep('LOGIN');
    }
  };

  return (
    <div className="min-h-screen bg-bg relative overflow-x-hidden flex flex-col items-center">
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
      </div>
      
      <div className="relative z-10 w-full max-w-4xl min-h-screen flex flex-col py-10 px-4">
        {/* Cabecera sencilla */}
        <div className="w-full mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-text-main logo-glow">
              PSCQUBE
            </h1>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/20 uppercase tracking-widest">
              Acceso Público
            </span>
          </div>
          {step !== 'SUMMARY' && (
             <button 
                onClick={() => {
                   sessionStorage.removeItem('pending_checklist_qr');
                   setStep('SUMMARY');
                }}
                className="text-sm font-semibold text-primary hover:text-primary-light"
             >
                Volver al Resumen
             </button>
          )}
        </div>

        {/* CONTENEDOR DE ESTADOS */}
        {step === 'SUMMARY' && (
          <InspectionCertificateView
            inspectionParam={inspectionId}
            objects={objects}
            inspections={inspections}
            checklistItems={checklistItems}
            onClose={() => {
              window.location.href = window.location.pathname;
            }}
            onNewInspectionRequest={handleNewInspectionClick}
          />
        )}

        {step === 'LOGIN' && (
           <div className="w-full h-full flex flex-col items-center justify-center">
             <div className="w-full max-w-md p-6 bg-surface/50 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
               <h2 className="text-xl font-bold text-center text-text-main mb-6">Autenticación Requerida</h2>
               <p className="text-sm text-text-muted text-center mb-6">
                 Para realizar una nueva inspección, necesitas validar tus permisos.
               </p>
               <WelcomeScreen
                 onEnter={() => {
                    sessionStorage.setItem('pending_checklist_qr', inspectionId);
                    setStep('CHECKLIST');
                 }}
                 onLoginSuccess={(user, email) => {
                    sessionStorage.setItem('pscqube_user_dni', user.dni);
                    sessionStorage.setItem('pscqube_user', JSON.stringify(user));
                    sessionStorage.setItem('pscqube_google_email', email);
                    sessionStorage.setItem('pending_checklist_qr', inspectionId);
                    setStep('CHECKLIST');
                 }}
                 addToast={addToast}
               />
             </div>
           </div>
        )}

        {step === 'CHECKLIST' && (
           <div className="w-full flex-1 bg-surface/30 backdrop-blur-md rounded-2xl border border-white/10 p-2 md:p-6 shadow-2xl relative overflow-hidden">
             <HSScannerView
               objects={objects}
               selectedObject={selectedObject}
               inspections={inspections}
               checklistItems={checklistItems}
               onSelectQR={selectObjectByQR}
               onSubmitInspection={async (data) => {
                 await submitInspection(data);
                 addToast("Inspección registrada con éxito.", "success");
                 setStep('SUMMARY');
               }}
               onClearSelection={() => setStep('SUMMARY')}
               pendingChecklistQr={sessionStorage.getItem('pending_checklist_qr')}
               addToast={addToast}
               onPendingChecklistHandled={() => {
                  sessionStorage.removeItem('pending_checklist_qr');
               }}
               isStandaloneChecklist={true}
             />
           </div>
        )}
      </div>
    </div>
  );
}
