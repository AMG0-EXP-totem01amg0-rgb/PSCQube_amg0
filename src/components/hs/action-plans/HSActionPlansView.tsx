import React, { useState } from 'react';
import { ActionPlanCard } from './ActionPlanCard';
import { ActionPlanModal } from './ActionPlanModal';
import { HSActionPlan, HSActionPlanStatus } from '../types';
import { Filter, CheckCircle2, Clock, AlertOctagon, X } from 'lucide-react';

interface HSActionPlansViewProps {
  actionPlans: HSActionPlan[];
  onUpdateStatus: (id: string, status: HSActionPlanStatus, assignedTo?: string, notes?: string) => void;
}

export function HSActionPlansView({ actionPlans, onUpdateStatus }: HSActionPlansViewProps) {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<HSActionPlan | null>(null);

  // ELEMENTO FICTICIO DE PRUEBA EN RESUELTOS PARA VER LA GRILLA CON MÁS DE UNO
  const mockResolvedPlan: HSActionPlan = {
    id: 'MOCK-001',
    title: 'Reemplazo de Manómetro y Prueba Hidrostática',
    description: 'Se realizó el cambio de manómetro defectuoso y prueba de presión exitosa.',
    status: 'RESOLVED',
    severity: 'MEDIUM',
    createdAt: '2026-08-12 09:30',
    dueDate: '2026-08-16',
    objectId: 'QR-EXT-005',
    objectName: 'Extintor PQS 10kg - Depósito Central',
    sectorName: 'Sector Logística',
    assignedTo: 'Carlos Gómez (Mantenimiento)',
    resolutionNotes: 'Prueba de presión aprobada. Habilitado para uso.',
  };

  const allPlansWithMock = [...actionPlans, mockResolvedPlan];

  // Filtrado por Fecha
  const filteredPlansByDate = allPlansWithMock.filter(plan =>
    !selectedDateFilter || plan.createdAt.startsWith(selectedDateFilter)
  );

  // Clasificación por columnas
  const criticalPlans = filteredPlansByDate.filter(p => p.status === 'OPEN');
  const inProgressPlans = filteredPlansByDate.filter(p => p.status === 'IN_PROGRESS');
  const resolvedPlans = filteredPlansByDate.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED');

  // Contadores
  const criticalCount = allPlansWithMock.filter(p => p.status === 'OPEN').length;
  const inProgressCount = allPlansWithMock.filter(p => p.status === 'IN_PROGRESS').length;
  const resolvedCount = allPlansWithMock.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED').length;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: HSActionPlanStatus) => {
    e.preventDefault();
    const planId = e.dataTransfer.getData('text/plain');
    if (!planId) return;

    const plan = allPlansWithMock.find(p => p.id === planId);
    if (!plan) return;

    if (targetStatus === 'RESOLVED') {
      const notas = prompt("Describa la solución aplicada para marcar el problema como RESUELTO:", "Elemento reparado/reemplazado y verificado en área.");
      if (notas !== null) {
        onUpdateStatus(planId, 'RESOLVED', plan.assignedTo, notas);
      }
    } else {
      onUpdateStatus(planId, targetStatus, plan.assignedTo, plan.resolutionNotes);
    }
  };

  // Alternar filtro exclusivo al pulsar la tarjeta KPI
  const handleKpiClick = (filterKey: string) => {
    if (selectedStatusFilter === filterKey) {
      setSelectedStatusFilter('ALL');
    } else {
      setSelectedStatusFilter(filterKey);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3 Tarjetas Resumen KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* CRÍTICOS */}
        <div
          onClick={() => handleKpiClick('CRITICAL')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${selectedStatusFilter === 'CRITICAL'
              ? 'border-rose-500 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.25)] ring-2 ring-rose-500'
              : 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
            }`}
        >
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
            <AlertOctagon size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase block">Críticos</span>
            <span className="text-base font-black text-rose-500">{criticalCount}</span>
          </div>
        </div>

        {/* EN PROCESO */}
        <div
          onClick={() => handleKpiClick('IN_PROGRESS')}
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
          onClick={() => handleKpiClick('RESOLVED')}
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

      {/* Filtros Avanzados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <span className="text-xs font-bold text-text-main">Filtros Avanzados:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="CRITICAL">Críticos</option>
            <option value="IN_PROGRESS">En Proceso</option>
            <option value="RESOLVED">Resueltos</option>
          </select>

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

      {/* VISTA A: SI FILTRÓ POR UN ESTADO ESPECÍFICO (Solo muestra las tarjetas de ese estado en Grilla de 3 columnas) */}
      {selectedStatusFilter !== 'ALL' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in pt-2">
          {selectedStatusFilter === 'CRITICAL' && criticalPlans.map(plan => (
            <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />
          ))}
          {selectedStatusFilter === 'IN_PROGRESS' && inProgressPlans.map(plan => (
            <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />
          ))}
          {selectedStatusFilter === 'RESOLVED' && resolvedPlans.map(plan => (
            <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />
          ))}
        </div>
      ) : (
        /* VISTA B: "TODOS LOS ESTADOS" (Tablero Kanban de 3 Columnas) */
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar animate-fade-in">

          {/* Columna Críticos */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'OPEN')}
            className="min-w-[320px] w-full flex-1 flex flex-col bg-surface border border-rose-500/20 rounded-2xl p-4 gap-3 shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-rose-500 uppercase tracking-wider">Críticos</h3>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">{criticalPlans.length}</span>
            </div>
            <div className="flex flex-col gap-3 min-h-[150px]">
              {criticalPlans.map(plan => <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />)}
              {criticalPlans.length === 0 && <div className="text-xs text-text-muted text-center py-8 border border-dashed border-border rounded-xl">Sin hallazgos críticos</div>}
            </div>
          </div>

          {/* Columna En Proceso */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
            className="min-w-[320px] w-full flex-1 flex flex-col bg-surface border border-amber-500/20 rounded-2xl p-4 gap-3 shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider">En Proceso</h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">{inProgressPlans.length}</span>
            </div>
            <div className="flex flex-col gap-3 min-h-[150px]">
              {inProgressPlans.map(plan => <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />)}
              {inProgressPlans.length === 0 && <div className="text-xs text-text-muted text-center py-8 border border-dashed border-border rounded-xl">Sin tareas en proceso</div>}
            </div>
          </div>

          {/* Columna Resueltos */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'RESOLVED')}
            className="min-w-[320px] w-full flex-1 flex flex-col bg-surface border border-emerald-500/30 rounded-2xl p-4 gap-3 shrink-0 bg-emerald-500/5"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-emerald-500 uppercase tracking-wider">Resueltos</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">{resolvedPlans.length}</span>
            </div>
            <div className="flex flex-col gap-3 min-h-[150px]">
              {resolvedPlans.map(plan => <ActionPlanCard key={plan.id} plan={plan} onOpenModal={setSelectedPlanForModal} />)}
              {resolvedPlans.length === 0 && <div className="text-xs text-text-muted text-center py-8 border border-dashed border-border rounded-xl">Arrastre una tarjeta aquí</div>}
            </div>
          </div>

        </div>
      )}

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