import React, { useState } from 'react';
import { Plus, CheckSquare, AlertTriangle, ToggleLeft, ToggleRight, ListChecks } from 'lucide-react';
import { HSChecklistItem, HSObjectType } from '../types';

interface ChecklistConfiguratorProps {
  objectTypes: HSObjectType[];
  checklistItems: HSChecklistItem[];
  onToggleItem: (id: string, isEnabled: boolean) => void;
  onAddItem: (item: Partial<HSChecklistItem>) => void;
}

export function ChecklistConfigurator({
  objectTypes,
  checklistItems,
  onToggleItem,
  onAddItem
}: ChecklistConfiguratorProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(objectTypes[0]?.id || '');
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [newItem, setNewItem] = useState<{
    label: string;
    description: string;
    category: string;
    isCritical: boolean;
  }>({
    label: '',
    description: '',
    category: 'General',
    isCritical: false
  });

  const selectedObjectType = objectTypes.find(t => t.id === selectedTypeId);

  const filteredItems = checklistItems.filter(ci => ci.objectTypeId === selectedTypeId);

  const handleOpenNew = () => {
    setNewItem({
      label: '',
      description: '',
      category: 'General',
      isCritical: false
    });
    setIsOpenModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      ...newItem,
      objectTypeId: selectedTypeId
    });
    setIsOpenModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Configurar Checklists
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Definición de ítems a inspeccionar y configuración de hallazgos críticos.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Nuevo Ítem de Checklist
        </button>
      </div>

      {/* Selector de Tipo de Objeto */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-thin">
        {objectTypes.map(ot => {
          const isSelected = ot.id === selectedTypeId;
          const itemsCount = checklistItems.filter(ci => ci.objectTypeId === ot.id && ci.isEnabled).length;
          return (
            <button
              key={ot.id}
              onClick={() => setSelectedTypeId(ot.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${isSelected
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-text-muted hover:text-text-main border-border hover:border-primary/40'
                }`}
            >
              <ListChecks size={14} />
              <span>{ot.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-bg text-text-muted'
                }`}>
                {itemsCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de ítems del Checklist */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-xl border border-border text-text-muted text-xs">
            No hay ítems configurados para {selectedObjectType?.name}. Haz clic en "Nuevo Ítem de Checklist" para agregar uno.
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${item.isEnabled
                ? 'bg-surface border-border hover:border-primary/40'
                : 'bg-bg/40 border-border/50 opacity-60'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg mt-0.5 ${item.isCritical ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'
                  }`}>
                  {item.isCritical ? <AlertTriangle size={16} /> : <CheckSquare size={16} />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-text-main">{item.label}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-bg text-text-muted border border-border">
                      {item.category}
                    </span>
                    {item.isCritical && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Crítico
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-text-muted mt-1">{item.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleItem(item.id, !item.isEnabled)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${item.isEnabled
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-text-muted/10 text-text-muted border border-border'
                    }`}
                >
                  {item.isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  <span>{item.isEnabled ? 'Habilitado' : 'Deshabilitado'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Agregar Ítem */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              Nuevo Ítem de Checklist para {selectedObjectType?.name}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Título / Pregunta del Ítem</label>
                <input
                  type="text"
                  required
                  value={newItem.label}
                  onChange={e => setNewItem({ ...newItem, label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Precinto y pasador de seguridad intacto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Categoría</label>
                <input
                  type="text"
                  required
                  value={newItem.category}
                  onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Seguridad, Presión, Estructura"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Descripción explicativa para el operario</label>
                <textarea
                  rows={2}
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden resize-none"
                  placeholder="Instrucciones breves de cómo verificar este ítem..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isCritical"
                  checked={newItem.isCritical}
                  onChange={e => setNewItem({ ...newItem, isCritical: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="isCritical" className="text-xs font-bold text-rose-500 cursor-pointer select-none">
                  ¿Es un hallazgo Crítico? (Genera Plan de Acción inmediato)
                </label>
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
                  Agregar Ítem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
