import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Factory, ChevronDown, Bot, AlertTriangle, Package, Settings, 
  ShieldCheck, Leaf, Users, Sun, Moon, Home, X, Filter, 
  ChevronUp, Calendar, LogOut, User as UserIcon,
  Bell, CheckCheck, Beaker, AlertCircle, Info, RotateCw, RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Machine, AlertNotification, AppUser } from '../../types';

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
  currentUser: AppUser;
  notifications: AlertNotification[];
  readNotificationKeys: string[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: (ids: string[]) => void;
  onNavigateToChange: () => void;
  onRefreshCurrentFilters?: () => void;
  activeSection?: string;
}

interface NotificationBellDropdownProps {
  currentUser: AppUser;
  notifications: AlertNotification[];
  readNotificationKeys: string[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: (ids: string[]) => void;
  onNavigateToChange: () => void;
}

export function NotificationBellDropdown({
  currentUser,
  notifications,
  readNotificationKeys,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToChange
}: NotificationBellDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLabUser = currentUser.profile === 'Laboratorio' || currentUser.position === 'Laboratórista' || currentUser.position === 'Laboratorista';
  const isMaquinista = currentUser.profile === 'Operario' || currentUser.position === 'Operario Maquinista';
  const isAdmin = currentUser.profile === 'Administrador';

  const userNotifications = React.useMemo(() => {
    return notifications.filter(n => {
      const isRelevant = (n.targetProfile === 'Laboratorio' && (isLabUser || isAdmin)) ||
                         (n.targetProfile === 'Operario' && (isMaquinista || isAdmin));
      return isRelevant;
    });
  }, [notifications, currentUser, isLabUser, isMaquinista, isAdmin]);

  const unreadNotifications = React.useMemo(() => {
    return userNotifications.filter(n => {
      const isRead = readNotificationKeys.includes(n.id) ||
                     readNotificationKeys.includes(`${currentUser.dni}-${n.id}`) ||
                     (currentUser.email && readNotificationKeys.includes(`${currentUser.email}-${n.id}`)) ||
                     (currentUser.sapUser && readNotificationKeys.includes(`${currentUser.sapUser}-${n.id}`));
      return !isRead;
    });
  }, [userNotifications, readNotificationKeys, currentUser.dni, currentUser.email, currentUser.sapUser]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleItemClick = (n: AlertNotification) => {
    onMarkAsRead(n.id);
    onNavigateToChange();
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0 flex items-center" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative p-1.5 sm:p-2 rounded-full hover:bg-bg transition-all text-text-main hover:text-primary shrink-0 active:scale-95"
        title="Notificaciones"
      >
        <Bell size={18} className={unreadNotifications.length > 0 ? "animate-bounce" : ""} />
        {unreadNotifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-surface">
            {unreadNotifications.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed sm:absolute top-16 sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:mt-3 w-auto sm:w-96 rounded-2xl border border-border bg-surface-elevated p-3 shadow-2xl z-[120] max-h-[80vh] sm:max-h-[500px] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-text-main">
                  Notificaciones
                </span>
                {unreadNotifications.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-full">
                    {unreadNotifications.length} nueva{unreadNotifications.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {unreadNotifications.length > 0 && (
                <button
                  onClick={() => onMarkAllAsRead(unreadNotifications.map(n => n.id))}
                  className="text-[9px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none"
                >
                  <CheckCheck size={12} /> Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-[300px] sm:max-h-[380px] overflow-y-auto space-y-2 pr-0.5 scrollbar-thin flex-1">
              {userNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-bg/50 border border-border flex items-center justify-center text-text-muted mb-2.5">
                    <Info size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sin Alertas</span>
                  <p className="text-[9px] text-text-muted mt-1 opacity-70">No hay eventos recientes de Cambio de Producto.</p>
                </div>
              ) : (
                userNotifications.map(n => {
                  const isUnread = !(
                    readNotificationKeys.includes(n.id) ||
                    readNotificationKeys.includes(`${currentUser.dni}-${n.id}`) ||
                    (currentUser.email && readNotificationKeys.includes(`${currentUser.email}-${n.id}`)) ||
                    (currentUser.sapUser && readNotificationKeys.includes(`${currentUser.sapUser}-${n.id}`))
                  );
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "relative flex items-start gap-3 p-2.5 rounded-xl border border-transparent transition-all cursor-pointer group hover:border-border hover:bg-bg/40",
                        isUnread ? "bg-primary/5 border-primary/10 shadow-sm animate-pulse-subtle" : "opacity-75"
                      )}
                      onClick={() => handleItemClick(n)}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-white",
                        n.type === 'NEW_PRODUCT_CHANGE' 
                          ? "bg-amber-500 shadow-sm" 
                          : n.title.includes('Rechazado') ? "bg-red-500 shadow-sm" : "bg-emerald-500 shadow-sm"
                      )}>
                        {n.type === 'NEW_PRODUCT_CHANGE' ? <Beaker size={14} /> : <CheckCheck size={14} />}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[10.5px] font-black text-text-main leading-tight truncate">
                            {n.title}
                          </span>
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[9.5px] text-text-muted font-medium leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[8px] font-bold text-text-muted opacity-55 uppercase tracking-wider block mt-1">
                          {n.date}
                        </span>
                      </div>

                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(n.id);
                          }}
                          className="absolute right-2 top-2 p-1 text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100 bg-transparent border-none"
                          title="Marcar como leída"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  toggleTheme,
  currentUser,
  notifications,
  readNotificationKeys,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToChange,
  onRefreshCurrentFilters,
  activeSection
}: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const selected = palletizers.find(p => p.id === selectedId);
  const selectedShift = shifts.find(s => s.id === selectedShiftId);
  const isLabUser = currentUser?.profile === 'Laboratorio' || currentUser?.position === 'Laboratórista' || currentUser?.position === 'Laboratorista';

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
            <div className="flex flex-row items-center gap-2.5">
              <div className="flex items-center gap-2">
                <h1 className={cn(
                  "font-black uppercase tracking-tighter leading-none transition-all logo-glow text-text-main",
                  isCollapsed ? "text-base" : "text-lg md:text-xl"
                )}>
                  PSCQube
                </h1>
                {currentUser?.name && (
                  <span className="hidden sm:inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-text-main/85 border-l border-border pl-3.5 ml-2 mr-1 select-none transition-colors">
                    <UserIcon size={12} className="text-text-main/50 shrink-0" />
                    {currentUser.name}
                  </span>
                )}
              </div>
               {!isCollapsed && (
                 <div className="relative group cursor-pointer" onClick={handleDateClick}>
                   <div 
                     className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 group"
                   >
                     <Calendar size={12} className="text-primary group-hover:text-primary transition-colors shrink-0" />
                     <span className={cn(
                        "text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-colors",
                        isDark ? "text-white group-hover:text-white" : "text-primary group-hover:text-primary"
                      )}>{displayDate}</span>
                   </div>
                   {/* Overlay Input for robust Native Calendar Triggering across all devices (including iOS Safari) */}
                   <input 
                     ref={dateInputRef}
                     type="date" 
                     value={selectedDate}
                     onChange={(e) => onDateChange(e.target.value)}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                     aria-label="Seleccionar fecha"
                   />
                 </div>
              )}
            </div>
            
            {/* Small indicator of current shift when collapsed */}
            {isCollapsed && !isLabUser && activeSection === 'PRODUCTIVITY' && (
              <div className="sm:hidden px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                <span className="text-[8px] font-black text-primary uppercase">{selectedShift?.name || 'T1'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
             {/* Notification Bell - Mobile */}
             <div className="sm:hidden">
               <NotificationBellDropdown 
                 currentUser={currentUser}
                 notifications={notifications}
                 readNotificationKeys={readNotificationKeys}
                 onMarkAsRead={onMarkAsRead}
                 onMarkAllAsRead={onMarkAllAsRead}
                 onNavigateToChange={onNavigateToChange}
               />
             </div>

             {/* Simple Theme Toggle Always Row 1 */}
            <button 
              onClick={toggleTheme}
              className="sm:hidden p-1.5 rounded-full hover:bg-bg transition-colors text-text-main"
            >
              {isDark ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-primary" />}
            </button>

            {/* Refrescar aplicación (Mobile) */}
            {onRefreshCurrentFilters && (
              <button 
                onClick={onRefreshCurrentFilters}
                className="sm:hidden p-1.5 rounded-full hover:bg-bg transition-colors text-text-main"
                title="Refrescar Aplicación y Limpiar Caché"
              >
                <RefreshCw size={14} className="text-text-main hover:text-green-500" />
              </button>
            )}

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
              {!isLabUser && activeSection === 'PRODUCTIVITY' && (
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
                            : isDark ? "text-white/90 hover:text-white" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        {shiftLabels[s.name] || s.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Machine Selector - Fixed Dropdown Context */}
              {!isLabUser && activeSection === 'PRODUCTIVITY' && (
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
              )}

              {/* Notification Bell - Desktop */}
              <div className="hidden sm:block ml-2">
                <NotificationBellDropdown 
                  currentUser={currentUser}
                  notifications={notifications}
                  readNotificationKeys={readNotificationKeys}
                  onMarkAsRead={onMarkAsRead}
                  onMarkAllAsRead={onMarkAllAsRead}
                  onNavigateToChange={onNavigateToChange}
                />
              </div>

              {/* Theme Toggle - Desktop */}
              <button 
                onClick={toggleTheme}
                className="hidden sm:flex p-2 rounded-full hover:bg-bg transition-colors text-text-main hover:text-primary shrink-0 ml-1"
              >
                {isDark ? <Sun size={18} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" /> : <Moon size={18} className="text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />}
              </button>

              {/* Refrescar Aplicación - Desktop */}
              {onRefreshCurrentFilters && (
                <button 
                  onClick={onRefreshCurrentFilters}
                  className="hidden sm:flex p-2 rounded-full hover:bg-bg transition-colors text-text-main hover:text-primary shrink-0 ml-1"
                  title="Refrescar Aplicación y Limpiar Caché"
                >
                  <RefreshCw size={18} className="text-text-main hover:text-green-500" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export function BottomNav({ 
  activeSection, 
  onSectionChange,
  currentUser,
  onLogout
}: { 
  activeSection: string; 
  onSectionChange: (s: any) => void;
  currentUser: AppUser;
  onLogout: () => void;
}) {
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

  const userName = currentUser?.name || 'Operador';
  const userEmail = currentUser?.email || currentUser?.email2 || 'Sin correo';

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
                          <span className="text-[10px] font-bold text-text-main truncate w-full text-left uppercase tracking-tight leading-none mb-0.5">{userName}</span>
                          <span className="text-[8px] font-medium text-text-muted truncate w-full text-left opacity-70">{userEmail}</span>
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
                          onClick={() => {
                            setIsOpen(false);
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
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
