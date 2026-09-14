import React, { useState, useMemo } from 'react';
import { Plus, MapPin, Edit2, User, CheckCircle2, Trash2, AlertTriangle, Search } from 'lucide-react';
import { HSSector } from '../types';

interface SectorsMasterProps {
  sectors: HSSector[];
  onSave: (item: Partial<HSSector>) => void;
  onDelete?: (id: string) => void;
}

export function SectorsMaster({ sectors, onSave, onDelete }: SectorsMasterProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSSector> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para el modal de confirmación de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenNew = () => {
    setEditingItem({
      name: '',
      code: '',
      responsiblePerson: '',
      locationDetails: ''
    });
    setIsOpenModal(true);
  };

  const handleOpenEdit = (item: HSSector) => {
    setEditingItem(item);
    setIsOpenModal(true);
  };

  const handleConfirmDelete = () => {
    if (deletingId && onDelete) {
      onDelete(deletingId);
    }
    setDeletingId(null);
    setIsOpenModal(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onSave(editingItem);
      setIsOpenModal(false);
      setEditingItem(null);
    }
  };

  const filteredSectors = useMemo(() => {
    if (!searchQuery.trim()) return sectors;
    const query = searchQuery.toLowerCase();
    return sectors.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.responsiblePerson?.toLowerCase() || '').includes(query) ||
      (s.locationDetails?.toLowerCase() || '').includes(query)
    );
  }, [sectors, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Maestro de Sectores de Planta
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Definición de las áreas operativas y sus responsables asignados.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Nuevo Sector
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          type="text"
          placeholder="Buscar sectores por nombre, responsable o ubicación..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-text-main focus:ring-2 focus:ring-primary/50 outline-hidden"
        />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border shadow-sm">
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider bg-black/5 dark:bg-white/5">Sector / Área</th>
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider bg-black/5 dark:bg-white/5">Responsable</th>
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider bg-black/5 dark:bg-white/5">Detalle de Ubicación</th>
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider text-center w-24 bg-black/5 dark:bg-white/5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSectors.length > 0 ? (
                filteredSectors.map(sec => (
                  <tr key={sec.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                          <MapPin size={14} />
                        </div>
                        <span className="font-bold text-text-main text-xs">{sec.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-text-main">
                        <User size={12} className="text-primary" />
                        {sec.responsiblePerson || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      <span className="line-clamp-1 max-w-xs">{sec.locationDetails || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(sec)}
                          className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Editar Sector"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-text-muted">
                    No hay sectores configurados. Haga clic en "Nuevo Sector" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario */}
      {isOpenModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
                {editingItem.id ? 'Editar Sector' : 'Nuevo Sector'}
              </h3>
              {editingItem.id && (
                <button
                  type="button"
                  onClick={() => setDeletingId(editingItem.id!)}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar Sector"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre del Sector</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Sector Ensacado"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Responsable</label>
                <input
                  type="text"
                  required
                  value={editingItem.responsiblePerson || ''}
                  onChange={e => setEditingItem({ ...editingItem, responsiblePerson: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Nombre y apellido del responsable"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Detalle de Ubicación</label>
                <textarea
                  rows={2}
                  value={editingItem.locationDetails || ''}
                  onChange={e => setEditingItem({ ...editingItem, locationDetails: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  placeholder="Ej. Nave Central - Planta Baja..."
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
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Personalizado de Confirmación de Eliminación */}
      {deletingId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h4 className="text-sm font-bold text-text-main">¿Eliminar sector?</h4>
              <p className="text-xs text-text-muted mt-1">
                Esta acción quitará el sector de la lista.
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
