import React from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string; // Classes for header
  cellClassName?: string; // Classes for cell
  align?: 'left' | 'center' | 'right';
}

export function TableActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {onEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-90 border border-primary/20"
          title="Editar"
        >
          <Pencil size={12} />
        </button>
      )}
      {onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all active:scale-90 border border-danger/20"
          title="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  countLabel?: string;
  onAddClick?: () => void;
  addLabel?: string;
  emptyState?: {
    icon: React.ReactNode;
    title: string;
    description?: string;
  };
  rowClassName?: string | ((row: T) => string);
  keyExtractor?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  data,
  title,
  countLabel,
  onAddClick,
  addLabel = "Nuevo registro",
  emptyState,
  rowClassName,
  keyExtractor = (row: any) => row.id
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {(title || onAddClick) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
             {title && <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">{title}</h4>}
             {countLabel && (
               <span className="px-2 py-0.5 rounded-full bg-surface text-text-muted text-[9px] font-bold border border-border uppercase tracking-tighter shadow-sm">
                 {data.length} {countLabel}
               </span>
             )}
          </div>
          {onAddClick && (
            <button 
              onClick={onAddClick}
              className="group flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-primary/20 active:scale-95 shadow-sm w-full sm:w-auto"
            >
              <PlusCircle size={14} className="group-hover:rotate-90 transition-transform" />
              {addLabel}
            </button>
          )}
        </div>
      )}

      <div className="bg-surface-elevated rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg/40 border-b border-border">
                {columns.map((col, idx) => (
                  <th 
                    key={idx} 
                    className={cn(
                      "p-4 text-[10px] font-bold text-text-muted uppercase tracking-[0.15em]",
                      col.align === 'center' && "text-center",
                      col.align === 'right' && "text-right",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <AnimatePresence mode="popLayout">
                {data.length > 0 ? data.map((row) => (
                  <motion.tr 
                    layout
                    key={keyExtractor(row)} 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className={cn(
                      "transition-all group hover:bg-bg/40 h-14",
                      typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
                    )}
                  >
                  {columns.map((col, cIdx) => (
                    <td 
                      key={cIdx} 
                      className={cn(
                        "px-4 py-2 align-middle",
                        col.align === 'center' && "text-center",
                        col.align === 'right' && "text-right",
                        col.cellClassName
                      )}
                    >
                      {typeof col.accessor === 'function' 
                        ? col.accessor(row) 
                        : (row as any)[col.accessor as string]}
                    </td>
                  ))}
                </motion.tr>
              )) : (
                <tr>
                  <td colSpan={columns.length} className="p-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      {emptyState?.icon && <div className="mb-4 text-text-muted scale-125 opacity-30">{emptyState.icon}</div>}
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                        {emptyState?.title || 'No hay registros'}
                      </p>
                      {emptyState?.description && (
                        <p className="text-[10px] text-text-muted mt-2 font-medium uppercase tracking-tight opacity-50">
                          {emptyState.description}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
   </div>
  );
}
