import React, { useState } from 'react';
import { QrCode, Scan, Search, Check, AlertCircle } from 'lucide-react';
import { HSObject } from '../types';

interface QRScannerSimulatorProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  onSelectQR: (qrCode: string) => boolean;
}

export function QRScannerSimulator({ objects, selectedObject, onSelectQR }: QRScannerSimulatorProps) {
  const [manualQR, setManualQR] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSimulatingCamera, setIsSimulatingCamera] = useState(false);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQR.trim()) return;
    setErrorMessage('');
    const success = onSelectQR(manualQR);
    if (!success) {
      setErrorMessage(`No se encontró ningún objeto con el QR "${manualQR}"`);
    } else {
      setManualQR('');
    }
  };

  const handleQuickSelect = (qrCode: string) => {
    setErrorMessage('');
    onSelectQR(qrCode);
  };

  return (
    <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary text-white">
            <QrCode size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Escáner de Código QR
            </h4>
            <p className="text-[11px] text-text-muted">
              Escanee o seleccione el QR del extintor o botiquín a inspeccionar
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSimulatingCamera(!isSimulatingCamera)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isSimulatingCamera
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          <Scan size={14} className={isSimulatingCamera ? 'animate-spin' : ''} />
          <span>{isSimulatingCamera ? 'Cerrar Cámara' : 'Simular Lector'}</span>
        </button>
      </div>

      {/* Visor de Cámara Simulado */}
      {isSimulatingCamera && (
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-primary bg-black/90 p-6 text-center text-white space-y-3 animate-fade-in">
          <div className="w-24 h-24 mx-auto border-2 border-primary rounded-xl flex items-center justify-center relative">
            <Scan size={40} className="text-primary animate-pulse" />
            <div className="absolute inset-0 border-t-2 border-primary animate-bounce opacity-70"></div>
          </div>
          <p className="text-xs font-bold">Apunte la cámara al código QR impreso en el objeto...</p>
          
          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
            <span className="text-[10px] uppercase font-bold text-text-muted w-full">O seleccione uno rápido:</span>
            {objects.slice(0, 4).map(obj => (
              <button
                key={obj.id}
                onClick={() => {
                  handleQuickSelect(obj.qrCode);
                  setIsSimulatingCamera(false);
                }}
                className="px-2 py-1 bg-white/10 hover:bg-primary hover:text-white rounded text-[10px] font-mono transition-colors"
              >
                {obj.qrCode} ({obj.typeName})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ingreso manual por input */}
      <form onSubmit={handleScanSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            value={manualQR}
            onChange={e => setManualQR(e.target.value)}
            placeholder="Ingrese código QR (Ej. QR-EXT-001)"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs font-mono uppercase focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Check size={14} /> Buscar QR
        </button>
      </form>

      {errorMessage && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
          <AlertCircle size={14} /> {errorMessage}
        </div>
      )}

      {/* Selector rápido de objetos */}
      <div className="pt-2 border-t border-border flex items-center gap-2 overflow-x-auto scrollbar-thin">
        <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">Acceso Rápido:</span>
        {objects.map(obj => {
          const isSelected = selectedObject?.id === obj.id;
          return (
            <button
              key={obj.id}
              onClick={() => handleQuickSelect(obj.qrCode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-bg text-text-muted hover:text-text-main border border-border'
              }`}
            >
              {obj.qrCode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
