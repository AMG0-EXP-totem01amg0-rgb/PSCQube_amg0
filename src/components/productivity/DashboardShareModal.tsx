import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, ClipboardCheck, Share2, FileText, 
  Check, AlertCircle, RefreshCw, Settings, Info,
  Package, Activity, Truck
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Shift, MasterData } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedShift: Shift | null;
  selectedDate: string;
  masters: MasterData;
  inventorySummary: {
    productive: any[];
    tarimas: any[];
    bigbags: any[];
    insumos: any[];
    others: any[];
  };
  palletizerData: any[];
  groupedLoadingPoints: Record<string, any[]>;
  laneStatuses: any[];
}

export default function DashboardShareModal({
  isOpen,
  onClose,
  selectedShift,
  selectedDate,
  masters,
  inventorySummary,
  palletizerData,
  groupedLoadingPoints,
  laneStatuses
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Parse date for display
  const displayDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Current generation time
  const currentDateTimeStr = useMemo(() => {
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, []);

  const shiftTimeLabel = useMemo(() => {
    if (!selectedShift) return '';
    return `(${selectedShift.startTime} a ${selectedShift.endTime})`;
  }, [selectedShift]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDownload = async () => {
    const node = pdfRef.current;
    if (!node) {
      showToast('Error: No se encontró el componente de reporte.', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      // Wait a tiny bit for render safety
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          opacity: '1',
          display: 'block'
        },
        pixelRatio: 2, // Crisp retina quality
        quality: 1.0,
      });

      const filename = `Resumen_Turno_${selectedShift?.name || 'Turno'}_${selectedDate}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('¡Imagen descargada exitosamente en formato PNG!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al exportar la imagen. Inténtelo nuevamente.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const node = pdfRef.current;
    if (!node) {
      showToast('Error: No se encontró el componente de reporte.', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          opacity: '1',
          display: 'block'
        },
        pixelRatio: 2,
        quality: 1.0
      });

      const blob = await fetch(dataUrl).then(res => res.blob());
      
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        showToast('¡Imagen copiada al portapapeles! Ya puedes pegarla en WhatsApp, Slack o Teams.', 'success');
      } else {
        throw new Error('Clipboard Item not supported');
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo copiar de forma directa. Por favor descarga la imagen usando el botón de descargar.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasAnyInventory = 
    inventorySummary.productive.length > 0 || 
    inventorySummary.bigbags.length > 0 ||
    inventorySummary.tarimas.length > 0 ||
    inventorySummary.insumos.length > 0 ||
    inventorySummary.others.length > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="share-dashboard-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-surface-elevated border border-border rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-bg/40">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Resumen de Turno en Imagen</h3>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Formato estructurado tipo PDF listo para compartir</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 px-1.5 rounded-full hover:bg-bg transition-colors text-text-muted hover:text-text-main border-none outline-none"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action toast inside modal */}
          {toast && (
            <div className={cn(
              "absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold z-50 shadow-lg border animate-bounce",
              toast.type === 'success' 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-red-500/10 border-red-500/30 text-red-400"
            )}>
              {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{toast.message}</span>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-bg flex flex-col md:flex-row gap-6">
            {/* Left Action & Status Column */}
            <div className="w-full md:w-1/4 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                  <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Info size={13} />
                    Exportación Optimizada
                  </h4>
                  <p className="text-[10px] text-text-muted leading-relaxed font-semibold">
                    Este reporte ha sido optimizado con un diseño corporativo limpio de alto contraste, ideal para ser impreso o pegado directamente en grupos de WhatsApp, Teams o Slack corporativos.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    disabled={isGenerating}
                    onClick={handleDownload}
                    className="w-full h-12 rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        GENERANDO REPORTE...
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        DESCARGAR PNG
                      </>
                    )}
                  </button>

                  <button
                    disabled={isGenerating}
                    onClick={handleCopyToClipboard}
                    className="w-full h-12 rounded-xl bg-surface hover:bg-surface-elevated text-text-main border border-border font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <ClipboardCheck size={14} className="text-primary" />
                    COPIAR IMAGEN
                  </button>
                </div>
              </div>

              <div className="p-4 bg-surface rounded-2xl border border-border space-y-2">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-widest">Información de captura</p>
                <div className="space-y-1 text-[10px] text-text-muted">
                  <p className="flex justify-between font-bold"><span>Fecha:</span> <span className="text-text-main font-mono">{displayDate}</span></p>
                  <p className="flex justify-between font-bold"><span>Shift:</span> <span className="text-text-main font-mono">{selectedShift?.name || '---'} {shiftTimeLabel}</span></p>
                  <p className="flex justify-between font-bold"><span>Generación:</span> <span className="text-text-main font-mono">{currentDateTimeStr}</span></p>
                </div>
              </div>
            </div>

            {/* Right Printable Preview Column (Scrollable & scaled) */}
            <div className="flex-1 bg-surface-elevated border border-border rounded-2xl overflow-auto p-4 flex justify-center items-start min-h-[350px] shadow-inner relative group">
              
              {/* Scaled Render Container (Maintains 800px standard with CSS zooming purely for UI previewing) */}
              <div className="origin-top scale-[0.6] sm:scale-[0.8] md:scale-[0.9] lg:scale-[0.75] xl:scale-[0.9] transition-transform duration-300 pointer-events-none md:pointer-events-auto h-0" style={{ minWidth: '800px', height: 'fit-content', paddingBottom: '1100px' }}>
                
                {/* 
                  THE ACTUAL PRINT/IMAGE LAYOUT (White background, black text high-fidelity PDF) 
                  We force standard styles here for gorgeous PDF-like look
                */}
                <div 
                  ref={pdfRef}
                  id="shift-report-pdf-target"
                  style={{ width: '800px', backgroundColor: '#ffffff', color: '#111827', padding: '36px' }}
                  className="rounded-lg shadow-xl text-left font-sans select-none overflow-hidden"
                >
                  {/* PDF Cover / Header */}
                  <div className="border-b-4 border-gray-905 pb-5 mb-6 flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-extrabold uppercase tracking-tight text-gray-900 leading-none">
                        RESUMEN DE TURNO: {selectedShift?.name || 'TURNO'}
                      </h1>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        REPORTE DE PRODUCTIVIDAD Y STOCKS
                      </p>
                      <div className="mt-3 flex gap-4 text-xs font-semibold text-gray-700">
                        <div>
                          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block">Fecha de Turno</span>
                          <span className="text-lg font-extrabold text-blue-900">{displayDate}</span>
                        </div>
                        <div className="border-l border-gray-300 pl-4">
                          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block">Horario de Operación</span>
                          <span className="text-sm font-extrabold text-gray-900">{shiftTimeLabel || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-[22px] font-black tracking-tighter text-blue-950 leading-none">PSCQube</div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mt-1">Holcim Group S.A.</span>
                      <div className="mt-4 text-[10px] text-gray-500 font-bold tracking-tight">
                        <p>Impreso: {currentDateTimeStr}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Stock e Insumos */}
                  {hasAnyInventory && (
                    <div className="mb-8">
                      <h2 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em] border-b border-gray-300 pb-1 mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-3.5 bg-blue-600 rounded-sm"></span>
                        I. RESUMEN DE INVENTARIOS & STOCK CONTADO
                      </h2>

                      {/* Productive & BigBags Summary Grid */}
                      {(inventorySummary.productive.length > 0 || inventorySummary.bigbags.length > 0) && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {[...inventorySummary.productive, ...inventorySummary.bigbags].map((item, idx) => {
                            const unit = item.isUnitary ? 'U' : 'TN';
                            const decimals = item.isUnitary ? 0 : 1;
                            return (
                              <div key={idx} className="border border-gray-200 bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                  <span className="text-[10px] font-extrabold text-gray-800 uppercase block truncate max-w-[200px]">{item.name}</span>
                                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mt-0.5">
                                    {item.isBigBag ? 'Contenedor Big Bag' : 'Silo Productivo'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-gray-500 block text-[9px] uppercase tracking-wider">Total Disponible</span>
                                  <span className="font-mono text-base font-black text-blue-900">{item.total.toFixed(decimals)} {unit}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Side-by-side secondary tables */}
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Detalle de Tarimas (Pallets)', data: inventorySummary.tarimas },
                          { label: 'Detalle de Insumos', data: inventorySummary.insumos },
                          { label: 'No Productivos y Otros', data: inventorySummary.others }
                        ].filter(g => g.data.length > 0).slice(0, 2).map((group, groupIdx) => {
                          const hasProd = group.data.some((it: any) => it.isProductive);
                          return (
                            <div key={groupIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200 flex justify-between items-center">
                                <span className="text-[9px] font-extrabold text-gray-800 uppercase tracking-wider">{group.label}</span>
                                <span className="text-[8px] font-bold text-gray-500 font-mono">{group.data.length} ítems</span>
                              </div>
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-gray-50 text-[9px] font-bold text-gray-400 uppercase border-b border-gray-200">
                                  <tr>
                                    <th className="px-3 py-1.5">Material</th>
                                    {hasProd && <th className="px-2 py-1.5 text-right">S.Inicial</th>}
                                    <th className="px-3 py-1.5 text-right">Total Disp.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150">
                                  {group.data.map((item: any, idx: number) => {
                                    const unit = item.isUnitary ? 'U' : 'TN';
                                    const decimals = item.isUnitary ? 0 : 1;
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-1.5 font-bold text-gray-700 uppercase truncate max-w-[130px]">{item.name}</td>
                                        {hasProd && (
                                          <td className="px-2 py-1.5 text-right font-mono text-gray-500">
                                            {item.isProductive ? item.stock.toFixed(decimals) : '-'}
                                          </td>
                                        )}
                                        <td className="px-3 py-1.5 text-right font-mono font-extrabold text-blue-900">
                                          {item.total.toFixed(decimals)} {unit}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Productividad */}
                  <div className="mb-8">
                    <h2 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em] border-b border-gray-300 pb-1 mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-3.5 bg-blue-600 rounded-sm"></span>
                      II. RENDIMIENTO EN LÍNEAS DE PRODUCCIÓN
                    </h2>

                    <div className="space-y-4">
                      {palletizerData.map(({ palletizer, topStops, tonsByMaterial, runHours, activeNozzles, totalTons }, idx) => (
                        <div key={idx} className="border border-gray-300 rounded-lg p-4">
                          <div className="flex justify-between items-baseline border-b border-gray-150 pb-2 mb-3">
                            <span className="text-xs font-extrabold text-blue-950 uppercase">{palletizer.name}</span>
                            <div className="text-right flex items-center gap-2">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Horas en Marcha:</span>
                              <span className="text-sm font-black text-blue-800 font-mono">{runHours} hs</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            {/* Producción */}
                            <div className="col-span-1 border-r border-gray-200 pr-3">
                              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">Volumen Producido</span>
                              {Object.entries(tonsByMaterial).length > 0 ? (
                                <div className="space-y-1.5">
                                  {Object.entries(tonsByMaterial).map(([mId, tons]) => {
                                    const t = tons as number;
                                    const mName = masters.materials.find((m: any) => m.id === mId)?.name || 'Material';
                                    return (
                                      <div key={mId} className="flex justify-between items-baseline text-[9px] font-bold text-gray-800 uppercase">
                                        <span className="truncate max-w-[100px]">{mName}</span>
                                        <span className="font-mono text-gray-900">{t.toFixed(1)} TN</span>
                                      </div>
                                    );
                                  })}
                                  <div className="pt-1.5 border-t border-dashed border-gray-200 flex justify-between font-extrabold text-[10px] text-blue-900">
                                    <span>TOTAL</span>
                                    <span className="font-mono">{totalTons.toFixed(1)} TN</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[9px] text-gray-400 italic mt-3">Sin producción registrada</p>
                              )}
                            </div>

                            {/* Boquillas */}
                            <div className="col-span-1 border-r border-gray-200 pr-3">
                              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">Boquillas Activas / Envasadora</span>
                              {activeNozzles.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1">
                                  {activeNozzles.map((nozzle, nidx) => (
                                    <div key={nidx} className="bg-gray-50 border border-gray-200 px-2 py-1 rounded flex justify-between items-center text-[9px]">
                                      <span className="font-bold text-gray-700 uppercase truncate max-w-[70px]">{nozzle.baggerName}</span>
                                      <span className="font-mono font-extrabold text-amber-600">#{nozzle.nozzles}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[9px] text-gray-400 italic">No hay boquillas reportadas</p>
                              )}
                            </div>

                            {/* Incidentes */}
                            <div className="col-span-1">
                              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">Paros / Alarmas de Operación</span>
                              {topStops.length > 0 ? (
                                <div className="space-y-1">
                                  {topStops.slice(0, 3).map((stop, sidx) => {
                                    const causeText = stop.causeText || masters.causes.find((c: any) => c.id === stop.causeId)?.text || 'Error registrado';
                                    return (
                                      <div key={sidx} className="flex justify-between items-start text-[9px] font-semibold text-gray-800 leading-tight">
                                        <div className="truncate max-w-[85px]">
                                          <p className="truncate block font-bold text-gray-900 uppercase">{causeText}</p>
                                          <span className="text-[7px] text-transparent tracking-tighter block font-mono bg-clip-text bg-gradient-to-r from-red-600 to-gray-500 uppercase">HAC: {stop.hacName || 'Genérico'}</span>
                                        </div>
                                        <span className="font-mono text-red-600 font-bold shrink-0">{stop.durationMinutes}m</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[9px] text-gray-400 italic">Operación limpia. Sin paros registrados.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Calles de Carga */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em] border-b border-gray-300 pb-1 mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-3.5 bg-blue-600 rounded-sm"></span>
                      III. DISPONIBILIDAD EN CALLES DE CARGA & DESPACHO
                    </h2>

                    <div className="border border-gray-250 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-gray-100 text-[9px] font-bold text-gray-500 uppercase border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2">Identificador</th>
                            <th className="px-4 py-2">Estado</th>
                            <th className="px-4 py-2">Tipo de Logística / Restricciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150">
                          {Object.entries(groupedLoadingPoints).flatMap(([type, points]: [string, any[]]) => 
                            points.map(lp => {
                              const status = laneStatuses.find((s: any) => s.loadingPointId === lp.id);
                              const isEnabled = status ? status.isEnabled : true;
                              return (
                                <tr key={lp.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-bold text-gray-900 border-r border-gray-100 max-w-[180px] truncate uppercase flex items-center gap-2">
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full inline-block",
                                      type === 'BOLSA' ? "bg-blue-500" : "bg-amber-500"
                                    )}></span>
                                    {lp.name}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider block text-center w-24",
                                      isEnabled ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-red-100 text-red-800 border border-red-200"
                                    )}>
                                      {isEnabled ? 'OPERATIVA' : 'FUERA SERV.'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 uppercase font-semibold">
                                    {isEnabled ? (
                                      status && status.materialIds.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {status.materialIds.map((mid: string) => (
                                            <span key={mid} className="px-1 bg-blue-50 text-blue-900 rounded border border-blue-100 text-[8px] font-extrabold uppercase">
                                              {masters.materials.find((m: any) => m.id === mid)?.name}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[8px] text-emerald-600 block">Disponible para carga y stock general</span>
                                      )
                                    ) : (
                                      <span className="text-[9px] text-red-600 font-bold block max-w-[320px] truncate leading-tight">
                                        RESTRICCIONES: {status?.observation || 'Avería mecánica interna'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Signature / Verification row */}
                  <div className="mt-8 pt-4 border-t border-gray-300 flex justify-between items-end text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                    <div className="text-right">
                      <p>DOCUMENTO DE REGISTRO INTERNO - HOLCIM (ARGENTINA) S.A.</p>
                      <p className="mt-0.5 font-mono text-[8px] text-gray-300">CRC-SHA256: 8D72F3EFA9201C</p>
                    </div>
                  </div>

                </div> {/* END OF ACTUAL PRINT/IMAGE LAYOUT */}

              </div> {/* END OF SCALED WRAPPER */}

            </div> {/* END OF PREVIEW WINDOW */}

          </div> {/* END OF BODY */}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
