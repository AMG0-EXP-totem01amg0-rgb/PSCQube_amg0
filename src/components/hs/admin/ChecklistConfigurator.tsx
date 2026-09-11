import React, { useState } from 'react';
import { Plus, CheckSquare, AlertTriangle, ToggleLeft, ToggleRight, ListChecks, FileText, ChevronRight, Edit2 } from 'lucide-react';
import { HSChecklistItem, HSObjectType, HSChecklistModel } from '../types';

interface ChecklistConfiguratorProps {
  objectTypes: HSObjectType[];
  checklistModels: HSChecklistModel[];
  checklistItems: HSChecklistItem[];
  onToggleItem: (id: string, isEnabled: boolean) => void;
  onAddItem: (item: Partial<HSChecklistItem>) => void;
  onAddModel: (item: Partial<HSChecklistModel>) => void;
  onMigrateOrphanedItems?: (modelId: string, objectTypeId: string) => void;
}

export function ChecklistConfigurator({
  objectTypes,
  checklistModels,
  checklistItems,
  onToggleItem,
  onAddItem,
  onAddModel,
  onMigrateOrphanedItems
}: ChecklistConfiguratorProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(objectTypes[0]?.id || '');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  
  const [editingModel, setEditingModel] = useState<{id?: string, name: string, inspectionFrequencyDays: number}>({ 
    name: '', 
    inspectionFrequencyDays: 30 
  });
  const [newItem, setNewItem] = useState<{
    label: string;
    description: string;
    isCritical: boolean;
  }>({
    label: '',
    description: '',
    isCritical: false
  });

  const selectedObjectType = objectTypes.find(t => t.id === selectedTypeId);
  const selectedModel = checklistModels.find(m => m.id === selectedModelId);
  
  const filteredModels = checklistModels.filter(m => m.objectTypeId === selectedTypeId);
  
  const filteredItems = selectedModelId 
    ? checklistItems.filter(ci => ci.checklistModelId === selectedModelId)
    : [];

  const orphanedItems = checklistItems.filter(ci => ci.objectTypeId === selectedTypeId && !ci.checklistModelId);

  const handleSelectType = (id: string) => {
    setSelectedTypeId(id);
    setSelectedModelId(null); // Reset model selection when type changes
  };

  const handleOpenNewModel = () => {
    setEditingModel({ name: '', inspectionFrequencyDays: 30 });
    setIsModelModalOpen(true);
  };

  const handleOpenEditModel = (model: HSChecklistModel) => {
    setEditingModel({ 
      id: model.id, 
      name: model.name, 
      inspectionFrequencyDays: model.inspectionFrequencyDays || 30 
    });
    setIsModelModalOpen(true);
  };

  const handleSubmitModel = (e: React.FormEvent) => {
    e.preventDefault();
    onAddModel({
      id: editingModel.id,
      name: editingModel.name,
      objectTypeId: selectedTypeId,
      status: 'ACTIVE',
      inspectionFrequencyDays: editingModel.inspectionFrequencyDays
    });
    setIsModelModalOpen(false);
  };

  const handleOpenNewItem = () => {
    setNewItem({
      label: '',
      description: '',
      isCritical: false
    });
    setIsItemModalOpen(true);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      ...newItem,
      category: 'General',
      objectTypeId: selectedTypeId,
      checklistModelId: selectedModelId || undefined
    });
    setIsItemModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
            Configurar Checklists
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Definición de modelos de checklist e ítems a inspeccionar.
          </p>
        </div>
      </div>

      {/* Nivel 1: Selector de Tipo de Objeto */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-thin">
        {objectTypes.map(ot => {
          const isSelected = ot.id === selectedTypeId;
          const modelsCount = checklistModels.filter(m => m.objectTypeId === ot.id).length;
          return (
            <button
              key={ot.id}
              onClick={() => handleSelectType(ot.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${isSelected
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-text-muted hover:text-text-main border-border hover:border-primary/40'
                }`}
            >
              <ListChecks size={14} />
              <span>{ot.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-bg text-text-muted'
                }`}>
                {modelsCount}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* Nivel 2: Encabezado de Modelos */}
        <div className="flex items-center justify-between pt-2">
          <h4 className="text-xs font-black uppercase text-text-main">Modelos de {selectedObjectType?.name}</h4>
          <button
            onClick={handleOpenNewModel}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg shadow-sm hover:bg-primary/20 transition-all cursor-pointer"
          >
            <Plus size={14} />
            Nuevo Modelo
          </button>
        </div>
        
        {filteredModels.length === 0 ? (
          <div className="p-6 text-center bg-surface rounded-xl border border-border text-text-muted text-xs">
            No hay modelos configurados.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredModels.map(model => {
              const isSelected = model.id === selectedModelId;
              const modelItems = checklistItems.filter(ci => ci.checklistModelId === model.id);
              const itemsCount = modelItems.length;

              return (
                <div key={model.id} className={`border rounded-xl transition-all overflow-hidden ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border bg-bg/50'}`}>
                  {/* Model Header (Accordion Trigger) */}
                  <div
                    onClick={() => setSelectedModelId(isSelected ? null : model.id)}
                    className={`w-full text-left p-4 flex items-center justify-between gap-3 cursor-pointer ${isSelected ? 'border-b border-primary/10' : 'hover:border-primary/40'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted'}`}>
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-text-main'}`}>{model.name}</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModel(model);
                            }}
                            className="p-1 text-text-muted hover:text-primary transition-colors rounded hover:bg-bg"
                            title="Editar Modelo"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <p className="text-[10px] text-text-muted">{itemsCount} ítems configurados • Vence cada {model.inspectionFrequencyDays || 30} días</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-muted">{model.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
                        <button
                          type="button"
                          role="switch"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddModel({ ...model, status: model.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${model.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-border'}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${model.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                      <ChevronRight size={16} className={`transition-transform duration-200 ${isSelected ? 'rotate-90 text-primary' : 'text-text-muted'}`} />
                    </div>
                  </div>

                  {/* Accordion Content (Items) */}
                  {isSelected && (
                    <div className="p-4 bg-surface space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-text-main">Ítems a inspeccionar</h4>
                        <button
                          onClick={handleOpenNewItem}
                          className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-primary text-white border border-primary text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                        >
                          <Plus size={14} />
                          Agregar Ítem
                        </button>
                      </div>

                      {orphanedItems.length > 0 && onMigrateOrphanedItems && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            <span className="text-xs text-amber-600 font-medium">Hay {orphanedItems.length} ítems antiguos sin modelo asignado.</span>
                          </div>
                          <button
                            onClick={() => onMigrateOrphanedItems(model.id, selectedTypeId)}
                            className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-amber-600 transition-colors whitespace-nowrap"
                          >
                            Asignar a este Modelo
                          </button>
                        </div>
                      )}

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                        {modelItems.length === 0 ? (
                          <div className="p-8 text-center bg-bg/50 rounded-xl border border-border text-text-muted text-xs">
                            No hay ítems configurados para este modelo.
                          </div>
                        ) : (
                          modelItems.map(item => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border transition-all flex flex-col gap-3 ${item.isEnabled
                                ? 'bg-surface border-border'
                                : 'bg-bg/40 border-border/50 opacity-60'
                                }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${item.isCritical ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'
                                    }`}>
                                    {item.isCritical ? <AlertTriangle size={14} /> : <CheckSquare size={14} />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-xs font-bold text-text-main leading-tight">{item.label}</h4>
                                      {item.isCritical && (
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                          Crítico
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-[10px] text-text-muted mt-1">{item.description}</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0 pt-1">
                                  <span className="text-[10px] font-bold text-text-muted hidden sm:inline">{item.isEnabled ? 'Activo' : 'Inactivo'}</span>
                                  <button
                                    type="button"
                                    role="switch"
                                    onClick={() => onToggleItem(item.id, !item.isEnabled)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${item.isEnabled ? 'bg-emerald-500' : 'bg-border'}`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${item.isEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Agregar Modelo */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              {editingModel.id ? 'Editar Modelo' : `Nuevo Modelo para ${selectedObjectType?.name}`}
            </h3>

            <form onSubmit={handleSubmitModel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Nombre del Modelo</label>
                <input
                  type="text"
                  required
                  value={editingModel.name}
                  onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. Control Diario, Revisión Semestral..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Vencimiento en Días (Frecuencia)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editingModel.inspectionFrequencyDays}
                  onChange={e => setEditingModel({ ...editingModel, inspectionFrequencyDays: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  placeholder="Ej. 30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-text-muted text-xs font-bold hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {editingModel.id ? 'Guardar Cambios' : 'Crear Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Ítem */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-text-main">
              Nuevo Ítem en: {selectedModel?.name}
            </h3>

            <form onSubmit={handleSubmitItem} className="space-y-3">
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
                  onClick={() => setIsItemModalOpen(false)}
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