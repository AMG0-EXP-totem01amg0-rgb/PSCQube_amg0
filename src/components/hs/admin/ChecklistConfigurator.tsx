import React, { useState } from 'react';
import { Plus, CheckSquare, AlertTriangle, ToggleLeft, ToggleRight, ListChecks, FileText, ChevronRight, ChevronDown, Edit2 } from 'lucide-react';
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
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // Expanded types for Nivel 1 accordion
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  
  const [editingModel, setEditingModel] = useState<{id?: string, name: string, inspectionFrequencyDays: number}>({ 
    name: '', 
    inspectionFrequencyDays: 30 
  });
  const [newItem, setNewItem] = useState<{
    id?: string;
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

  const handleToggleType = (id: string) => {
    setExpandedTypes(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleOpenNewModel = (typeId: string) => {
    setSelectedTypeId(typeId);
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
      objectTypeId: selectedTypeId!,
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

  const handleOpenEditItem = (item: HSChecklistItem) => {
    setNewItem({
      id: item.id,
      label: item.label,
      description: item.description || '',
      isCritical: item.isCritical
    });
    setIsItemModalOpen(true);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      id: newItem.id,
      ...newItem,
      category: 'General',
      objectTypeId: selectedTypeId!,
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

      {/* Estilo para la animación del acordeón */}
      <style>{`
        @keyframes accordion-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-accordion {
          animation: accordion-down 0.2s ease-out forwards;
        }
      `}</style>

      {/* Nivel 1: Lista de Tipos de Objeto (Acordeón) */}
      <div className="space-y-4">
        {objectTypes.map(ot => {
          const isTypeExpanded = expandedTypes.includes(ot.id);
          const typeModels = checklistModels.filter(m => m.objectTypeId === ot.id);
          const modelsCount = typeModels.length;
          
          return (
            <div key={ot.id} className={`border rounded-xl transition-all overflow-hidden ${isTypeExpanded ? 'border-primary/50 ring-1 ring-primary/10 bg-primary/5' : 'border-border bg-surface hover:border-primary/30'}`}>
              
              {/* Type Header (Accordion Trigger) */}
              <div
                onClick={() => handleToggleType(ot.id)}
                className="w-full text-left p-4 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isTypeExpanded ? 'bg-primary text-white' : 'bg-bg border border-border text-text-muted'}`}>
                    <ListChecks size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isTypeExpanded ? 'text-primary' : 'text-text-main'}`}>
                      {ot.name}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {modelsCount} {modelsCount === 1 ? 'modelo configurado' : 'modelos configurados'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isTypeExpanded) handleToggleType(ot.id);
                      handleOpenNewModel(ot.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg shadow-sm hover:bg-primary/20 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Nuevo Modelo</span>
                  </button>
                  {isTypeExpanded ? (
                    <ChevronDown size={18} className="text-primary" />
                  ) : (
                    <ChevronRight size={18} className="text-text-muted" />
                  )}
                </div>
              </div>

              {/* Nivel 2: Modelos (Acordeón Content) */}
              {isTypeExpanded && (
                <div className="p-4 bg-bg/50 border-t border-border/50 animate-accordion space-y-3">
                  {typeModels.length === 0 ? (
                    <div className="p-6 text-center bg-surface rounded-xl border border-border text-text-muted text-xs shadow-xs">
                      No hay modelos configurados para este tipo.
                    </div>
                  ) : (
                    typeModels.map(model => {
                      const isModelExpanded = model.id === selectedModelId;
                      const modelItems = checklistItems.filter(ci => ci.checklistModelId === model.id);
                      const itemsCount = modelItems.length;
                      
                      // Items that belong to this type but have no model
                      const typeOrphanedItems = checklistItems.filter(ci => ci.objectTypeId === ot.id && !ci.checklistModelId);

                      return (
                        <div key={model.id} className={`border rounded-xl transition-all overflow-hidden shadow-xs ${isModelExpanded ? 'border-primary bg-surface' : 'border-border bg-surface'}`}>
                          
                          {/* Model Header */}
                          <div
                            onClick={() => {
                              setSelectedTypeId(ot.id);
                              setSelectedModelId(isModelExpanded ? null : model.id);
                            }}
                            className={`w-full text-left p-3.5 flex items-center justify-between gap-3 cursor-pointer ${isModelExpanded ? 'border-b border-primary/10' : 'hover:border-primary/40'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${isModelExpanded ? 'bg-primary/20 text-primary' : 'bg-bg border border-border text-text-muted'}`}>
                                <FileText size={14} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className={`text-xs font-bold ${isModelExpanded ? 'text-primary' : 'text-text-main'}`}>{model.name}</h5>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTypeId(ot.id);
                                      handleOpenEditModel(model);
                                    }}
                                    className="p-1 text-text-muted hover:text-primary transition-colors rounded hover:bg-bg/80"
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
                                <span className="text-[10px] font-bold text-text-muted hidden sm:inline">{model.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
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
                              {isModelExpanded ? (
                                <ChevronDown size={16} className="text-primary" />
                              ) : (
                                <ChevronRight size={16} className="text-text-muted" />
                              )}
                            </div>
                          </div>

                          {/* Nivel 3: Items (Accordion Content) */}
                          {isModelExpanded && (
                            <div className="p-4 bg-bg/30 animate-accordion space-y-4">
                              <div className="flex items-center justify-between">
                                <h6 className="text-[11px] font-black uppercase text-text-main">Ítems de Inspección</h6>
                                <button
                                  onClick={() => {
                                    setSelectedTypeId(ot.id);
                                    handleOpenNewItem();
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-primary text-white border border-primary text-[10px] font-bold rounded-lg shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                                >
                                  <Plus size={12} />
                                  Agregar Ítem
                                </button>
                              </div>

                              {typeOrphanedItems.length > 0 && onMigrateOrphanedItems && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    <span className="text-[11px] text-amber-600 font-medium">Hay {typeOrphanedItems.length} ítems antiguos sin modelo asignado en este tipo.</span>
                                  </div>
                                  <button
                                    onClick={() => onMigrateOrphanedItems(model.id, ot.id)}
                                    className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-amber-600 transition-colors whitespace-nowrap"
                                  >
                                    Asignar a este Modelo
                                  </button>
                                </div>
                              )}

                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                                {modelItems.length === 0 ? (
                                  <div className="p-6 text-center bg-surface rounded-xl border border-border text-text-muted text-[11px] shadow-xs">
                                    No hay ítems configurados para este modelo.
                                  </div>
                                ) : (
                                  modelItems.map(item => (
                                    <div
                                      key={item.id}
                                      className={`p-3 rounded-xl border transition-all flex flex-col gap-3 ${item.isEnabled
                                        ? 'bg-surface border-border shadow-xs'
                                        : 'bg-bg/60 border-border/50 opacity-60'
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
                                              <h6 className="text-[11px] font-bold text-text-main leading-tight">{item.label}</h6>
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
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditItem(item)}
                                            className="p-1 text-text-muted hover:text-primary transition-colors rounded hover:bg-bg/80"
                                            title="Editar Ítem"
                                          >
                                            <Edit2 size={14} />
                                          </button>
                                          <span className="text-[9px] font-bold text-text-muted hidden sm:inline">{item.isEnabled ? 'Activo' : 'Inactivo'}</span>
                                          <button
                                            type="button"
                                            role="switch"
                                            onClick={() => onToggleItem(item.id, !item.isEnabled)}
                                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${item.isEnabled ? 'bg-emerald-500' : 'bg-border'}`}
                                          >
                                            <span
                                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${item.isEnabled ? 'translate-x-3' : 'translate-x-0'}`}
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
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
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
              {newItem.id ? 'Editar Ítem en:' : 'Nuevo Ítem en:'} {selectedModel?.name}
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
                  {newItem.id ? 'Guardar Cambios' : 'Agregar Ítem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}