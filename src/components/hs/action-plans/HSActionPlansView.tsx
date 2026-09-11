import React, { useState, useMemo } from 'react';
import { ActionPlanModal } from './ActionPlanModal';
import { HSActionPlan, HSActionPlanStatus, HSInspection, HSObject, HSObjectType } from '../types';
import { Filter, CheckCircle2, Clock, AlertOctagon, X, ChevronDown, ChevronRight, Layers } from 'lucide-react';

interface HSActionPlansViewProps {
  actionPlans: HSActionPlan[];
  inspections?: HSInspection[];
  objects?: HSObject[];
  objectTypes?: HSObjectType[];
  onUpdateStatus: (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string, dueDate?: string) => void;
}

export function HSActionPlansView({ 
  actionPlans, 
  inspections = [], 
  objects = [], 
  objectTypes = [], 
  onUpdateStatus 
}: HSActionPlansViewProps) {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('OPEN'); // 'OPEN' is 'Sin Tratamiento'
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<HSActionPlan | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Filtrado por Fecha
  const filteredPlansByDate = actionPlans.filter(plan =>
    !selectedDateFilter || plan.createdAt.startsWith(selectedDateFilter)
  );

  // Clasificación por columnas
  const criticalPlans = filteredPlansByDate.filter(p => p.status === 'OPEN');
  const inProgressPlans = filteredPlansByDate.filter(p => p.status === 'IN_PROGRESS');
  const resolvedPlans = filteredPlansByDate.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED');

  // Contadores
  const criticalCount = actionPlans.filter(p => p.status === 'OPEN').length;
  const inProgressCount = actionPlans.filter(p => p.status === 'IN_PROGRESS').length;
  const resolvedCount = actionPlans.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED').length;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Función helper para agrupar planes
  const groupPlansByObject = (plansToGroup: HSActionPlan[]) => {
    const groups: Record<string, {
      objectTypeName: string;
      items: {
        objectId: string;
        objectName: string;
        sectorName: string;
        plans: HSActionPlan[];
        stats: { totalQuestions: number, bad: number, critical: number }
      }[]
    }> = {};

    plansToGroup.forEach(plan => {
      const obj = objects.find(o => o.id === plan.objectId);
      const typeId = obj?.typeId || 'UNKNOWN';
      const objectType = objectTypes.find(t => t.id === typeId);
      const objectTypeName = objectType ? objectType.name : 'Otros Elementos';

      if (!groups[typeId]) {
        groups[typeId] = { objectTypeName, items: [] };
      }

      let objectItem = groups[typeId].items.find(item => item.objectId === plan.objectId);
      
      if (!objectItem) {
        let totalQuestions = 0;
        let badCount = 0;
        let criticalCount = 0;

        if (plan.inspectionId) {
          const inspection = inspections.find(i => i.id === plan.inspectionId);
          if (inspection) {
            totalQuestions = inspection.answers.length;
            badCount = inspection.answers.filter(a => a.status === 'NO_OK').length;
            criticalCount = inspection.answers.filter(a => a.isCriticalFinding && a.status === 'NO_OK').length;
          }
        }

        objectItem = {
          objectId: plan.objectId,
          objectName: plan.objectName,
          sectorName: plan.sectorName,
          plans: [],
          stats: { totalQuestions, bad: badCount, critical: criticalCount }
        };
        groups[typeId].items.push(objectItem);
      }

      objectItem.plans.push(plan);
    });

    return groups;
  };

  // Lógica para Agrupación
  const groupedCriticalPlans = useMemo(() => groupPlansByObject(criticalPlans), [criticalPlans, objects, objectTypes, inspections]);
  const groupedInProgressPlans = useMemo(() => groupPlansByObject(inProgressPlans), [inProgressPlans, objects, objectTypes, inspections]);


  // Componente interno para renderizar las filas de una tabla
  const renderTableRows = (plans: HSActionPlan[]) => (
    <table className="w-full text-left text-xs bg-surface">
      <thead className="bg-bg/50 text-text-muted border-b border-border">
        <tr>
          <th className="py-3 px-4 font-black uppercase tracking-wider">Plan / Tarea</th>
          <th className="py-3 px-4 font-black uppercase tracking-wider">Ubicación</th>
          <th className="py-3 px-4 font-black uppercase tracking-wider">Responsable</th>
          <th className="py-3 px-4 font-black uppercase tracking-wider">Fecha Límite</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {plans.map(plan => (
          <tr 
            key={plan.id} 
            onClick={() => setSelectedPlanForModal(plan)}
            className="hover:bg-bg/40 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-main line-clamp-1">{plan.title}</span>
                  {plan.severity === 'CRITICAL' && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-black uppercase tracking-wider">
                      Crítico
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-text-muted line-clamp-1">{plan.description}</span>
              </div>
            </td>
            <td className="py-3 px-4 text-text-muted">
              <span className="block font-medium text-text-main line-clamp-1">{plan.objectName}</span>
              <span className="text-[10px] line-clamp-1">{plan.sectorName}</span>
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center gap-1.5 text-text-muted font-medium bg-bg px-2 py-1 rounded-md border border-border">
                {plan.assignedTo || 'Sin asignar'}
              </span>
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center gap-1.5 font-mono text-text-main font-bold">
                <Clock size={12} className="text-primary"/> {plan.dueDate || 'No definida'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );


  return (
    <div className="space-y-4">
      {/* 3 Tarjetas Resumen KPI para Navegación Principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* SIN TRATAMIENTO (OPEN) */}
        <div
          onClick={() => setSelectedStatusFilter('OPEN')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${selectedStatusFilter === 'OPEN'
              ? 'border-rose-500 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.25)] ring-2 ring-rose-500'
              : 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
            }`}
        >
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
            <AlertOctagon size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Sin Tratamiento</span>
            <span className="text-base font-black text-rose-500">{criticalCount}</span>
          </div>
        </div>

        {/* EN PROCESO */}
        <div
          onClick={() => setSelectedStatusFilter('IN_PROGRESS')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${selectedStatusFilter === 'IN_PROGRESS'
              ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-2 ring-amber-500'
              : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
            }`}
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">En Proceso</span>
            <span className="text-base font-black text-amber-500">{inProgressCount}</span>
          </div>
        </div>

        {/* RESUELTOS */}
        <div
          onClick={() => setSelectedStatusFilter('RESOLVED')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${selectedStatusFilter === 'RESOLVED'
              ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500'
              : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
            }`}
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Resueltos</span>
            <span className="text-base font-black text-emerald-500">{resolvedCount}</span>
          </div>
        </div>
      </div>

      {/* Solo mostramos Filtro de Fecha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <span className="text-xs font-bold text-text-main">
            Filtrar Planes en estado: <strong className={
              selectedStatusFilter === 'OPEN' ? 'text-rose-500' :
              selectedStatusFilter === 'IN_PROGRESS' ? 'text-amber-500' : 'text-emerald-500'
            }>
              {selectedStatusFilter === 'OPEN' && 'Sin Tratamiento'}
              {selectedStatusFilter === 'IN_PROGRESS' && 'En Proceso'}
              {selectedStatusFilter === 'RESOLVED' && 'Resueltos'}
            </strong>
          </span>
        </div>

        <div className="flex items-center">
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
            />
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter('')}
                className="ml-1 p-1 text-text-muted hover:text-rose-500 transition-colors"
                title="Limpiar fecha"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>


      {/* CONTENIDO DE TABLAS SEGÚN ESTADO SELECCIONADO */}
      <div className="animate-fade-in pt-0">
        
        {/* VISTA: SIN TRATAMIENTO (Agrupado) */}
        {selectedStatusFilter === 'OPEN' && (
          <div className="space-y-4">
            {Object.keys(groupedCriticalPlans).length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs bg-surface border border-border rounded-xl">
                No hay planes de acción sin tratamiento para esta fecha.
              </div>
            ) : (
              Object.entries(groupedCriticalPlans).map(([typeId, group]) => (
                <div key={typeId} className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
                  {/* Cabecera del Tipo de Objeto */}
                  <div className="bg-bg/80 px-4 py-3 border-b border-border flex items-center gap-2">
                    <Layers size={16} className="text-primary" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-wider">{group.objectTypeName}</h3>
                  </div>

                  {/* Lista de Objetos con fallas */}
                  <div className="divide-y divide-border">
                    {group.items.map(objectItem => {
                      const isExpanded = expandedGroups[objectItem.objectId];
                      
                      return (
                        <div key={objectItem.objectId} className="flex flex-col">
                          {/* Fila del Objeto (Expandible) */}
                          <div 
                            onClick={() => toggleGroup(objectItem.objectId)}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-bg/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <button className="p-1 rounded bg-bg border border-border text-text-muted">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <div>
                                <h4 className="text-xs font-bold text-text-main">{objectItem.objectName}</h4>
                                <span className="text-[10px] text-text-muted">{objectItem.sectorName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                {objectItem.stats.bad} Hallazgos ({objectItem.stats.critical} Críticos)
                              </span>
                            </div>
                          </div>

                          {/* Tabla de Tareas (Mostrada si expandido) */}
                          {isExpanded && (
                            <div className="border-t border-border bg-bg/20 p-2">
                              {renderTableRows(objectItem.plans)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA: EN PROCESO (Agrupado) */}
        {selectedStatusFilter === 'IN_PROGRESS' && (
          <div className="space-y-4">
            {Object.keys(groupedInProgressPlans).length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs bg-surface border border-border rounded-xl">
                No hay planes de acción en proceso para esta fecha.
              </div>
            ) : (
              Object.entries(groupedInProgressPlans).map(([typeId, group]) => (
                <div key={typeId} className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
                  {/* Cabecera del Tipo de Objeto */}
                  <div className="bg-bg/80 px-4 py-3 border-b border-border flex items-center gap-2">
                    <Layers size={16} className="text-primary" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-wider">{group.objectTypeName}</h3>
                  </div>

                  {/* Lista de Objetos con fallas */}
                  <div className="divide-y divide-border">
                    {group.items.map(objectItem => {
                      const isExpanded = expandedGroups[objectItem.objectId];
                      
                      return (
                        <div key={objectItem.objectId} className="flex flex-col">
                          {/* Fila del Objeto (Expandible) */}
                          <div 
                            onClick={() => toggleGroup(objectItem.objectId)}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-bg/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <button className="p-1 rounded bg-bg border border-border text-text-muted">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <div>
                                <h4 className="text-xs font-bold text-text-main">{objectItem.objectName}</h4>
                                <span className="text-[10px] text-text-muted">{objectItem.sectorName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                {objectItem.plans.length} Tareas Pendientes
                              </span>
                            </div>
                          </div>

                          {/* Tabla de Tareas (Mostrada si expandido) */}
                          {isExpanded && (
                            <div className="border-t border-border bg-bg/20 p-2">
                              {renderTableRows(objectItem.plans)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA: RESUELTOS (Sin Agrupar) */}
        {selectedStatusFilter === 'RESOLVED' && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
            {resolvedPlans.length > 0 ? (
              renderTableRows(resolvedPlans)
            ) : (
              <div className="p-8 text-center text-text-muted text-xs">
                No hay planes de acción resueltos para esta fecha.
              </div>
            )}
          </div>
        )}

      </div>


      {/* Modal de edición */}
      {selectedPlanForModal && (
        <ActionPlanModal
          plan={selectedPlanForModal}
          onClose={() => setSelectedPlanForModal(null)}
          onUpdateStatus={onUpdateStatus}
        />
      )}
    </div>
  );
}