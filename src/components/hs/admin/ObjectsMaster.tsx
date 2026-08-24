import React, { useState } from 'react';
import { Plus, QrCode, MapPin, Edit2, Search, Filter, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { HSObject, HSObjectType, HSSector } from '../types';

interface ObjectsMasterProps {
  objects: HSObject[];
  objectTypes: HSObjectType[];
  sectors: HSSector[];
  onSave: (item: Partial<HSObject>) => void;
}

export function ObjectsMaster({ objects, objectTypes, sectors, onSave }: ObjectsMasterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSObject> | null>(null);

  const filteredObjects = objects.filter(obj => {
    const matchesSearch = obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obj.qrCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obj.locationDetail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !selectedSectorFilter || obj.sectorId === selectedSectorFilter;
    const matchesType = !selectedTypeFilter || obj.typeId === selectedTypeFilter;

    return matchesSearch && matchesSector && matchesType;
  });

  const handleOpenNew = () => {
    const defaultType = objectTypes[0]?.id || '';
    const defaultSector = sectors[0]?.id || '';
    setEditingItem({
      name: '',
      qrCode: `QR-${Date.now().toString().slice(-4)}`,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onSave(editingItem);
      setIsOpenModal(false);
      setEditingItem(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle size={12} /> Operativo</span>;
      case 'WARNING':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20"><AlertCircle size={12} /> Observado</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20"><AlertCircle size={12} /> Crítico</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20"><Clock size={12} /> Pendiente</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Maestro de Objetos
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Registro de todos los activos físicos.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Nuevo Objeto QR
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
            placeholder="Buscar por nombre, QR o ubicación..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-2.5 text-text-muted" />
          <select
            value={selectedSectorFilter}
            onChange={e => setSelectedSectorFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden appearance-none"
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
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden appearance-none"
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
              <th className="p-3">Nombre del Objeto</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Sector</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Próxima Inspección</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredObjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-muted">
                  No se encontraron objetos registrados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredObjects.map(obj => (
                <tr key={obj.id} className="hover:bg-bg/40 transition-colors">
                  <td className="p-3 font-mono font-bold text-primary flex items-center gap-1.5">
                    <QrCode size={14} />
                    {obj.qrCode}
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
                  <td className="p-3 text-text-muted">{obj.typeName}</td>
                  <td className="p-3 text-text-muted">{obj.sectorName}</td>
                  <td className="p-3">{getStatusBadge(obj.status)}</td>
                  <td className="p-3 font-mono text-text-muted">{obj.nextInspectionDue}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleOpenEdit(obj)}
                      className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors"
                      title="Editar Objeto"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isOpenModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              {editingItem.id ? 'Editar Objeto' : 'Nuevo Objeto'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre / Identificador</label>
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
                  <label className="block text-xs font-bold text-text-muted mb-1">Código QR</label>
                  <input
                    type="text"
                    required
                    value={editingItem.qrCode || ''}
                    onChange={e => setEditingItem({ ...editingItem, qrCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs font-mono focus:ring-1 focus:ring-primary outline-hidden"
                    placeholder="QR-EXT-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Tipo de Objeto</label>
                  <select
                    value={editingItem.typeId || ''}
                    onChange={e => setEditingItem({ ...editingItem, typeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  >
                    {objectTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Sector Asignado</label>
                <select
                  value={editingItem.sectorId || ''}
                  onChange={e => setEditingItem({ ...editingItem, sectorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                >
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Ubicación Detallada</label>
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
                  placeholder="Observaciones de instalación o historial..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-text-muted text-xs font-bold hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Guardar Objeto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
