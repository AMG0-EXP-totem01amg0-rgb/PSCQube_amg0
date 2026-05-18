import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Factory, ChevronDown, Bot, AlertTriangle, Package, Settings, 
  ShieldCheck, Leaf, Users, Sun, Moon, Home, X, Filter, 
  ChevronUp, Calendar, LogOut, User as UserIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Machine } from '../../types';

interface HeaderProps {
  palletizers: Machine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  shifts: any[];
  selectedShiftId: string | null;
  onShiftSelect: (id: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export function Header({ 
  palletizers, 
  selectedId, 
  onSelect, 
  shifts, 
  selectedShiftId, 
  onShiftSelect,
  selectedDate,
  onDateChange,
  isDark,
  toggleTheme
}: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const selected = palletizers.find(p => p.id === selectedId);
  const selectedShift = shifts.find(s => s.id === selectedShiftId);

  const handleDateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const input = dateInputRef.current;
    if (!input) return;

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch {
      input.focus();
      input.click();
    }
  };

  // Parse date for display
  const displayDate = React.useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Handle Orientation/Resize - Expand if moving to landscape/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640 && isCollapsed) {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  return (
    <header className={cn(
      "sticky top-0 left-0 right-0 z-[100] bg-surface header-gradient border-b border-border shadow-sm transition-[height] duration-300 ease-out will-change-[height] transform-gpu",
      isCollapsed ? "h-14 sm:h-16" : "h-auto sm:h-16"
    )}>
      <div className="flex flex-col sm:flex-row sm:h-16 h-full px-4 md:px-8 py-2 sm:py-0">
        
        {/* Row 1: Always Visible */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-6 h-10 sm:h-16 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h1 className={cn(
                "font-black uppercase tracking-tighter leading-none transition-all logo-glow text-text-main",
                isCollapsed ? "text-base" : "text-lg md:text-xl"
              )}>
                PSCQube
              </h1>
               {!isCollapsed && (
                <div className="mt-0.5 relative group">
                  <button 
                    type="button"
                    onClick={handleDateClick}
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all hover:bg-primary/5 active:bg-primary/10 border-none outline-none group"
                  >
                    <Calendar size={10} className="text-text-main group-hover:text-primary transition-colors" />
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider group-hover:text-primary whitespace-nowrap">{displayDate}</span>
                  </button>
                  {/* Hidden Input for Calendar Triggering */}
                  <input 
                    ref={dateInputRef}
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="absolute opacity-0 pointer-events-none -z-10"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              )}
            </div>
            
            {/* Small indicator of current shift when collapsed */}
            {isCollapsed && (
              <div className="sm:hidden px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                <span className="text-[8px] font-black text-primary uppercase">{selectedShift?.name || 'T1'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
             {/* Simple Theme Toggle Always Row 1 */}
            <button 
              onClick={toggleTheme}
              className="sm:hidden p-1.5 rounded-full hover:bg-bg transition-colors text-text-main"
            >
              {isDark ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-primary" />}
            </button>

            {/* EXPAND/COLLAPSE TOGGLE (Mobile only) - Strictly Manual */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="sm:hidden p-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary shadow-sm active:scale-95 transition-transform"
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Expandable Rows 2 & 3 (Mobile) / Desktop Items */}
        <AnimatePresence>
          {(!isCollapsed || window.innerWidth >= 640) && (
            <motion.div 
              initial={window.innerWidth < 640 ? { opacity: 0, y: -10 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1 sm:justify-end pb-2 sm:pb-0"
            >
              {/* Shift Selector */}
              <div className="bg-bg p-1 rounded-full border border-border flex items-center h-10 sm:h-10 shrink-0">
                {shifts.map(s => {
                  const isActive = s.id === selectedShiftId;
                  const shiftLabels: Record<string, string> = { 'T1': 'MAÑ', 'T2': 'TAR', 'T3': 'NOC' };
                  return (
                    <button
                      key={s.id}
                      onClick={() => onShiftSelect(s.id)}
                      className={cn(
                        "flex-1 sm:flex-none px-4 sm:px-3 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        isActive 
                          ? "btn-active-highlight" 
                          : "text-text-muted hover:text-text-main"
                      )}
                    >
                      {shiftLabels[s.name] || s.name}
                    </button>
                  );
                })}
              </div>

              {/* Machine Selector - Fixed Dropdown Context */}
              <div className="relative shrink-0 sm:shrink-0 sm:min-w-[180px]">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={cn(
                    "h-10 px-4 bg-bg rounded-full flex items-center justify-between gap-3 border border-border transition-all w-full",
                    isDropdownOpen ? "border-primary shadow-lg ring-2 ring-primary/10" : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Factory size={14} className="text-text-main shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-main truncate">
                      {selected?.name || 'Máquina'}
                    </span>
                  </div>
                  <ChevronDown size={14} className={cn("text-text-muted transition-transform duration-300 shrink-0", isDropdownOpen && "rotate-180")} />
                </button>
                
                {/* Anchored Dropdown (Not Bottom Sheet) */}
                <AnimatePresence>
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setIsDropdownOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 8, scale: 0.98 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute top-full left-0 right-0 mt-2 z-[70] bg-surface-elevated rounded-2xl p-2 shadow-2xl border border-border sm:w-64 max-h-[280px] overflow-y-auto"
                      >
                        {palletizers.map(p => (
                          <button 
                            key={p.id} 
                            onClick={() => { onSelect(p.id); setIsDropdownOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mb-1", 
                              p.id === selectedId 
                                ? "bg-primary text-white shadow-sm" 
                                : "hover:bg-bg text-text-muted hover:text-text-main"
                            )}
                          >
                            {p.name}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Toggle - Desktop */}
              <button 
                onClick={toggleTheme}
                className="hidden sm:flex p-2 rounded-full hover:bg-bg transition-colors text-text-main hover:text-primary shrink-0 ml-2"
              >
                {isDark ? <Sun size={18} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" /> : <Moon size={18} className="text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export function BottomNav({ activeSection, onSectionChange }: { activeSection: string; onSectionChange: (s: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const allSections = [
    { id: 'PRODUCTIVITY', label: 'PRODUCTIVIDAD', icon: <Bot size={22} /> },
    { id: 'SAFETY', label: 'H&S', icon: <ShieldCheck size={22} /> },
    { id: 'ENVIRONMENT', label: 'MEDIO AMBIENTE', icon: <Leaf size={22} /> },
    { id: 'HR', label: 'CAPITAL HUMANO', icon: <Users size={22} /> },
    { id: 'ADMIN', label: 'MAESTROS', icon: <Settings size={22} /> }
  ];

  const handleSelect = (id: string) => {
    onSectionChange(id);
    setIsOpen(false);
  };

  const handleLogout = () => {
    // Future structure for Clerk signOut()
    console.log('Cerrando sesión...');
    window.location.reload(); // Temporary simulated logout
  };

  return (
    <>
      {/* Click Outside Backdrop - Moved outside transform container to fix viewport reference */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[3px] z-[150] pointer-events-auto"
            onClick={() => {
              setIsOpen(false);
              setIsUserMenuOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[160] flex items-center justify-center pointer-events-none w-full px-6">
        <div className="relative flex items-center justify-center pointer-events-auto w-full max-w-sm">
          <AnimatePresence>
            {isOpen && (
              <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "absolute bottom-full mb-4 left-1/2 -translate-x-1/2",
                "bg-surface-elevated/95 backdrop-blur-xl border border-border shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                "rounded-[2.5rem] p-6 w-[320px] sm:w-[420px] z-[160] overflow-hidden flex flex-col"
              )}
            >
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-6 text-center opacity-50">Menú Principal</h4>
              
              <div className="grid grid-cols-3 gap-y-7 gap-x-3 mb-6">
                {allSections.map((section, idx) => (
                  <motion.button
                    key={section.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelect(section.id)}
                    className="flex flex-col items-center gap-2.5 group relative"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 ring-2 ring-transparent",
                      activeSection === section.id 
                        ? "bg-primary text-white shadow-[0_5px_15px_rgba(0,85,150,0.4)] ring-primary/20 scale-110" 
                        : "bg-surface text-text-muted group-hover:bg-surface-elevated group-hover:text-primary group-hover:scale-105 active:scale-95"
                    )}>
                      {React.cloneElement(section.icon as React.ReactElement, { size: 18 })}
                    </div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-wider text-center transition-colors px-1",
                      activeSection === section.id ? "text-primary" : "text-text-muted group-hover:text-text-main"
                    )}>
                      {section.label}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* User Section - Footer of the Menu */}
              <div className="mt-auto border-t border-border pt-5 -mx-2">
                <div className="px-4">
                  <AnimatePresence mode="wait">
                    {!isUserMenuOpen ? (
                      <motion.button
                        key="user-info"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        onClick={() => setIsUserMenuOpen(true)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-bg/50 hover:bg-bg transition-colors group border border-border/50"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm overflow-hidden shrink-0">
                          <UserIcon size={18} />
                        </div>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-text-main truncate w-full text-left uppercase tracking-tight leading-none mb-0.5">Operador Holcim</span>
                          <span className="text-[8px] font-medium text-text-muted truncate w-full text-left opacity-70">joni0627@gmail.com</span>
                        </div>
                        <ChevronDown size={12} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
                      </motion.button>
                    ) : (
                      <motion.div
                        key="user-actions"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-2"
                      >
                         <button 
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full h-10 px-4 flex items-center gap-3 text-text-muted hover:text-text-main transition-colors text-[9px] font-bold uppercase tracking-widest"
                        >
                          <ChevronUp size={12} />
                          Volver al Menú
                        </button>
                        <button 
                          onClick={handleLogout}
                          className="w-full h-10 px-4 flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all text-[9px] font-black uppercase tracking-[0.2em] group"
                        >
                          <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
                          Cerrar Sesión
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 z-[110]",
            isOpen 
              ? "bg-surface text-primary border border-border rotate-90" 
              : "bg-primary text-white hover:bg-primary-hover hover:scale-105"
          )}
        >
          {isOpen ? <X size={24} /> : <Home size={24} />}
        </motion.button>
      </div>
    </div>
  </>
);
}
