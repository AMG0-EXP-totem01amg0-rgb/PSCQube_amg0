import React, { useState } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle2, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { HSObjectType } from '../types';

interface ObjectTypesMasterProps {
  objectTypes: HSObjectType[];
  onSave: (item: Partial<HSObjectType>) => void;
  onDelete?: (id: string) => void;
}

export function ObjectTypesMaster({ objectTypes, onSave, onDelete }: ObjectTypesMasterProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSObjectType> | null>(null);

  // Estado para el cartel de confirmación sin 'localhost'
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleOpenNew = () => {
    setEditingItem({
      name: '',
      code: '',
      description: '',
      inspectionFrequencyDays: 30,
      iconName: 'ShieldCheck'
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

  const getFrequencyLabel = (days?: number) => {
    if (days === undefined || days === null) return 'No definida';
    if (days === 7) return '7 días';
    if (days === 30) return '30 días';
    if (days === 90) return '90 días';
    return `${days} días`;
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {objectTypes.map(ot => (
          <div
            key={ot.id}
            className="p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-main">{ot.name}</h4>
                    <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                      Prefijo: {ot.code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(ot)}
                    className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors cursor-pointer"
                    title="Editar Tipo"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>

              <p className="text-xs text-text-muted mb-3 line-clamp-2">
                {ot.description || 'Sin descripción asignada.'}
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-primary" /> Frecuencia de Control:
              </span>
              <span className="font-bold text-text-main">
                {getFrequencyLabel(ot.inspectionFrequencyDays)}
              </span>
            </div>
          </div>
        ))}
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

              {/* Frecuencia de Control */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">
                  Frecuencia de Control
                </label>
                <div className="space-y-2">
                  <select
                    value={
                      [7, 30, 90].includes(editingItem.inspectionFrequencyDays || 30)
                        ? editingItem.inspectionFrequencyDays
                        : 'CUSTOM'
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (val !== 'CUSTOM') {
                        setEditingItem({ ...editingItem, inspectionFrequencyDays: parseInt(val) });
                      } else {
                        setEditingItem({ ...editingItem, inspectionFrequencyDays: undefined });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                  >
                    <option value={7}>7 días</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                    <option value="CUSTOM">Más días</option>
                  </select>

                  {![7, 30, 90].includes(editingItem.inspectionFrequencyDays || 0) && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        required
                        min={1}
                        value={editingItem.inspectionFrequencyDays ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEditingItem({
                            ...editingItem,
                            inspectionFrequencyDays: val === '' ? undefined : parseInt(val, 10)
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs font-bold focus:ring-1 focus:ring-primary outline-hidden"
                        placeholder="Ingrese la cantidad de días..."
                      />
                      <span className="text-xs text-text-muted font-bold whitespace-nowrap">días</span>
                    </div>
                  )}
                </div>
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