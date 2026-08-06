import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  key?: React.Key;
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const borders = {
    success: 'border-emerald-500/20 bg-emerald-950/20 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300',
    error: 'border-rose-500/20 bg-rose-950/20 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300',
    warning: 'border-amber-500/20 bg-amber-950/20 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300',
    info: 'border-blue-500/20 bg-blue-950/20 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto max-w-sm w-full select-none",
        borders[toast.type]
      )}
    >
      <div className="flex-none">{icons[toast.type]}</div>
      <div className="flex-grow text-xs font-semibold leading-relaxed">
        {toast.message}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-none p-1 rounded-lg hover:bg-neutral-800/10 dark:hover:bg-white/10 transition-colors text-current opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}
