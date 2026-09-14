import React, { useState, useMemo } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle2, Clock, Trash2, AlertTriangle, Search } from 'lucide-react';
import { HSObjectType } from '../types';

interface ObjectTypesMasterProps {
  objectTypes: HSObjectType[];
  onSave: (item: Partial<HSObjectType>) => void;
  onDelete?: (id: string) => void;
}

export function ObjectTypesMaster({ objectTypes, onSave, onDelete }: ObjectTypesMasterProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSObjectType> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para el cartel de confirmación sin 'localhost'
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleOpenNew = () => {
    setEditingItem({
      name: '',
      code: '',
      description: ''
    });
    setIsConfirmingDelete(false);
    setIsOpenModal(true);
  };

  const handleOpenEdit = (item: HSObjectType) => {
    setEditingItem(item);
    setIsConfirmingDelete(false);
    setIsOpenModal(true);
  };

  const handleConfirmDelete = () => {
    if (editingItem?.id && onDelete) {
      onDelete(editingItem.id);
    }
    setIsConfirmingDelete(false);
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

  const filteredObjectTypes = useMemo(() => {
    if (!searchQuery.trim()) return objectTypes;
    const query = searchQuery.toLowerCase();
    return objectTypes.filter(ot => 
      ot.name.toLowerCase().includes(query) || 
      ot.code.toLowerCase().includes(query) ||
      (ot.description?.toLowerCase() || '').includes(query)
    );
  }, [objectTypes, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Maestro de Tipos de Objeto
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Definición de activos operativos y periodicidad de control
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Nuevo Tipo
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          type="text"
          placeholder="Buscar tipos de objeto por nombre, prefijo o descripción..."
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
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider bg-black/5 dark:bg-white/5">Tipo de Objeto</th>
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider bg-black/5 dark:bg-white/5">Descripción</th>
                <th className="px-4 py-3 text-[10px] font-black text-text-muted uppercase tracking-wider text-center w-24 bg-black/5 dark:bg-white/5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredObjectTypes.length > 0 ? (
                filteredObjectTypes.map(ot => (
                  <tr key={ot.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                          <span className="font-bold text-text-main text-xs block">{ot.name}</span>
                          <span className="text-[9px] font-mono font-bold text-primary dark:text-white px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 mt-1 inline-block">
                            Prefijo: {ot.code}
                          </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      <span className="line-clamp-2 max-w-xs">{ot.description || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(ot)}
                          className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Editar Tipo de Objeto"
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
                    No hay tipos de objetos configurados o no coinciden con la búsqueda.
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
                {editingItem.id ? 'Editar Tipo de Objeto' : 'Nuevo Tipo de Objeto'}
              </h3>
              {editingItem.id && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar Tipo de Objeto"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre del Tipo de Objeto</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Escaleras de Mano / Extensibles"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Prefijo de Código (QR)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={editingItem.code || ''}
                  onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs font-mono focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="ESC, APA, ESL, EXT"
                />
                <span className="text-[10px] text-text-muted mt-0.5 block">Se usará en la autogeneración del QR.</span>
              </div>



              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Descripción / Criterio Operativo</label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  placeholder="Instrucciones o requerimientos específicos de este activo..."
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

      {/* Pop-up de confirmación limpio (Reemplaza a la alerta nativa que muestra 'localhost') */}
      {isConfirmingDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h4 className="text-sm font-bold text-text-main">¿Eliminar el Tipo de objeto?</h4>
              <p className="text-xs text-text-muted mt-1">
                Esta acción eliminará la categoría seleccionada.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
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