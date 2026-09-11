import React, { useState } from 'react';
import { ShieldAlert, QrCode, MapPin, ListChecks } from 'lucide-react';
import { ObjectTypesMaster } from './ObjectTypesMaster';
import { ObjectsMaster } from './ObjectsMaster';
import { SectorsMaster } from './SectorsMaster';
import { ChecklistConfigurator } from './ChecklistConfigurator';
import { HSObjectType, HSSector, HSObject, HSChecklistItem, HSChecklistModel } from '../types';

interface HSAdminViewProps {
  objectTypes: HSObjectType[];
  sectors: HSSector[];
  objects: HSObject[];
  checklistModels: HSChecklistModel[];
  checklistItems: HSChecklistItem[];
  onSaveObjectType: (item: Partial<HSObjectType>) => void;
  onSaveSector: (item: Partial<HSSector>) => void;
  onSaveObject: (item: Partial<HSObject>) => void;
  onAddChecklistModel: (item: Partial<HSChecklistModel>) => void;
  onToggleChecklistItem: (id: string, isEnabled: boolean) => void;
  onAddChecklistItem: (item: Partial<HSChecklistItem>) => void;
  onMigrateOrphanedItems?: (modelId: string, objectTypeId: string) => void;
  onDeleteSector?: (id: string) => void;
  onDeleteObject?: (id: string) => void;
  onDeleteObjectType?: (id: string) => void;
}

type AdminSubTab = 'SECTORS' | 'TYPES' | 'OBJECTS' | 'CHECKLISTS';

export function HSAdminView({
  objectTypes,
  sectors,
  objects,
  checklistModels,
  checklistItems,
  onSaveObjectType,
  onSaveSector,
  onSaveObject,
  onAddChecklistModel,
  onToggleChecklistItem,
  onAddChecklistItem,
  onMigrateOrphanedItems,
  onDeleteSector,
  onDeleteObject,
  onDeleteObjectType
}: HSAdminViewProps) {
  // Orden jerárquico: Sectores primero
  const [activeTab, setActiveTab] = useState<AdminSubTab>('SECTORS');

  const subTabs = [
    { id: 'SECTORS', label: 'Sectores / Áreas', icon: <MapPin size={14} />, count: sectors.length },
    { id: 'TYPES', label: 'Tipos de Objeto', icon: <ShieldAlert size={14} />, count: objectTypes.length },
    { id: 'OBJECTS', label: 'Puntos de Inspección', icon: <QrCode size={14} />, count: objects.length },
    { id: 'CHECKLISTS', label: 'Checklists', icon: <ListChecks size={14} />, count: checklistItems.length }
  ] as const;

  return (
    <div className="space-y-4">
      {/* Sub-navegación de Administración */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-surface border border-border scrollbar-thin">
        {subTabs.map(st => {
          const isActive = activeTab === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setActiveTab(st.id as AdminSubTab)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-bg'
                }`}
            >
              {st.icon}
              <span>{st.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-bg text-text-muted border border-border'
                }`}>
                {st.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vistas según SubTab */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
        {activeTab === 'SECTORS' && (
          <SectorsMaster
            sectors={sectors}
            onSave={onSaveSector}
            onDelete={onDeleteSector}
          />
        )}

        {activeTab === 'TYPES' && (
          <ObjectTypesMaster
            objectTypes={objectTypes}
            onSave={onSaveObjectType}
            onDelete={onDeleteObjectType}
          />
        )}

        {activeTab === 'OBJECTS' && (
          <ObjectsMaster
            objects={objects}
            objectTypes={objectTypes}
            sectors={sectors}
            onSave={onSaveObject}
            onDelete={onDeleteObject}
          />
        )}

        {activeTab === 'CHECKLISTS' && (
          <ChecklistConfigurator
            objectTypes={objectTypes}
            checklistModels={checklistModels}
            checklistItems={checklistItems}
            onToggleItem={onToggleChecklistItem}
            onAddItem={onAddChecklistItem}
            onAddModel={onAddChecklistModel}
            onMigrateOrphanedItems={onMigrateOrphanedItems}
          />
        )}
      </div>
    </div>
  );
}
