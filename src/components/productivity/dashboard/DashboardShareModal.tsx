import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, ClipboardCheck, Share2, FileText, 
  Check, AlertCircle, RefreshCw, Settings, Info,
  Package, Activity, Truck
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Shift, MasterData } from '../../../types';
import { cn } from '../../../lib/utils';

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
      await new Promise(resolve => setTimeout(resolve, 300));

      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        style: { transform: 'scale(1)', opacity: '1', display: 'block' },
        pixelRatio: 2,
        quality: 1.0,
      });

      const filename = `Resumen_Turno_${selectedShift?.name || 'Turno'}_${selectedDate}.png`;

      // iOS Safari compatible download
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isIOS) {
        // iOS: abrir imagen en nueva pestaña para que el usuario la guarde manualmente
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(`
            <html>
              <head><title>${filename}</title></head>
              <body style="margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;">
                <p style="color:#fff;font-family:sans-serif;font-size:12px;margin-bottom:12px;text-align:center;">
                  Mantené presionada la imagen y seleccioná "Guardar imagen"
                </p>
                <img src="${dataUrl}" style="max-width:100%;height:auto;" />
              </body>
            </html>
          `);
          newTab.document.close();
          showToast('Se abrió la imagen en una nueva pestaña. Mantené presionada para guardarla.', 'success');
        } else {
          showToast('Habilitá las ventanas emergentes para descargar la imagen.', 'error');
        }
      } else {
        // Android y Desktop: descarga directa
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('¡Imagen descargada exitosamente!', 'success');
      }
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
        style: { transform: 'scale(1)', opacity: '1', display: 'block' },
        pixelRatio: 2,
        quality: 1.0,
      });

      const blob = await fetch(dataUrl).then(res => res.blob());
      const filename = `Resumen_Turno_${selectedShift?.name || 'Turno'}_${selectedDate}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // Intentar Web Share API primero (más confiable en mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Resumen de Turno - ${selectedShift?.name || 'Turno'}`,
          text: `Resumen operativo del turno ${selectedShift?.name || ''} - ${displayDate}`,
          files: [file],
        });
        showToast('¡Reporte compartido exitosamente!', 'success');
      } else if (navigator.clipboard && window.ClipboardItem) {
        // Fallback: clipboard API en desktop
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        showToast('¡Imagen copiada al portapapeles! Podés pegarla en WhatsApp, Slack o Teams.', 'success');
      } else {
        // Último fallback: descargar directamente
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Se descargó la imagen. Compartila desde tu galería.', 'success');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Usuario canceló el share nativo — no es un error
        showToast('Compartir cancelado.', 'error');
      } else {
        console.error(err);
        showToast('No se pudo compartir. Usá el botón de descargar.', 'error');
      }
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

  const renderReportContent = (isOffscreen: boolean) => {
    // Merge insumos and others for the No Productivos y Otros side table
    const sideBySideLeft = inventorySummary.tarimas || [];
    const sideBySideRight = [...(inventorySummary.insumos || []), ...(inventorySummary.others || [])];

    return (
      <div 
        className={cn(
          "bg-white text-gray-800 font-sans select-none text-left",
          isOffscreen ? "w-[800px] p-9 rounded-none" : "w-full p-2 sm:p-4 rounded-xl"
        )}
      >
        {/* Cabecera / Header */}
        <div className="border-b-4 border-[#002f6c] pb-2 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#002f6c] leading-none">
                RESUMEN DE TURNO: {selectedShift?.name || 'TURNO'}
              </h1>
              <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                REPORTE DE PRODUCTIVIDAD Y STOCKS
              </p>
              
              <div className="mt-3 flex gap-4 text-[11px] sm:text-xs font-bold text-gray-700">
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[8px] sm:text-[9px] block leading-tight">Fecha de Turno</span>
                  <span className="text-sm sm:text-base font-black text-blue-900">{displayDate}</span>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[8px] sm:text-[9px] block leading-tight">Horario de Operación</span>
                  <span className="text-xs sm:text-sm font-black text-gray-800">{shiftTimeLabel || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono text-xl sm:text-2xl font-black tracking-tighter text-[#002f6c] leading-none">PSCQube</div>
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mt-0.5">Holcim Argentina S.A.</span>
              <div className="mt-3 text-[9px] text-gray-400 font-bold tracking-tight">
                <p>Impreso: {currentDateTimeStr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Inventarios */}
        {hasAnyInventory && (
          <div className="mb-5">
            <h2 className="text-[10px] sm:text-[11px] font-bold text-[#002f6c] uppercase tracking-[0.15em] pb-1 mb-2.5 flex items-center gap-1.5 border-b border-gray-200">
              <span className="w-1.5 h-3 bg-[#002f6c] rounded-sm inline-block"></span>
              I. RESUMEN DE INVENTARIOS & STOCK CONTADO
            </h2>

            {/* Main Table: Productive & BigBags */}
            {inventorySummary.productive.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] sm:text-[10px] font-black text-[#002f6c] uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>Materiales Productivos (Granel / Bolsa)</span>
                  <span className="text-[8px] text-gray-400 font-mono font-bold uppercase">{inventorySummary.productive.length} ÍTEMS</span>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[11px] sm:text-xs">
                    <tbody className="divide-y divide-gray-150">
                      <tr className="bg-[#002f6c] text-white text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
                        <th className="px-3 py-2">Material</th>
                        <th className="px-3 py-2 text-center">Stock Contado</th>
                        <th className="px-3 py-2 text-center">Prod. Turno (+)</th>
                        <th className="px-3 py-2 text-center">Despacho (-)</th>
                        <th className="px-3 py-2 text-center">Total Disp.</th>
                      </tr>
                      {inventorySummary.productive.map((item, idx) => {
                        const unit = item.isUnitary ? 'U' : 'TN';
                        return (
                          <tr key={idx} className={cn("hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                            <td className="px-3 py-1.5 font-bold text-gray-900 uppercase">
                              {item.name}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-semibold text-gray-700">
                              {Math.round(item.stock).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-bold text-emerald-600">
                              +{Math.round(item.production || 0).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-bold text-red-600">
                              -{Math.round(item.dispatch || 0).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-black text-blue-900 bg-blue-50/20">
                              {Math.round(item.total).toFixed(0)} {unit}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Fila de Totales Productivos */}
                      <tr className="bg-gray-100/90 font-bold border-t-2 border-gray-300">
                        <td className="px-3 py-1.5 font-black text-gray-900 uppercase text-[9px] sm:text-[10px]">TOTAL PRODUCTIVOS</td>
                        <td className="px-3 py-1.5 text-center font-mono font-black text-gray-900">
                          {Math.round(inventorySummary.productive.reduce((sum, item) => sum + (Number(item.stock) || 0), 0)).toFixed(0)} TN
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono font-black text-emerald-700">
                          +{Math.round(inventorySummary.productive.reduce((sum, item) => sum + (Number(item.production) || 0), 0)).toFixed(0)} TN
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono font-black text-red-700">
                          -{Math.round(inventorySummary.productive.reduce((sum, item) => sum + (Number(item.dispatch) || 0), 0)).toFixed(0)} TN
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono font-black text-blue-950 bg-blue-100/30">
                          {Math.round(inventorySummary.productive.reduce((sum, item) => sum + (Number(item.total) || 0), 0)).toFixed(0)} TN
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {inventorySummary.bigbags.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] sm:text-[10px] font-black text-[#002f6c] uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>Materiales en Big Bag</span>
                  <span className="text-[8px] text-gray-400 font-mono font-bold uppercase">{inventorySummary.bigbags.length} ÍTEMS</span>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[11px] sm:text-xs">
                    <tbody className="divide-y divide-gray-150">
                      <tr className="bg-[#002f6c] text-white text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
                        <th className="px-3 py-2">Material</th>
                        <th className="px-3 py-2 text-center">Stock Contado</th>
                        <th className="px-3 py-2 text-center">Prod. Turno (+)</th>
                        <th className="px-3 py-2 text-center">Despacho (-)</th>
                        <th className="px-3 py-2 text-center">Total Disp.</th>
                      </tr>
                      {inventorySummary.bigbags.map((item, idx) => {
                        const unit = item.isUnitary ? 'U' : 'TN';
                        return (
                          <tr key={idx} className={cn("hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                            <td className="px-3 py-1.5 font-bold text-gray-900 uppercase">
                              {item.name}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-semibold text-gray-700">
                              {Math.round(item.stock).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-bold text-emerald-600">
                              +{Math.round(item.production || 0).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-bold text-red-600">
                              -{Math.round(item.dispatch || 0).toFixed(0)} {unit}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-black text-blue-900 bg-blue-50/20">
                              {Math.round(item.total).toFixed(0)} {unit}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Fila de Totales Big Bag */}
                      <tr className="bg-gray-100/90 font-bold border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-black text-gray-900 uppercase text-[9px] sm:text-[10px]">TOTAL BIG BAGS</td>
                        <td className="px-3 py-2 text-center font-mono font-black text-gray-900">
                          {Math.round(inventorySummary.bigbags.reduce((sum, item) => sum + (Number(item.stock) || 0), 0)).toFixed(0)} U
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-black text-emerald-700">
                          +{Math.round(inventorySummary.bigbags.reduce((sum, item) => sum + (Number(item.production) || 0), 0)).toFixed(0)} U
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-black text-red-700">
                          -{Math.round(inventorySummary.bigbags.reduce((sum, item) => sum + (Number(item.dispatch) || 0), 0)).toFixed(0)} U
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-black text-blue-950 bg-blue-100/30">
                          {Math.round(inventorySummary.bigbags.reduce((sum, item) => sum + (Number(item.total) || 0), 0)).toFixed(0)} U
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Side-by-side Tables: Tarimas and No Productivos */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Table: Tarimas */}
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white flex flex-col justify-between">
                <div>
                  <div className="bg-gray-100/80 px-3 py-1.5 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-700 uppercase tracking-wider">Detalle de Tarimas (Pallets)</span>
                    <span className="text-[8px] font-bold text-gray-400 font-mono uppercase">{sideBySideLeft.length} ítems</span>
                  </div>
                  <table className="w-full text-left text-[10px] sm:text-[11px]">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50 text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase border-b border-gray-200">
                        <th className="px-3 py-1.5">Material</th>
                        <th className="px-3 py-1.5 text-right">Total Disp.</th>
                      </tr>
                      {sideBySideLeft.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-3 py-1.5 font-semibold text-gray-700 uppercase truncate max-w-[150px]">{item.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-blue-900">{Math.round(item.total).toFixed(0)} U</td>
                        </tr>
                      ))}
                      {sideBySideLeft.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-center text-gray-400 italic">No hay tarimas reportadas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Table: No Productivos y Otros */}
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white flex flex-col justify-between">
                <div>
                  <div className="bg-gray-100/80 px-3 py-1.5 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-700 uppercase tracking-wider">No Productivos y Insumos</span>
                    <span className="text-[8px] font-bold text-gray-400 font-mono uppercase">{sideBySideRight.length} ítems</span>
                  </div>
                  <table className="w-full text-left text-[10px] sm:text-[11px]">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50 text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase border-b border-gray-200">
                        <th className="px-3 py-1.5">Material</th>
                        <th className="px-3 py-1.5 text-right">Total Disp.</th>
                      </tr>
                      {sideBySideRight.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-3 py-1.5 font-semibold text-gray-700 uppercase truncate max-w-[150px]">{item.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-blue-900">{Math.round(item.total).toFixed(0)} {item.isUnitary ? 'U' : 'TN'}</td>
                        </tr>
                      ))}
                      {sideBySideRight.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-center text-gray-400 italic">No hay insumos reportados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Rendimiento en Líneas de Producción */}
        <div className="mb-5">
          <h2 className="text-[10px] sm:text-[11px] font-bold text-[#002f6c] uppercase tracking-[0.15em] pb-1 mb-2.5 flex items-center gap-1.5 border-b border-gray-200">
            <span className="w-1.5 h-3 bg-[#002f6c] rounded-sm inline-block"></span>
            II. RENDIMIENTO EN LÍNEAS DE PRODUCCIÓN
          </h2>

          {/* Line Performance Summary Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 shadow-sm">
            <table className="w-full text-left text-[11px] sm:text-xs">
              <tbody className="divide-y divide-gray-150">
                <tr className="bg-[#002f6c] text-white text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="px-3 py-2">Paletizadora</th>
                  <th className="px-3 py-2 text-center">Marcha</th>
                  <th className="px-3 py-2 text-center">OEE</th>
                  <th className="px-3 py-2 text-center">Disponibilidad</th>
                  <th className="px-3 py-2 text-center">Rendimiento</th>
                </tr>
                {palletizerData.map(({ palletizer, runHours, oee, availability, performance }, idx) => (
                  <tr key={idx} className={cn("hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                    <td className="px-3 py-1.5 font-bold text-gray-900 uppercase">
                      {palletizer.name}
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono font-bold text-gray-800">
                      {runHours} hs
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono font-bold text-emerald-700">
                      {Math.round(oee || 0).toFixed(0)}%
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono font-bold text-indigo-700">
                      {Math.round(availability || 0).toFixed(0)}%
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono font-bold text-rose-700">
                      {Math.round(performance || 0).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Individual Detailed Blocks by Palletizer */}
          <div className="space-y-3.5">
            {palletizerData.map(({ palletizer, topStops, tonsByMaterial, activeNozzles, totalTons }, idx) => (
              <div key={idx} className="border-t border-gray-200 pt-3 first:border-none first:pt-0">
                <h3 className="text-[10px] sm:text-[11px] font-black text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-900"></span>
                  {palletizer.name}
                </h3>

                <div className="grid grid-cols-3 gap-4 text-[10px] sm:text-[11px]">
                  {/* Columna 1: Producción */}
                  <div className="border-r border-gray-100 pr-3">
                    <span className="text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">Producción</span>
                    {Object.entries(tonsByMaterial).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(tonsByMaterial).map(([mId, tons]) => {
                          const t = tons as number;
                          const mName = masters.materials.find((m: any) => m.id === mId)?.name || 'Material';
                          return (
                            <div key={mId} className="flex justify-between items-baseline font-semibold text-gray-700 uppercase">
                              <span className="truncate max-w-[100px]">{mName}</span>
                              <span className="font-mono text-gray-900">{Math.round(t).toFixed(0)} TN</span>
                            </div>
                          );
                        })}
                        <div className="pt-1 mt-1 border-t border-dashed border-gray-200 flex justify-between font-extrabold text-[10px] text-blue-900">
                          <span>TOTAL</span>
                          <span className="font-mono">{Math.round(totalTons).toFixed(0)} TN</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[9px] text-gray-400 italic font-medium">Sin producción registrada</p>
                    )}
                  </div>

                  {/* Columna 2: Boquillas Activas / Envasadora */}
                  <div className="border-r border-gray-100 pr-3">
                    <span className="text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">Boquillas Activas / Envasadora</span>
                    {activeNozzles.length > 0 ? (
                      <div className="space-y-1">
                        {activeNozzles.map((nozzle, nidx) => (
                          <div key={nidx} className="flex justify-between items-center py-0.5 border-b border-gray-50/50 last:border-none">
                            <span className="font-semibold text-gray-700 uppercase truncate mr-2">{nozzle.baggerName}</span>
                            <span className="font-mono font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[9px]">{nozzle.nozzles} bq.</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-gray-400 italic font-medium">No hay boquillas reportadas</p>
                    )}
                  </div>

                  {/* Columna 3: Paros / Alarmas de Operación */}
                  <div>
                    <span className="text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">Paros / Alarmas de Operación</span>
                    {topStops.length > 0 ? (
                      <div className="space-y-1.5">
                        {topStops.slice(0, 4).map((stop, sidx) => {
                          const causeText = stop.causeText || masters.causes.find((c: any) => c.id === stop.causeId)?.text || 'Error registrado';
                          return (
                            <div key={sidx} className="flex justify-between items-start leading-tight border-b border-gray-50 pb-1 last:border-none last:pb-0">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-bold text-red-700 uppercase leading-snug break-words text-[9px]">
                                  {causeText}
                                </p>
                                <span className="text-[7px] text-gray-400 font-mono block mt-0.5 font-semibold">
                                  HAC: {stop.hacName || 'Genérico'}
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="font-mono text-red-700 font-black bg-red-50 border border-red-100 px-1 py-0.5 rounded text-[8px] block">
                                  {Math.round(stop.durationMinutes).toFixed(0)}m
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[9px] text-gray-400 italic font-medium">Operación limpia. Sin paros registrados.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Disponibilidad en Calles de Carga */}
        <div className="mb-4">
          <h2 className="text-[10px] sm:text-[11px] font-bold text-[#002f6c] uppercase tracking-[0.15em] pb-1 mb-2.5 flex items-center gap-1.5 border-b border-gray-200">
            <span className="w-1.5 h-3 bg-[#002f6c] rounded-sm inline-block"></span>
            III. DISPONIBILIDAD EN CALLES DE CARGA & DESPACHO
          </h2>

          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-[11px] sm:text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-100 text-[8px] sm:text-[9px] font-extrabold text-gray-500 uppercase border-b border-gray-200">
                  <th className="px-3 py-1.5">Identificador</th>
                  <th className="px-3 py-1.5">Estado</th>
                  <th className="px-3 py-1.5">Tipo de Logística / Restricciones</th>
                </tr>
                {Object.entries(groupedLoadingPoints).flatMap(([type, points]: [string, any[]]) => 
                  points.map(lp => {
                    const status = laneStatuses.find((s: any) => s.loadingPointId === lp.id);
                    const isEnabled = status ? status.isEnabled : true;
                    return (
                      <tr key={lp.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 font-bold text-gray-900 uppercase flex items-center gap-1.5">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                            type === 'BOLSA' ? "bg-blue-500" : "bg-amber-500"
                          )}></span>
                          {lp.name}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider inline-block text-center w-20 shrink-0",
                            isEnabled ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-red-100 text-red-800 border border-red-200"
                          )}>
                            {isEnabled ? 'OPERATIVA' : 'FUERA SERV.'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 uppercase font-semibold text-[9px] sm:text-[10px]">
                          {isEnabled ? (
                            status && status.materialIds && status.materialIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {status.materialIds.map((mid: string) => (
                                  <span key={mid} className="px-1 bg-blue-50 text-blue-900 rounded border border-blue-100 text-[8px] font-black uppercase">
                                    {masters.materials.find((m: any) => m.id === mid)?.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[8px] text-emerald-600 font-bold tracking-wider">Disponible para carga y stock general</span>
                            )
                          ) : (
                            <span className="text-[8.5px] text-red-600 font-extrabold tracking-wider block max-w-[320px] truncate">
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

        {/* Footer / Signature row */}
        <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-[8px] text-gray-400 font-bold uppercase tracking-wider">
          <div>
            <p>DOCUMENTO DE REGISTRO INTERNO - HOLCIM (ARGENTINA) S.A.</p>
          </div>
          <div className="text-right font-mono text-[7.5px] text-gray-300">
            <p>CIC: {currentDateTimeStr.replace(/[^0-9]/g, '')}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="share-dashboard-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop - Avoid backdrop-blur on mobile to bypass mobile rendering artifacts during scroll */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 sm:backdrop-blur-sm"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-surface-elevated border border-border rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] z-10 overflow-hidden"
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-bg flex flex-col md:flex-row gap-6">
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
                    <Share2 size={14} className="text-primary" />
                    {typeof navigator !== 'undefined' && navigator.share ? 'COMPARTIR' : 'COPIAR IMAGEN'}
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

            {/* Right Screen-adapted Live Preview - Clean fluid flow no scale-hacks */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-y-auto p-4 sm:p-6 max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh] shadow-inner">
               <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                 <span className="text-[10.5px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                   <Activity size={13} className="text-primary" />
                   Vista Previa del Reporte
                 </span>
               </div>

               <div className="inline-block w-full max-w-[720px] shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                  {renderReportContent(false)}
               </div>
            </div>

          </div> {/* END OF BODY */}

        </motion.div>
      </div>

      {/* 
        ========================================================================
        OFFSCREEN RENDERING CONTAINER - FOR HIGH FIDELITY PNG EXTRACTION ONLY
        ========================================================================
        This component is placed offscreen, keeping standard width and full styling.
        It avoids viewport scaling, which removes scrolling glitches or crop defects.
      */}
      <div 
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '0',
          width: '800px',
          pointerEvents: 'none',
          opacity: 0,
          zIndex: -110
        }}
        aria-hidden="true"
      >
        <div 
          ref={pdfRef}
          id="shift-report-pdf-target"
          className="bg-white"
        >
          {renderReportContent(true)}
        </div>
      </div>
    </AnimatePresence>
  );
}
