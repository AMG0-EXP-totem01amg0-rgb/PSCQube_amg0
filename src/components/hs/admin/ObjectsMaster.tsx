import React, { useState } from 'react';
import { Plus, QrCode, MapPin, Edit2, Search, Filter, Printer, Trash2, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { HSObject, HSObjectType, HSSector } from '../types';

interface ObjectsMasterProps {
  objects: HSObject[];
  objectTypes: HSObjectType[];
  sectors: HSSector[];
  onSave: (item: Partial<HSObject>) => void;
  onDelete?: (id: string) => void;
}

export function ObjectsMaster({ objects, objectTypes, sectors, onSave, onDelete }: ObjectsMasterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

  // Estado para expansión de tipos de objetos (acordeón)
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSObject> | null>(null);

  // Modal para la etiqueta e impresión de QR
  const [qrModalItem, setQrModalItem] = useState<HSObject | null>(null);

  // Estado para confirmación de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtrado compuesto
  const filteredObjects = objects.filter(obj => {
    const matchesSearch =
      obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obj.qrCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (obj.locationDetail && obj.locationDetail.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSector = !selectedSectorFilter || obj.sectorId === selectedSectorFilter;
    const matchesType = !selectedTypeFilter || obj.typeId === selectedTypeFilter;

    return matchesSearch && matchesSector && matchesType;
  });

  const generateSuggestedQrCode = (typeId: string) => {
    const selectedType = objectTypes.find(t => t.id === typeId);
    const prefix = selectedType?.code || 'QR';
    const sameTypeCount = objects.filter(o => o.typeId === typeId).length + 1;
    const paddedIndex = sameTypeCount.toString().padStart(3, '0');
    return `${prefix}-${paddedIndex}`;
  };

  const toggleType = (typeId: string) => {
    setExpandedTypes(prev => 
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const handleOpenNew = () => {
    const defaultType = objectTypes[0]?.id || '';
    const defaultSector = sectors[0]?.id || '';
    const suggestedQr = defaultType ? generateSuggestedQrCode(defaultType) : 'QR-001';

    setEditingItem({
      name: '',
      qrCode: suggestedQr,
      typeId: defaultType,
      sectorId: defaultSector,
      locationDetail: '',
      notes: ''
    });
    setIsOpenModal(true);
  };

  const handleOpenEdit = (item: HSObject) => {
    setEditingItem(item);
    setIsOpenModal(true);
  };

  const handleTypeChange = (newTypeId: string) => {
    if (!editingItem) return;
    if (!editingItem.id) {
      const suggestedQr = generateSuggestedQrCode(newTypeId);
      setEditingItem({
        ...editingItem,
        typeId: newTypeId,
        qrCode: suggestedQr
      });
    } else {
      setEditingItem({
        ...editingItem,
        typeId: newTypeId
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      const matchedType = objectTypes.find(t => t.id === editingItem.typeId);
      const matchedSector = sectors.find(s => s.id === editingItem.sectorId);

      onSave({
        ...editingItem,
        typeName: matchedType?.name || editingItem.typeName,
        sectorName: matchedSector?.name || editingItem.sectorName
      });

      setIsOpenModal(false);
      setEditingItem(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingId && onDelete) {
      onDelete(deletingId);
    }
    setDeletingId(null);
    setIsOpenModal(false);
    setEditingItem(null);
  };

  const getQrImageUrl = (qrCode: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const targetUrl = `${baseUrl}/?qr=${encodeURIComponent(qrCode)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
  };

  return (
    <div className="space-y-4">
      {/* Estilos CSS para ocultar todo al imprimir excepto el sticker del QR */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr-sticker, #printable-qr-sticker * {
            visibility: visible;
          }
          #printable-qr-sticker {
            position: absolute;
            left: 50%;
            top: 10%;
            transform: translateX(-50%);
            width: 80mm;
            padding: 5mm;
            border: 2px dashed #000;
            border-radius: 8px;
            background: #fff !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
        @keyframes accordion-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-accordion {
          animation: accordion-down 0.2s ease-out forwards;
        }
      `}</style>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Puntos de Inspección
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Registro, vinculación a sectores e impresión de identificadores QR para activos.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Nuevo Punto de Inspección
        </button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-surface border border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por QR, nombre o ubicación..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-2.5 text-text-muted" />
          <select
            value={selectedSectorFilter}
            onChange={e => setSelectedSectorFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
          >
            <option value="">Todos los Sectores</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-2.5 text-text-muted" />
          <select
            value={selectedTypeFilter}
            onChange={e => setSelectedTypeFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
          >
            <option value="">Todos los Tipos</option>
            {objectTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Objetos */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg/50 text-[10px] font-black uppercase text-text-muted tracking-wider">
              <th className="p-3">Código QR</th>
              <th className="p-3">Nombre / Identificador</th>
              <th className="p-3">Tipo de Objeto</th>
              <th className="p-3">Sector</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredObjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No se encontraron puntos de inspección con los filtros aplicados.
                </td>
              </tr>
            ) : (
              objectTypes.map(type => {
                const typeObjects = filteredObjects.filter(obj => obj.typeId === type.id);
                if (typeObjects.length === 0) return null;
                const isExpanded = expandedTypes.includes(type.id);

                return (
                  <React.Fragment key={type.id}>
                    {/* Fila de agrupación por Tipo de Objeto */}
                    <tr 
                      className="bg-bg/80 dark:bg-black/20 cursor-pointer hover:bg-bg transition-colors"
                      onClick={() => toggleType(type.id)}
                    >
                      <td colSpan={5} className="p-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-primary dark:text-primary-light" />
                          ) : (
                            <ChevronRight size={16} className="text-primary dark:text-primary-light" />
                          )}
                          <span className="text-[11px] font-black uppercase tracking-wider text-primary dark:text-primary-light">
                            {type.name}
                          </span>
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {typeObjects.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Objetos del Tipo (sólo si está expandido) */}
                    {isExpanded && typeObjects.map(obj => (
                      <tr key={obj.id} className="animate-accordion hover:bg-bg/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary dark:text-white">
                          <button
                            onClick={() => setQrModalItem(obj)}
                            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                            title="Haga clic para ver/imprimir la etiqueta QR"
                          >
                            <QrCode size={14} />
                            {obj.qrCode}
                          </button>
                        </td>
                        <td className="p-3 font-bold text-text-main">
                          {obj.name}
                          {obj.locationDetail && (
                            <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                              <MapPin size={10} className="inline mr-0.5" />
                              {obj.locationDetail}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-text-muted">
                          {obj.typeName || type.name}
                        </td>
                        <td className="p-3 text-text-muted">
                          {obj.sectorName || sectors.find(s => s.id === obj.sectorId)?.name || 'Sin sector'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(obj)}
                              className="p-1.5 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors cursor-pointer"
                              title="Editar Punto de Inspección"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setDeletingId(obj.id)}
                              className="p-1.5 text-text-muted hover:text-rose-500 rounded hover:bg-bg transition-colors cursor-pointer"
                              title="Eliminar Punto de Inspección"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Vista previa e Impresión de Etiqueta QR Plastificable */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-border pb-3 no-print">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
                Etiqueta de Inspección
              </h3>
              <button
                onClick={() => setQrModalItem(null)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sticker diseñado para recortar y plastificar */}
            <div
              id="printable-qr-sticker"
              className="p-4 bg-white text-slate-900 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center space-y-2 shadow-xs"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1 w-full text-center">
                PUNTO DE CONTROL H&S
              </div>

              <img
                src={getQrImageUrl(qrModalItem.qrCode)}
                alt={`QR ${qrModalItem.qrCode}`}
                className="w-44 h-44 my-1"
              />

              <span className="font-mono font-black text-slate-900 text-lg tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {qrModalItem.qrCode}
              </span>

              <div className="w-full text-center space-y-0.5 pt-1 border-t border-slate-200">
                <p className="text-xs font-black text-slate-900 line-clamp-1">
                  {qrModalItem.name}
                </p>
                <p className="text-[10px] font-bold text-slate-600 line-clamp-1">
                  Sector: {qrModalItem.sectorName || sectors.find(s => s.id === qrModalItem.sectorId)?.name || 'Sin sector'}
                </p>
                {qrModalItem.locationDetail && (
                  <p className="text-[9px] text-slate-500 line-clamp-1 italic">
                    Ubicación: {qrModalItem.locationDetail}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> Imprimir Sticker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición / Creación */}
      {isOpenModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
                {editingItem.id ? 'Editar Punto de Inspección' : 'Nuevo Punto de Inspección'}
              </h3>
              {editingItem.id && (
                <button
                  type="button"
                  onClick={() => setDeletingId(editingItem.id!)}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar Punto de Inspección"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre / Identificador del Activo</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Extintor PQS 10kg - Ensacado L1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Tipo de Objeto</label>
                  <select
                    value={editingItem.typeId || ''}
                    onChange={e => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                  >
                    {objectTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Código QR</label>
                  <input
                    type="text"
                    required
                    value={editingItem.qrCode || ''}
                    onChange={e => setEditingItem({ ...editingItem, qrCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs font-mono focus:ring-1 focus:ring-primary outline-hidden"
                    placeholder="EXT-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Sector Asignado</label>
                <select
                  value={editingItem.sectorId || ''}
                  onChange={e => setEditingItem({ ...editingItem, sectorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                >
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Ubicación Detallada en Planta</label>
                <input
                  type="text"
                  value={editingItem.locationDetail || ''}
                  onChange={e => setEditingItem({ ...editingItem, locationDetail: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Columna C-12, al lado de tablero principal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  value={editingItem.notes || ''}
                  onChange={e => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  placeholder="Observaciones de instalación o especificaciones técnicas..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-text-muted text-xs font-bold hover:bg-bg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Guardar Punto de Inspección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up de confirmación de eliminación */}
      {deletingId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h4 className="text-sm font-bold text-text-main">¿Eliminar Punto de Inspección?</h4>
              <p className="text-xs text-text-muted mt-1">
                Esta acción dará de baja la etiqueta física y su historial del sistema.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="w-full py-2 rounded-xl border border-border text-text-main text-xs font-bold hover:bg-bg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer shadow-xs"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}