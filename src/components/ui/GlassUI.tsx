import React from 'react';
import { cn } from '../../lib/utils';

export function GlassCard({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ui-card p-6 md:p-8", className)} {...props}>
      {children}
    </div>
  );
}

export function GlassInput({ label, className, ...props }: any) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs font-semibold text-text-muted ml-0.5">{label}</label>
      <input 
        className={cn(
          "h-11 bg-bg-input text-sm border-border text-text-main placeholder:text-text-muted/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/5 transition-all rounded-lg px-3.5 border outline-none",
          className
        )} 
        {...props} 
      />
    </div>
  );
}

export function GlassSelect({ label, options, className, ...props }: any) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs font-semibold text-text-muted ml-0.5">{label}</label>
      <select 
        className={cn(
          "h-11 bg-bg-input text-sm border-border text-text-main focus:border-primary/50 focus:ring-2 focus:ring-primary/5 transition-all rounded-lg px-3.5 border appearance-none outline-none disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )} 
        {...props}
      >
        <option value="" className="bg-bg-input">Seleccionar...</option>
        {options.map((o: any) => <option key={o.value} value={o.value} className="bg-bg-input">{o.label}</option>)}
      </select>
    </div>
  );
}

export function GlassButton({ children, className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors",
    secondary: "bg-surface text-text-main hover:bg-bg border border-border",
    danger: "bg-red-600 text-white hover:bg-red-500"
  };

  return (
    <button 
      className={cn(
        "h-11 px-6 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2",
        variants[variant],
        className
      )} 
      {...props}
    >
      {children}
    </button>
  );
}

export function KPICircle({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500',
    indigo: 'text-primary',
    orange: 'text-orange-500'
  };

  return (
    <div className={cn("kpi-card-gradient p-5 rounded-2xl flex flex-col items-center justify-center text-center min-w-[124px]", colors[color] || 'text-text-main')}>
       <div className="text-3xl font-black tracking-tighter tabular-nums">
         {value.toFixed(1)}%
       </div>
       <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60 text-text-muted">{label}</div>
    </div>
  );
}

import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-lg bg-surface border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden pointer-events-auto",
                className
              )}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <h3 className="text-xl font-bold text-text-main">{title}</h3>
                  <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main transition-colors bg-bg/50 rounded-lg">
                    <X size={20} />
                  </button>
                </div>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Eliminar", 
  cancelLabel = "Cancelar" 
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden pointer-events-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle size={24} />
                  </div>
                  <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-text-main mb-2">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-8">{message}</p>
                
                <div className="flex gap-3">
                  <GlassButton 
                    variant="secondary" 
                    className="flex-1" 
                    onClick={onClose}
                  >
                    {cancelLabel}
                  </GlassButton>
                  <GlassButton 
                    variant="danger" 
                    className="flex-1" 
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                  >
                    {confirmLabel}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
