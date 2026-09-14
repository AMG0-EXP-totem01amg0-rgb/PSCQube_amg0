import React from 'react';
import { useHSModule } from './useHSModule';
import { InspectionCertificateView } from './scanner/InspectionCertificateView';

interface PublicQRScannerWrapperProps {
  inspectionId: string;
  onLoginRequest: () => void;
}

export function PublicQRScannerWrapper({ inspectionId, onLoginRequest }: PublicQRScannerWrapperProps) {
  // Inicializamos el módulo de H&S para que cargue los maestros de Google Sheets necesarios
  const {
    objects,
    inspections,
    checklistItems,
  } = useHSModule();

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden flex flex-col items-center">
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
      </div>
      
      <div className="relative z-10 w-full max-w-4xl min-h-screen flex flex-col py-10 px-4">
        {/* Cabecera sencilla */}
        <div className="w-full mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-text-main logo-glow">
              PSCQUBE
            </h1>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/20 uppercase tracking-widest">
              Acceso Público
            </span>
          </div>
        </div>

        {/* Vista del Certificado de la Inspección */}
        <InspectionCertificateView
          inspectionParam={inspectionId}
          objects={objects}
          inspections={inspections}
          checklistItems={checklistItems}
          onClose={() => {
            // El usuario público puede simplemente ser redirigido a la pantalla principal o login general
            window.location.href = window.location.pathname;
          }}
          onNewInspectionRequest={onLoginRequest}
        />
      </div>
    </div>
  );
}
