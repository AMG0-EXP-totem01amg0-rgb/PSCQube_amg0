import React, { useState, useMemo } from 'react';
import { Filter, ChevronLeft, ChevronRight, Eye, AlertTriangle, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { HSObject } from '../types';

interface ScheduledInspectionsFilterProps {
  objects: HSObject[];
  selectedObject: HSObject | null;
  onSelectObject: (qrCode: string) => void;
}

export function ScheduledInspectionsFilter({ objects, selectedObject, onSelectObject }: ScheduledInspectionsFilterProps) {
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedInspector, setSelectedInspector] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
    setCurrentPage(1);
  };

  // Filter Objects
  const filteredObjects = useMemo(() => {
    let result = objects;
    if (selectedSector) result = result.filter(o => o.sectorName === selectedSector);
    if (selectedInspector) result = result.filter(o => o.lastInspectedBy === selectedInspector);
    if (selectedType) result = result.filter(o => o.typeName === selectedType);
    if (selectedStatus) {
      if (selectedStatus === 'OK') result = result.filter(o => o.status === 'OK');
      else if (selectedStatus === 'WARNING') result = result.filter(o => o.status === 'WARNING');
      else if (selectedStatus === 'CRITICAL') result = result.filter(o => o.status === 'CRITICAL');
    }
    return result;
  }, [objects, selectedSector, selectedInspector, selectedType, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredObjects.length / itemsPerPage);
  const paginatedObjects = filteredObjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500"><CheckCircle2 size={12} /> HABILITADO</span>;
      case 'WARNING': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500"><AlertCircle size={12} /> OBSERVADO</span>;
      case 'CRITICAL': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500"><AlertTriangle size={12} /> VENCIDO/CRÍTICO</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">PENDIENTE</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Panel de Filtros */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
              Filtros Dependientes en Cascada
            </h4>
          </div>
          <button
            onClick={clearFilters}
            className="text-[11px] font-bold text-text-muted hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> Limpiar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
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

          {/* Flecha separadora visual para pantallas grandes */}
          <div className="hidden lg:flex items-center justify-center absolute left-[24%] top-6 text-border z-10 pointer-events-none">
            <ChevronRight size={16} />
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

          {/* Flecha separadora visual */}
          <div className="hidden lg:flex items-center justify-center absolute left-[49%] top-6 text-border z-10 pointer-events-none">
            <ChevronRight size={16} />
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

          {/* Flecha separadora visual */}
          <div className="hidden lg:flex items-center justify-center absolute left-[74%] top-6 text-border z-10 pointer-events-none">
            <ChevronRight size={16} />
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
              <option value="OK"> Habilitados</option>
              <option value="WARNING"> Próx. a vencer / Obs</option>
              <option value="CRITICAL"> Vencidos / Crítico</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resultados de la Búsqueda */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-main">
            Resultados de la Búsqueda <span className="text-text-muted font-normal capitalize ml-1">(Mostrando {filteredObjects.length} registros)</span>
          </h4>
          <button className="text-[11px] font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 flex items-center gap-1.5 transition-colors cursor-pointer">
            <Download size={14} /> Descargar Reporte
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-bg text-[10px] uppercase text-text-muted font-bold border-b border-border">
              <tr>
                <th className="px-4 py-3">FECHA INSP.</th>
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
                    <td className="px-4 py-3 font-mono text-text-muted">{obj.lastInspectedAt || '-'}</td>
                    <td className="px-4 py-3 font-bold text-text-main flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted">
                        {obj.qrCode}
                      </span>
                      {obj.typeName}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{obj.sectorName}</td>
                    <td className="px-4 py-3 text-text-muted">{obj.lastInspectedBy || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(obj.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onSelectObject(obj.qrCode)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedObject?.id === obj.id
                          ? 'bg-primary text-white'
                          : obj.status === 'OK'
                            ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                          }`}
                        title="Realizar Inspección"
                      >
                        {obj.status === 'OK' ? <Eye size={16} /> : <AlertTriangle size={16} />}
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
    </div>
  );
}
