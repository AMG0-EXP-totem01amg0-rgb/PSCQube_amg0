import React, { useState, useMemo } from 'react';
import { Filter, ChevronLeft, ChevronRight, Eye, AlertTriangle, CheckCircle2, RefreshCw, Share2, Check, History } from 'lucide-react';
import { HSObject, HSInspection, HSChecklistItem } from '../types';

interface ScheduledInspectionsFilterProps {
  objects: HSObject[];
  inspections?: HSInspection[];
  checklistItems?: HSChecklistItem[];
  selectedObject: HSObject | null;
  onSelectObject: (qrCode: string) => void;
  onViewCertificate?: (inspectionId: string) => void;
}

export function ScheduledInspectionsFilter({
  objects,
  inspections = [],
  checklistItems = [],
  selectedObject,
  onSelectObject,
  onViewCertificate
}: ScheduledInspectionsFilterProps) {
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedInspector, setSelectedInspector] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [modalObject, setModalObject] = useState<HSObject | null>(null);
  const [historyObject, setHistoryObject] = useState<HSObject | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const itemsPerPage = 10;

  const handleShare = async () => {
    if (!modalObject) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?inspection=${modalObject.id}`;



    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar enlace:', err);
    }
  };

  // Detector de parámetro de inspección en URL para apertura automática del modal
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetIdOrQr = params.get('inspection') || params.get('id');
    if (targetIdOrQr && objects && objects.length > 0) {
      const found = objects.find(
        o => o.id === targetIdOrQr ||
          o.qrCode.toUpperCase().trim() === targetIdOrQr.toUpperCase().trim()
      );
      if (found) {
        setIsSharedView(true);
        setModalObject(found);
      }
    }
  }, [objects]);

  // FUNCIÓN PARA FORMATEAR FECHA A DD/MM/AAAA HH:mm
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/') && dateString.includes(':')) return dateString;

    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) {
        const parts = dateString.split('T')[0].split('-');
        if (parts.length >= 3) return `${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}`;
        return dateString;
      }

      if (!dateString.includes('T') && !dateString.includes(' ') && !dateString.includes(':')) {
        const parts = dateString.split('-');
        if (parts.length >= 3) return `${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}`;
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

  // Cascading lists
  const sectors = useMemo(() => Array.from(new Set(objects.map(o => o.sectorName).filter(Boolean))) as string[], [objects]);

  const inspectors = useMemo(() => {
    let filtered = objects;
    if (selectedSector) filtered = filtered.filter(o => o.sectorName === selectedSector);
    return Array.from(new Set(filtered.map(o => o.lastInspectedBy).filter(Boolean))) as string[];
  }, [objects, selectedSector]);

  const types = useMemo(() => {
    let filtered = objects;
    if (selectedSector) filtered = filtered.filter(o => o.sectorName === selectedSector);
    if (selectedInspector) filtered = filtered.filter(o => o.lastInspectedBy === selectedInspector);
    return Array.from(new Set(filtered.map(o => o.typeName).filter(Boolean))) as string[];
  }, [objects, selectedSector, selectedInspector]);

  const clearFilters = () => {
    setSelectedSector('');
    setSelectedInspector('');
    setSelectedType('');
    setSelectedStatus('');
    setSelectedDate('');
    setCurrentPage(1);
  };

  // Filter Objects
  const filteredObjects = useMemo(() => {
    let result = objects;
    if (selectedSector) result = result.filter(o => o.sectorName === selectedSector);
    if (selectedInspector) result = result.filter(o => o.lastInspectedBy === selectedInspector);
    if (selectedType) result = result.filter(o => o.typeName === selectedType);
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-');
      const formattedFilterDate = `${day}/${month}/${year}`;
      result = result.filter(o => o.lastInspectedAt && o.lastInspectedAt.startsWith(formattedFilterDate));
    }
    if (selectedStatus) {
      if (selectedStatus === 'OK') result = result.filter(o => o.status === 'OK');
      else if (selectedStatus === 'NO_OK') result = result.filter(o => o.status !== 'OK');
    }
    return result;
  }, [objects, selectedSector, selectedInspector, selectedType, selectedStatus, selectedDate]);

  // Pagination
  const totalPages = Math.ceil(filteredObjects.length / itemsPerPage);
  const paginatedObjects = filteredObjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    if (status === 'OK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 size={12} /> HABILITADO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <AlertTriangle size={12} /> NO HABILITADO
      </span>
    );
  };

  // Inspección actual para el objeto del modal
  const activeInspection = useMemo(() => {
    if (selectedInspectionId) {
      return inspections.find(i => i.id === selectedInspectionId) || null;
    }
    if (!modalObject) return null;
    return inspections.find(i => i.objectId === modalObject.id) || null;
  }, [modalObject, inspections, selectedInspectionId]);

  // Respuestas a mostrar en el modal
  const modalAnswers = useMemo(() => {
    if (!modalObject) return [];

    if (activeInspection && activeInspection.answers && activeInspection.answers.length > 0) {
      return activeInspection.answers;
    }

    // Fallback: Si no hay inspección previa registrada, generamos lista dinámica con los checklist items del objeto
    const relevantItems = checklistItems.filter(c => c.objectTypeId === modalObject.typeId);

    if (relevantItems.length > 0) {
      return relevantItems.map(item => {
        const isNoOk = modalObject.status !== 'OK' && item.isCritical;
        return {
          checklistItemId: item.id,
          checklistItemLabel: item.label,
          status: (isNoOk ? 'NO_OK' : 'OK') as any,
          observation: isNoOk ? (modalObject.observations || modalObject.notes || 'Detalle del hallazgo registrado') : '',
          actionPlan: isNoOk ? 'Plan de acción para mantenimiento y reemplazo de componentes.' : '',
          isCriticalFinding: item.isCritical
        };
      });
    }

    // Fallback por defecto si tampoco hay items de checklist cargados
    const defaultLabels = [
      { id: 'cli-1', label: 'Acceso y visibilidad despejada', isCritical: false },
      { id: 'cli-2', label: 'Manómetro en rango de presión correcto', isCritical: true },
      { id: 'cli-3', label: 'Precinto y pasador de seguridad intacto', isCritical: true },
      { id: 'cli-4', label: 'Manguera y boquilla en buen estado', isCritical: false },
      { id: 'cli-5', label: 'Tarjeta de inspección vigente', isCritical: false }
    ];

    return defaultLabels.map((item, idx) => {
      const isNoOk = modalObject.status !== 'OK' && idx === 1;
      return {
        checklistItemId: item.id,
        checklistItemLabel: item.label,
        status: (isNoOk ? 'NO_OK' : 'OK') as any,
        observation: isNoOk ? (modalObject.observations || 'Manguera agrietada y manómetro fuera de presión') : '',
        actionPlan: isNoOk ? 'Realizar el reemplazo de componentes y prueba de calibración por mantenimiento.' : '',
        isCriticalFinding: item.isCritical
      };
    });
  }, [modalObject, activeInspection, checklistItems]);

  return (
    <div className="space-y-4">
      {/* Panel de Filtros */}
      <div className="p-4 rounded-2xl border border-white/10 bg-surface/50 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Filtros de la búsqueda
            </h4>
          </div>
          <button
            onClick={clearFilters}
            className="text-[11px] font-bold text-text-muted hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> Limpiar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
          {/* 1. Sector / Área */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold uppercase text-text-muted"> Sector / Área</label>
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setSelectedInspector('');
                setSelectedType('');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los sectores ]</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 2. Inspector */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold uppercase text-text-muted"> Inspector</label>
            <select
              value={selectedInspector}
              onChange={(e) => {
                setSelectedInspector(e.target.value);
                setSelectedType('');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los inspectores ]</option>
              {inspectors.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* 3. Tipo de Objeto */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold uppercase text-text-muted"> Tipo de Objeto</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos los tipos ]</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 4. Estado Vigencia */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted"> Estado Vigencia</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            >
              <option value="">[ Todos ]</option>
              <option value="OK"> HABILITADO</option>
              <option value="NO_OK"> NO HABILITADO</option>
            </select>
          </div>

          {/* 5. Fecha */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-text-muted"> Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs font-medium bg-bg border border-border rounded-lg text-text-main focus:ring-1 focus:ring-primary outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Resultados de la Búsqueda */}
      <div className="p-4 rounded-2xl border border-white/10 bg-surface/50 backdrop-blur-md shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
            Resultados de la Búsqueda <span className="text-text-muted font-normal capitalize ml-1">(Mostrando {filteredObjects.length} registros)</span>
          </h4>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-bg text-[10px] uppercase text-text-muted font-bold border-b border-border">
              <tr>
                <th className="px-4 py-3">FECHA INSP/ HS.</th>
                <th className="px-4 py-3">PUNTO DE INSPECCIÓN</th>
                <th className="px-4 py-3">SECTOR</th>
                <th className="px-4 py-3">INSPECTOR</th>
                <th className="px-4 py-3">ESTADO</th>
                <th className="px-4 py-3 text-center">ACCIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedObjects.length > 0 ? (
                paginatedObjects.map(obj => (
                  <tr
                    key={obj.id}
                    className={`transition-colors ${selectedObject?.id === obj.id ? 'bg-primary/5' : 'hover:bg-bg/50'}`}
                  >
                    <td className="px-4 py-3 font-mono text-text-muted">{obj.lastInspectedAt ? formatDate(obj.lastInspectedAt) : '-'}</td>
                    <td className="px-4 py-3 font-bold text-text-main flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted">
                        {obj.qrCode}
                      </span>
                      {obj.typeName}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{obj.sectorName}</td>
                    <td className="px-4 py-3 text-text-muted">{obj.lastInspectedBy || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(obj.status)}</td>
                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setHistoryObject(obj)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer bg-amber-500/10 text-amber-500 hover:bg-amber-500/20`}
                        title="Ver historial de inspecciones"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedInspectionId(null);
                          setIsSharedView(false);
                          setModalObject(obj);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedObject?.id === obj.id
                          ? 'bg-primary text-white'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        title="Ver detalles"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No se encontraron activos para la combinación de filtros seleccionada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-[10px] text-text-muted">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-bg disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-bg disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE DETALLE DE INSPECCIÓN */}
      {modalObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">

          <style>{`
            @media print {
              body * { visibility: hidden; }
              #hoja-impresion-oficial, #hoja-impresion-oficial * { visibility: visible; }
              #hoja-impresion-oficial {
                display: block !important;
                position: absolute;
                left: 0; top: 0; width: 100%; padding: 20px;
                background: white !important; color: black !important;
                font-family: Arial, sans-serif;
              }
              .no-print { display: none !important; }
            }
          `}</style>

          {/* VISTA EN PANTALLA (Modal Interactivo - Vista Rápida) */}
          {!isSharedView && (
            <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8 p-6 space-y-4 no-print">

              {/* Cabecera */}
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-primary">
                    {activeInspection ? activeInspection.id.toUpperCase() : `INSP-${modalObject.qrCode}`}
                  </span>
                  <h3 className="text-base font-bold text-text-main">{modalObject.name} ({modalObject.typeName})</h3>
                </div>
                <button
                  onClick={() => { setModalObject(null); setIsSharedView(false); }}
                  className="text-text-muted hover:text-text-main font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Datos Principales */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-bg/40 p-3 rounded-xl border border-border">
                <div>
                  <strong className="text-text-muted">Área/Sector:</strong>
                  <p className="font-semibold text-text-main">{modalObject.sectorName}</p>
                </div>
                <div>
                  <strong className="text-text-muted">Inspector:</strong>
                  <p className="font-semibold text-text-main">{activeInspection?.operatorName || modalObject.lastInspectedBy || '-'}</p>
                </div>
                <div>
                  <strong className="text-text-muted">Fecha/Hora:</strong>
                  <p className="font-semibold text-text-main">{formatDate(activeInspection ? activeInspection.date : modalObject.lastInspectedAt)}</p>
                </div>
                <div>
                  <strong className="text-text-muted">Estado:</strong>
                  <p className={`font-black ${activeInspection ? (activeInspection.overallResult === 'HABILITADO' || activeInspection.overallResult === 'CONFORME' ? 'text-emerald-500' : 'text-rose-500') : (modalObject.status === 'OK' ? 'text-emerald-500' : 'text-rose-500')}`}>
                    {activeInspection ? (activeInspection.overallResult === 'HABILITADO' || activeInspection.overallResult === 'CONFORME' ? 'HABILITADO' : 'NO HABILITADO') : (modalObject.status === 'OK' ? 'HABILITADO' : 'NO HABILITADO')}
                  </p>
                </div>
              </div>

              {/* Bloque Final de Firma del Inspector */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                <div>
                  <span className="font-bold text-text-main block text-[10px] uppercase tracking-wider">FIRMA / VALIDACIÓN DEL INSPECTOR</span>
                  <p className="font-serif italic text-text-main text-xs mt-0.5">
                    {activeInspection?.operatorName || modalObject.lastInspectedBy || 'Operario de Planta'}
                  </p>
                </div>
                <div className="text-right">
                </div>
              </div>

              {/* Pie del Modal */}
              <div className="pt-3 border-t border-border flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleShare}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${isCopied
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                    }`}
                >
                  {isCopied ? <Check size={14} /> : <Share2 size={14} />}
                  <span>{isCopied ? '¡Enlace Copiado!' : 'Compartir'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setModalObject(null); setIsSharedView(false); }}
                  className="px-4 py-1.5 text-xs bg-bg border border-border rounded-lg font-bold text-text-main hover:bg-surface cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>
          )}

          {/* VISTA PARA IMPRESIÓN OFICIAL / VISTA COMPARTIDA */}
          <div id="hoja-impresion-oficial" className={`${isSharedView ? 'block w-full max-w-4xl bg-white text-black p-8 rounded-2xl shadow-2xl relative my-8' : 'hidden'} text-xs font-sans`}>
            {isSharedView && (
              <button
                onClick={() => { setModalObject(null); setIsSharedView(false); }}
                className="absolute top-6 right-6 text-black hover:text-gray-600 font-bold px-3 py-1.5 cursor-pointer no-print text-sm border border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors z-10"
              >
                ✕ Cerrar
              </button>
            )}

            {isSharedView && (
              <div className="bg-[#002244] -mx-8 -mt-8 mb-6 p-6 rounded-t-2xl flex justify-between items-center">
                <h1 className="text-white font-bold text-xl tracking-wide uppercase">CERTIFICADO DE INSPECCIÓN PROGRAMADA</h1>
              </div>
            )}

            <div className="flex justify-between items-start border-b-2 border-gray-300 pb-4">
              <div>
                <p className="font-bold text-sm text-black">Holcim (Argentina) S.A.</p>
                <p className="text-gray-700">Planta Malagueño</p>
                <p className="text-gray-700">Av. Italia S/N, Malagueño, Argentina</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-black text-emerald-600 tracking-wider">HOLCIM</h2>
              </div>
            </div>

            <div className="border-2 border-black divide-y-2 divide-black">
              <div className="grid grid-cols-2 divide-x-2 divide-black p-2 bg-gray-50">
                <div className="space-y-1">
                  <p><strong>IDINSPECCIÓN:</strong> {activeInspection ? activeInspection.id : `INSP-${modalObject.qrCode}`}</p>
                  <p><strong>N° ACTIVO / QR:</strong> {modalObject.qrCode}</p>
                </div>
                <div className="space-y-1 pl-2">
                  <p><strong>FECHA:</strong> {formatDate(activeInspection ? activeInspection.date : modalObject.lastInspectedAt)}</p>
                  <p><strong>CENTRO:</strong> MALAGUEÑO</p>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x-2 divide-black p-2 bg-gray-50">
                <div className="space-y-1">
                  <p><strong>INSPECTOR:</strong> {activeInspection?.operatorName || modalObject.lastInspectedBy || 'OPERARIO PLANTA'}</p>
                  <p><strong>TIPO DE INSPECCIÓN:</strong> {modalObject.typeName}</p>
                  <p><strong>ESTADO FINAL:</strong> {activeInspection ? (activeInspection.overallResult === 'HABILITADO' || activeInspection.overallResult === 'CONFORME' ? 'HABILITADO ✅' : 'NO HABILITADO ❌') : (modalObject.status === 'OK' ? 'HABILITADO ✅' : 'NO HABILITADO ❌')}</p>
                </div>
                <div className="space-y-1 pl-2">
                  <p><strong>PUNTO DE INSPECCIÓN:</strong> {modalObject.name}</p>
                  <p><strong>ÁREA:</strong> {modalObject.sectorName}</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-black overflow-hidden">
              <div className="bg-gray-300 p-2 font-bold text-center text-sm border-b-2 border-black">
                DESARROLLO Y RESULTADO DE LA INSPECCIÓN
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100 font-bold">
                    <th className="p-2 border-r-2 border-black">ÍTEM INSPECCIONADO</th>
                    <th className="p-2 w-1/2">RESULTADO Y DETALLES</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-black">
                  {modalAnswers.map((ans, idx) => {
                    const isNoOk = ans.status === 'NO_OK';
                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="p-2 border-r-2 border-black">
                          {idx + 1}. {ans.checklistItemLabel} {ans.isCriticalFinding ? '(CRÍTICO)' : ''}
                        </td>
                        <td className={`p-2 font-bold ${isNoOk ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {isNoOk ? (
                            <div className="space-y-1">
                              <p>MALO </p>
                              <p className="text-[10px] text-black font-normal"><strong>Hallazgo:</strong> {ans.observation || '-'}</p>
                              {ans.isCriticalFinding && (
                                <p className="text-[10px] text-black font-normal"><strong>Plan de Acción:</strong> {ans.actionPlan || '-'}</p>
                              )}
                            </div>
                          ) : (
                            'BIEN '
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-8 flex flex-col items-start space-y-1">
              <div className="w-48 border-b-2 border-black text-center font-serif text-lg italic pb-1">
                Firma
              </div>
              <p className="font-bold text-xs uppercase tracking-wider">FIRMA INSPECTOR</p>
            </div>
          </div>

        </div>
      )}
      {/* MODAL DE HISTORIAL DE INSPECCIONES */}
      {historyObject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-8 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <History size={18} className="text-amber-500" /> Historial de Inspecciones
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  <strong className="text-primary">{historyObject.name}</strong> ({historyObject.qrCode}) - {historyObject.typeName}
                </p>
              </div>
              <button
                onClick={() => setHistoryObject(null)}
                className="text-text-muted hover:text-text-main font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-bg/50">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-bg text-[10px] uppercase text-text-muted font-bold border-b border-border sticky top-0">
                  <tr>
                    <th className="px-4 py-3">FECHA Y HORA</th>
                    <th className="px-4 py-3">INSPECTOR</th>
                    <th className="px-4 py-3">RESULTADO GENERAL</th>
                    <th className="px-4 py-3">DETALLE INSPECCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const objInspections = inspections.filter(i => i.objectId === historyObject.id);
                    if (objInspections.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                            No hay inspecciones registradas para este activo.
                          </td>
                        </tr>
                      );
                    }
                    return objInspections.map(insp => {
                      const isOk = insp.overallResult === 'HABILITADO' || insp.overallResult === 'CONFORME';
                      const statusDisplay = isOk ? 'HABILITADO' : 'NO HABILITADO';
                      return (
                        <tr
                          key={insp.id}
                          className="hover:bg-bg transition-colors cursor-pointer"
                          title="Clic para ver detalle de la inspección"
                          onClick={() => {
                            if (onViewCertificate) {
                              onViewCertificate(insp.id);
                            } else {
                              setSelectedInspectionId(insp.id);
                              setModalObject(historyObject);
                              setIsSharedView(false);
                              setHistoryObject(null);
                            }
                          }}
                        >
                          <td className="px-4 py-3 font-mono text-text-muted">{formatDate(insp.date)}</td>
                          <td className="px-4 py-3 font-medium text-text-main">{insp.operatorName || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${isOk
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              }`}>
                              {isOk ? '✅ ' : '❌ '}
                              {statusDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[10px] text-text-muted truncate max-w-xs" title={insp.comments}>
                              {insp.comments || 'Ver detalle de la inspección...'}
                            </p>
                          </td>
                        </tr>
                      )
                    });
                  })()}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryObject(null)}
                className="px-5 py-1.5 text-xs bg-bg border border-border rounded-lg font-bold text-text-main hover:bg-surface cursor-pointer transition-colors"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}