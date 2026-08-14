import React, { useState } from 'react';
import { ShieldAlert, QrCode, MapPin, ListChecks } from 'lucide-react';
import { ObjectTypesMaster } from './ObjectTypesMaster';
import { ObjectsMaster } from './ObjectsMaster';
import { SectorsMaster } from './SectorsMaster';
import { ChecklistConfigurator } from './ChecklistConfigurator';
import { HSObjectType, HSSector, HSObject, HSChecklistItem } from '../types';

interface HSAdminViewProps {
  objectTypes: HSObjectType[];
  sectors: HSSector[];
  objects: HSObject[];
  checklistItems: HSChecklistItem[];
  onSaveObjectType: (item: Partial<HSObjectType>) => void;
  onSaveSector: (item: Partial<HSSector>) => void;
  onSaveObject: (item: Partial<HSObject>) => void;
  onToggleChecklistItem: (id: string, isEnabled: boolean) => void;
  onAddChecklistItem: (item: Partial<HSChecklistItem>) => void;
}

type AdminSubTab = 'TYPES' | 'OBJECTS' | 'SECTORS' | 'CHECKLISTS';

export function HSAdminView({
  objectTypes,
  sectors,
  objects,
  checklistItems,
  onSaveObjectType,
  onSaveSector,
  onSaveObject,
  onToggleChecklistItem,
  onAddChecklistItem
}: HSAdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminSubTab>('OBJECTS');

  const subTabs = [
    { id: 'OBJECTS', label: 'Objetos con QR', icon: <QrCode size={14} />, count: objects.length },
    { id: 'TYPES', label: 'Tipos de Objeto', icon: <ShieldAlert size={14} />, count: objectTypes.length },
    { id: 'SECTORS', label: 'Sectores', icon: <MapPin size={14} />, count: sectors.length },
    { id: 'CHECKLISTS', label: 'Checklists Dinámicos', icon: <ListChecks size={14} />, count: checklistItems.length }
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
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg'
              }`}
            >
              {st.icon}
              <span>{st.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                isActive ? 'bg-white/20 text-white' : 'bg-bg text-text-muted border border-border'
              }`}>
                {st.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vistas según SubTab */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
        {activeTab === 'OBJECTS' && (
          <ObjectsMaster
            objects={objects}
            objectTypes={objectTypes}
            sectors={sectors}
            onSave={onSaveObject}
          />
        )}

        {activeTab === 'TYPES' && (
          <ObjectTypesMaster
            objectTypes={objectTypes}
            onSave={onSaveObjectType}
          />
        )}

        {activeTab === 'SECTORS' && (
          <SectorsMaster
            sectors={sectors}
            onSave={onSaveSector}
          />
        )}

        {activeTab === 'CHECKLISTS' && (
          <ChecklistConfigurator
            objectTypes={objectTypes}
            checklistItems={checklistItems}
            onToggleItem={onToggleChecklistItem}
            onAddItem={onAddChecklistItem}
          />
        )}
      </div>
    </div>
  );
}
