import React, { useState } from 'react';
import { QrCode, Search, Check, AlertCircle, Camera } from 'lucide-react';
import { HSObject } from '../types';

interface QRScannerSimulatorProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  onSelectQR: (qrCode: string) => boolean;
}

export function QRScannerSimulator({ objects, selectedObject, onSelectQR }: QRScannerSimulatorProps) {
  const [manualQR, setManualQR] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const processQR = (code: string) => {
    if (!code.trim()) return;
    setErrorMessage('');
    const cleanCode = code.trim().toUpperCase();
    const success = onSelectQR(cleanCode);
    if (!success) {
      setErrorMessage(`No se encontró ningún equipo registrado con el QR "${cleanCode}"`);
    } else {
      setManualQR('');
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processQR(manualQR);
  };

  const handleQuickSelect = (qrCode: string) => {
    setErrorMessage('');
    onSelectQR(qrCode);
  };

  // Función para capturar imagen/QR desde la cámara nativa del celular
  const handleNativeCameraScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Si el usuario sube/saca foto con la cámara, usamos el nombre o procesamos
      // Nota: En móviles, al activar capture="environment", abre directamente la cámara nativa
      const file = e.target.files[0];
      if (file) {
        // Alerta de guía rápida para el inspector
        alert("Foto capturada. Ingrese el código leído para confirmar.");
      }
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-4">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary text-white shadow-xs">
            <QrCode size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Escanear o Identificar Equipo
            </h4>
            <p className="text-[11px] text-text-muted">
              Escanee con la cámara de su celular o ingrese el código QR
            </p>
          </div>
        </div>
      </div>

      {/* Cuadro Principal de Captura */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">

        {/* Formulario de Entrada Texto / Lector */}
        <form onSubmit={handleScanSubmit} className="sm:col-span-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              value={manualQR}
              onChange={e => setManualQR(e.target.value)}
              placeholder="Escriba o pegue el QR (Ej: QR-EXT-001)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-bg text-text-main text-xs font-mono uppercase focus:ring-2 focus:ring-primary outline-hidden"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Check size={15} /> Cargar
          </button>
        </form>

        {/* Botón de Cámara Nativa del Celular */}
        <label className="sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
          <Camera size={16} />
          <span>Escanear QR</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleNativeCameraScan}
            className="hidden"
          />
        </label>

      </div>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2 font-medium">
          <AlertCircle size={15} /> {errorMessage}
        </div>
      )}

      {/* Selector Rápido de Objetos Registrados */}
      <div className="pt-2 border-t border-border space-y-1.5">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
          Acceso rápido a lista de activos:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {objects.map(obj => {
            const isSelected = selectedObject?.id === obj.id;
            return (
              <button
                key={obj.id}
                type="button"
                onClick={() => handleQuickSelect(obj.qrCode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${isSelected
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-bg text-text-muted hover:text-text-main border border-border'
                  }`}
              >
                {obj.qrCode} ({obj.typeName})
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
