import React, { useState } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { HSObjectType } from '../types';

interface ObjectTypesMasterProps {
  objectTypes: HSObjectType[];
  onSave: (item: Partial<HSObjectType>) => void;
}

export function ObjectTypesMaster({ objectTypes, onSave }: ObjectTypesMasterProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<HSObjectType> | null>(null);

  const handleOpenNew = () => {
    setEditingItem({
      name: '',
      code: '',
      description: '',
      inspectionFrequencyDays: 30,
      iconName: 'ShieldCheck'
    });
    setIsOpenModal(true);
  };

  const handleOpenEdit = (item: HSObjectType) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Maestro de Tipos de Objeto
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Configuración de tipos de activos y su frecuencia de inspección.
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
                    <span className="text-[10px] font-mono font-bold text-text-muted px-1.5 py-0.5 rounded bg-bg border border-border">
                      {ot.code}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenEdit(ot)}
                  className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors"
                  title="Editar Tipo"
                >
                  <Edit2 size={14} />
                </button>
              </div>

              <p className="text-xs text-text-muted mb-3 line-clamp-2">
                {ot.description || 'Sin descripción.'}
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-primary" /> Frecuencia:
              </span>
              <span className="font-bold text-text-main">
                Cada {ot.inspectionFrequencyDays} días
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Form */}
      {isOpenModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              {editingItem.id ? 'Editar Tipo de Objeto' : 'Nuevo Tipo de Objeto'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Extintor CO2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Código Prefijo</label>
                  <input
                    type="text"
                    required
                    value={editingItem.code || ''}
                    onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs font-mono focus:ring-1 focus:ring-primary outline-hidden"
                    placeholder="EXT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Frecuencia (Días)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingItem.inspectionFrequencyDays || 30}
                    onChange={e => setEditingItem({ ...editingItem, inspectionFrequencyDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  placeholder="Detalles sobre el uso o requerimientos de este objeto..."
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
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                >
                  <CheckCircle2 size={14} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
