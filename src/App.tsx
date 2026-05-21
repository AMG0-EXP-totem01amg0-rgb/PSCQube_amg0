/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { 
  AlertTriangle, Package, ClipboardList, Fuel, Wrench,
  Activity, PlusCircle, ShieldCheck, Settings, Bot,
  ChevronLeft, ChevronRight, Truck
} from 'lucide-react';

// Modules
import { Header, BottomNav } from './components/layout/LayoutComponents';
import DashboardView from './components/productivity/DashboardView';
import StopsView from './components/productivity/StopsView';
import ProductionView from './components/productivity/ProductionView';
import LoadingLanesView from './components/productivity/LoadingLanesView';
import DaterControlView from './components/productivity/DaterControlView';
import ProductChangeView from './components/productivity/ProductChangeView';
import ScaleControlView from './components/productivity/ScaleControlView';
import InventoryView from './components/productivity/InventoryView';
import DespachosView from './components/productivity/DespachosView';
import AdminView from './components/admin/AdminView';
import PlaceholderView from './components/PlaceholderView';
import WelcomeScreen from './components/auth/WelcomeScreen';

// Lib & Types
import { cn } from './lib/utils';
import { Shift, MachineStop, ProductionReport, DaterControl, ScaleControl, InventoryEntry, UserContext, MasterData, AppUser, ProductChange, Company } from './types';
import { SHIFTS, PALLETIZERS, BAGGERS, MATERIALS, HACS, CAUSES, CAPACITIES, USERS, SYSTEM_VIEWS, COMPANIES, LOADING_POINTS, LANE_STATUSES } from './lib/mockData';
import { syncTableToSheets } from './lib/sheetsService';

// --- Utilities ---
const getCurrentShift = (shifts: Shift[]): Shift | null => {
  const now = new Date();
  const timeStr = format(now, 'HH:mm');
  return shifts.find(shift => {
    if (shift.startTime < shift.endTime) {
      return timeStr >= shift.startTime && timeStr < shift.endTime;
    } else {
      return timeStr >= shift.startTime || timeStr < shift.endTime;
    }
  }) || null;
};

type AppSection = 'PRODUCTIVITY' | 'SAFETY' | 'ENVIRONMENT' | 'HR' | 'ADMIN';
type ProductivityTab = 'DASHBOARD' | 'PAROS' | 'PRODUCCION' | 'DATER' | 'SCALE' | 'STOCK' | 'GASOIL' | 'MANTENIMIENTO' | 'CHANGE' | 'LOADING_LANES' | 'DESPACHOS';

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('PRODUCTIVITY');
  const [prodTab, setProdTab] = useState<ProductivityTab>('DASHBOARD');
  const [adminTab, setAdminTab] = useState('SHIFTS');
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const subNavRef = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, [isDark]);

  // Master States for CRUD
  const [shifts, setShifts] = useState<Shift[]>(SHIFTS);
  const [palletizers, setPalletizers] = useState(PALLETIZERS);
  const [baggers, setBaggers] = useState(BAGGERS);
  const [materials, setMaterials] = useState(MATERIALS);
  const [hacs, setHacs] = useState(HACS);
  const [causes, setCauses] = useState(CAUSES);
  const [capacities, setCapacities] = useState(CAPACITIES);
  const [users, setUsers] = useState<AppUser[]>(USERS);
  const [companies, setCompanies] = useState<Company[]>(COMPANIES);
  const [loadingPoints, setLoadingPoints] = useState(LOADING_POINTS);

  const masters: MasterData = {
    palletizers,
    baggers,
    materials,
    hacs,
    causes,
    shifts,
    capacities,
    users,
    companies,
    loadingPoints
  };

  const [userContext, setUserContext] = useState<UserContext>({
    role: 'ADMIN',
    selectedPalletizerId: PALLETIZERS[0].id,
    selectedShiftId: SHIFTS[0].id,
    selectedDate: format(new Date(), 'yyyy-MM-dd'),
    currentUserDni: USERS[0].dni
  });

  const currentUser = useMemo(() => 
    masters.users.find(u => u.dni === userContext.currentUserDni) || masters.users[0],
    [masters.users, userContext.currentUserDni]
  );

  const canView = (viewId: string) => {
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level !== 'NONE' : false;
  };

  const canEdit = (viewId: string) => {
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level === 'EDIT' : false;
  };

  // Redirect if current tab is hidden
  useEffect(() => {
    if (activeSection === 'PRODUCTIVITY' && !canView(prodTab)) {
        const firstVisible = SYSTEM_VIEWS
          .filter(v => v.section === 'PRODUCTIVITY')
          .find(v => canView(v.id));
        if (firstVisible) setProdTab(firstVisible.id as ProductivityTab);
    }
  }, [currentUser, prodTab, activeSection]);

  const [stops, setStops] = useState<MachineStop[]>([]);
  const [productionReports, setProductionReports] = useState<ProductionReport[]>([]);
  const [dispatchEntries, setDispatchEntries] = useState<any[]>([]);
  const [daterControls, setDaterControls] = useState<DaterControl[]>([]);
  const [scaleControls, setScaleControls] = useState<ScaleControl[]>([]);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryEntry[]>([]);
  const [productChanges, setProductChanges] = useState<ProductChange[]>([]);
  const [laneStatuses, setLaneStatuses] = useState<any[]>(LANE_STATUSES);
  
  const selectedShift = useMemo(() => 
    masters.shifts.find(s => s.id === userContext.selectedShiftId) || null,
    [masters.shifts, userContext.selectedShiftId]
  );

  const currentShift = useMemo(() => getCurrentShift(masters.shifts), [masters.shifts]);
  
  const selectedPalletizer = useMemo(() => 
    masters.palletizers.find(p => p.id === userContext.selectedPalletizerId) || null,
    [masters.palletizers, userContext.selectedPalletizerId]
  );

  // KPI calculations
  const kpis = useMemo(() => {
    if (!selectedPalletizer || !selectedShift) return { availability: 0, performance: 0, hsMarcha: 0, totalTons: 0 };
    const machineStops = stops.filter(s => 
      s.machineId === selectedPalletizer.id && 
      s.shiftId === selectedShift.id &&
      s.date === userContext.selectedDate
    );
    const contextReports = productionReports.filter(r => 
      r.palletizerId === selectedPalletizer.id && 
      r.shiftId === selectedShift.id &&
      r.date === userContext.selectedDate
    );

    const hsShift = selectedShift.durationHours;
    const totalStopMinutes = machineStops.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalStopHours = totalStopMinutes / 60;
    
    const externalStopMinutes = machineStops
      .filter(s => masters.causes.find(c => c.id === s.causeId)?.stopType === 'EXTERNO')
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const externalStopHours = externalStopMinutes / 60;

    const hsMarcha = hsShift - totalStopHours;
    const availability = hsShift > 0 ? (externalStopHours + hsMarcha) / hsShift : 0;

    let performance = 0;
    let totalTons = 0;
    if (contextReports.length > 0 && hsMarcha > 0) {
      totalTons = contextReports.reduce((sum, r) => sum + r.tonsProduced, 0);
      // Guard against BDP = 0 to avoid Infinity
      const sumTonsOverBDP = contextReports.reduce((sum, r) => sum + (r.tonsProduced / (r.bdp || 100)), 0);
      const theoreticBDPWeighted = sumTonsOverBDP > 0 ? totalTons / sumTonsOverBDP : 100;
      performance = Math.min(1.5, (totalTons / hsMarcha) / theoreticBDPWeighted);
    }

    return {
      availability: availability * 100,
      performance: performance * 100,
      hsMarcha,
      totalTons
    };
  }, [selectedPalletizer, selectedShift, stops, productionReports, masters.causes]);

  return (
    <AnimatePresence mode="wait">
      {!hasEnteredApp ? (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <WelcomeScreen onEnter={() => setHasEnteredApp(true)} />
        </motion.div>
      ) : (
        <motion.div 
          key="app-main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen relative pb-32 bg-bg text-text-main transition-colors duration-300"
        >
          <Header 
            palletizers={masters.palletizers}
            selectedId={userContext.selectedPalletizerId}
            onSelect={id => setUserContext({...userContext, selectedPalletizerId: id})}
            shifts={masters.shifts}
            selectedShiftId={userContext.selectedShiftId}
            onShiftSelect={id => setUserContext({...userContext, selectedShiftId: id})}
            selectedDate={userContext.selectedDate}
            onDateChange={date => setUserContext({...userContext, selectedDate: date})}
            isDark={isDark}
            toggleTheme={() => setIsDark(!isDark)}
          />

          <main className="p-4 md:p-8 max-w-7xl mx-auto pt-4 md:pt-8">
            <AnimatePresence mode="wait">
              {activeSection === 'PRODUCTIVITY' && (
                <motion.div 
                  key="productivity" 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4 md:space-y-6"
                >
                  {/* Sub-nav Productivity - Encapsulated Pill Container */}
                  <div className="sticky top-16 z-30 bg-bg/80 backdrop-blur-md pt-4 pb-1 mb-8">
                      <div className="layout-container">
                        <div className="bg-surface p-1.5 rounded-2xl border border-border shadow-lg relative group">
                          {/* Carousel Arrows - Only visible on desktop hover */}
                          <div className="absolute inset-y-0 left-0 items-center pl-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                if (subNavRef.current) {
                                  subNavRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                                }
                              }}
                              className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
                            >
                              <ChevronLeft size={14} />
                            </button>
                          </div>
                          
                          <div className="absolute inset-y-0 right-0 items-center pr-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                if (subNavRef.current) {
                                  subNavRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                                }
                              }}
                              className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>

                          {/* Carousel edge masks */}
                          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
                          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />
                          
                          <div 
                            ref={subNavRef}
                            className="flex items-center gap-2 no-scrollbar py-1 scroll-smooth px-4 touch-horizontal touch-pan-x overscroll-x-contain"
                          >
                            {canView('DASHBOARD') && <ProductivitySubTab active={prodTab === 'DASHBOARD'} onClick={() => setProdTab('DASHBOARD')} icon={<Activity size={14} />} label="Dashboard" />}
                            {canView('PAROS') && <ProductivitySubTab active={prodTab === 'PAROS'} onClick={() => setProdTab('PAROS')} icon={<AlertTriangle size={14} />} label="Paros" />}
                            {canView('PRODUCCION') && <ProductivitySubTab active={prodTab === 'PRODUCCION'} onClick={() => setProdTab('PRODUCCION')} icon={<Package size={14} />} label="Producción" />}
                            {canView('DATER') && <ProductivitySubTab active={prodTab === 'DATER'} onClick={() => setProdTab('DATER')} icon={<ClipboardList size={14} />} label="Control Fechadores" />}
                            {canView('SCALE') && <ProductivitySubTab active={prodTab === 'SCALE'} onClick={() => setProdTab('SCALE')} icon={<Activity size={14} />} label="Control Balanzas" />}
                            {canView('CHANGE') && <ProductivitySubTab active={prodTab === 'CHANGE'} onClick={() => setProdTab('CHANGE')} icon={<Bot size={14} />} label="Cambio Producto" />}
                            {canView('STOCK') && <ProductivitySubTab active={prodTab === 'STOCK'} onClick={() => setProdTab('STOCK')} icon={<PlusCircle size={14} />} label="Insumos" />}
                            {canView('DESPACHOS') && <ProductivitySubTab active={prodTab === 'DESPACHOS'} onClick={() => setProdTab('DESPACHOS')} icon={<Truck size={14} />} label="Despachos" />}
                            {canView('GASOIL') && <ProductivitySubTab active={prodTab === 'GASOIL'} onClick={() => setProdTab('GASOIL')} icon={<ShieldCheck size={14} />} label="Combustible" />}
                            {canView('MANTENIMIENTO') && <ProductivitySubTab active={prodTab === 'MANTENIMIENTO'} onClick={() => setProdTab('MANTENIMIENTO')} icon={<Settings size={14} />} label="Mantenimiento" />}
                            {canView('LOADING_LANES') && <ProductivitySubTab active={prodTab === 'LOADING_LANES'} onClick={() => setProdTab('LOADING_LANES')} icon={null} label="Calles Carga" />}
                          </div>
                        </div>
                      </div>
                  </div>

                  {prodTab === 'DASHBOARD' && (
                    <DashboardView 
                        masters={masters}
                        selectedShift={selectedShift}
                        selectedDate={userContext.selectedDate}
                        onTabChange={tab => setProdTab(tab)} 
                        stops={stops.filter(s => s.shiftId === userContext.selectedShiftId && s.date === userContext.selectedDate)}
                        productionReports={productionReports.filter(r => r.shiftId === userContext.selectedShiftId && r.date === userContext.selectedDate)}
                        inventoryEntries={inventoryEntries.filter(e => e.shiftId === userContext.selectedShiftId && e.date === userContext.selectedDate)}
                        dispatchEntries={dispatchEntries.filter(d => d.shiftId === userContext.selectedShiftId && d.date === userContext.selectedDate)}
                        laneStatuses={laneStatuses.filter(l => l.shiftId === userContext.selectedShiftId && l.date === userContext.selectedDate)}
                    />
                  )}
                  {prodTab === 'DESPACHOS' && (
                    <DespachosView 
                      masters={masters}
                      currentUser={currentUser}
                      history={dispatchEntries.filter(d => d.shiftId === userContext.selectedShiftId && d.date === userContext.selectedDate)}
                      onSave={entry => setDispatchEntries(prev => {
                        const exists = prev.find(x => x.id === entry.id);
                        if (exists) return prev.map(x => x.id === entry.id ? entry : x);
                        return [entry, ...prev];
                      })}
                      onDelete={id => setDispatchEntries(prev => prev.filter(e => e.id !== id))}
                      selectedShiftId={userContext.selectedShiftId}
                      selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'PAROS' && (
                    <StopsView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={s => setStops(prev => {
                          const exists = prev.find(x => x.id === s.id);
                          if (exists) return prev.map(x => x.id === s.id ? s : x);
                          return [s, ...prev];
                        })}
                        onDelete={id => setStops(prev => prev.filter(s => s.id !== id))}
                        palletizerId={userContext.selectedPalletizerId} 
                        shiftId={userContext.selectedShiftId} 
                        selectedDate={userContext.selectedDate}
                        history={stops.filter(s => s.machineId === userContext.selectedPalletizerId && s.shiftId === userContext.selectedShiftId && s.date === userContext.selectedDate)}
                    />
                  )}
                  {prodTab === 'PRODUCCION' && (
                    <ProductionView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={r => setProductionReports(prev => {
                          const exists = prev.find(x => x.id === r.id);
                          if (exists) return prev.map(x => x.id === r.id ? r : x);
                          return [r, ...prev];
                        })}
                        onDelete={id => setProductionReports(prev => prev.filter(r => r.id !== id))}
                        palletizerId={userContext.selectedPalletizerId} 
                        shiftId={userContext.selectedShiftId} 
                        selectedDate={userContext.selectedDate}
                        history={productionReports.filter(r => r.palletizerId === userContext.selectedPalletizerId && r.shiftId === userContext.selectedShiftId && r.date === userContext.selectedDate)}
                      />
                  )}
                  {prodTab === 'DATER' && (
                    <DaterControlView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={c => setDaterControls(prev => {
                          const exists = prev.find(x => x.id === c.id);
                          if (exists) return prev.map(x => x.id === c.id ? c : x);
                          return [c, ...prev];
                        })}
                        onDelete={id => setDaterControls(prev => prev.filter(c => c.id !== id))}
                        history={daterControls.filter(c => c.shiftId === userContext.selectedShiftId && c.date === userContext.selectedDate)}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'SCALE' && (
                    <ScaleControlView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={c => setScaleControls(prev => {
                          const exists = prev.find(x => x.id === c.id);
                          if (exists) return prev.map(x => x.id === c.id ? c : x);
                          return [c, ...prev];
                        })}
                        onDelete={id => setScaleControls(prev => prev.filter(c => c.id !== id))}
                        history={scaleControls.filter(c => c.shiftId === userContext.selectedShiftId && c.date === userContext.selectedDate)}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'STOCK' && (
                    <InventoryView 
                        masters={masters} 
                        currentUser={currentUser}
                        entries={inventoryEntries.filter(e => e.shiftId === userContext.selectedShiftId && e.date === userContext.selectedDate)}
                        productionReports={productionReports.filter(r => r.shiftId === userContext.selectedShiftId && r.date === userContext.selectedDate)}
                        onSave={e => setInventoryEntries(prev => {
                          const exists = prev.find(x => x.id === e.id);
                          if (exists) return prev.map(x => x.id === e.id ? e : x);
                          return [e, ...prev];
                        })}
                        onDelete={id => setInventoryEntries(prev => prev.filter(e => e.id !== id))}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'CHANGE' && (
                    <ProductChangeView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={productChanges.filter(c => c.shiftId === userContext.selectedShiftId && c.date === userContext.selectedDate)}
                        onSave={c => setProductChanges(prev => {
                          const exists = prev.find(x => x.id === c.id);
                          if (exists) return prev.map(x => x.id === c.id ? c : x);
                          return [c, ...prev];
                        })}
                        onDelete={id => setProductChanges(prev => prev.filter(c => c.id !== id))}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'LOADING_LANES' && (
                    <LoadingLanesView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={laneStatuses.filter(l => l.shiftId === userContext.selectedShiftId && l.date === userContext.selectedDate)}
                        onSave={l => setLaneStatuses(prev => {
                          const exists = prev.find(x => x.id === l.id);
                          if (exists) return prev.map(x => x.id === l.id ? l : x);
                          return [l, ...prev];
                        })}
                        onDelete={id => setLaneStatuses(prev => prev.filter(l => l.id !== id))}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {['GASOIL', 'MANTENIMIENTO'].includes(prodTab) && (
                    <PlaceholderView title={`Módulo: ${prodTab}`} type="PRODUCTIVITY" />
                  )}
                </motion.div>
              )}

              {activeSection === 'SAFETY' && <PlaceholderView title="H&S" type="SAFETY" />}
              {activeSection === 'ENVIRONMENT' && <PlaceholderView title="Medio Ambiente" type="ENVIRONMENT" />}
              {activeSection === 'HR' && <PlaceholderView title="Capital Humano" type="HR" />}
              
              {activeSection === 'ADMIN' && (
                <AdminView 
                    masters={masters} 
                    currentUser={currentUser}
                    activeTab={adminTab} 
                    onTabChange={setAdminTab} 
                    onUserSwitch={dni => setUserContext({...userContext, currentUserDni: dni})}
                    onUpdateMasters={(type, data) => {
                      let targetData = data;
                      if (type === 'SHIFTS') setShifts(data as Shift[]);
                      if (type === 'MACHINES') setPalletizers(data);
                      if (type === 'BAGGERS') setBaggers(data);
                      if (type === 'HACS') setHacs(data);
                      if (type === 'CAUSES') setCauses(data);
                      if (type === 'MATERIALS') setMaterials(data);
                      if (type === 'CAPACITIES') setCapacities(data);
                      if (type === 'USERS') {
                        const cleaned = (data as any[]).map(u => {
                          if (!u.permissions || !Array.isArray(u.permissions)) {
                            const level = u.profile === 'Administrador' ? 'EDIT' : 'VIEW';
                            return {
                              ...u,
                              permissions: SYSTEM_VIEWS.map(v => ({
                                viewId: v.id,
                                label: v.label,
                                section: v.section,
                                level: level
                              }))
                            };
                          }
                          return u;
                        });
                        setUsers(cleaned);
                        targetData = cleaned;
                      }
                      if (type === 'COMPANIES') setCompanies(data as Company[]);
                      if (type === 'PUNTOS_CARGA') setLoadingPoints(data);

                      // Sincronización automática en tiempo real con Google Sheets
                      const tabSuffixMapping: Record<string, string> = {
                        SHIFTS: "TURNOSV2",
                        MACHINES: "PALETIZADORAV2",
                        BAGGERS: "ENSACADORAV2",
                        HACS: "HACSV2",
                        CAUSES: "CAUSASV2",
                        MATERIALS: "MATERIALESV2",
                        CAPACITIES: "CAPACIDADESV2",
                        USERS: "USUARIOSV2",
                        COMPANIES: "EMPRESASV2",
                        PUNTOS_CARGA: "PUNTOS_CARGAV2"
                      };
                      const suffix = tabSuffixMapping[type];
                      if (suffix) {
                        syncTableToSheets(suffix, targetData)
                          .then(res => {
                            if (res.success) {
                              console.log(`[AutoSync] Sincronización automática de ${suffix} exitosa.`);
                            } else {
                              console.warn(`[AutoSync] Error al sincronizar ${suffix}:`, res.error);
                            }
                          })
                          .catch(err => {
                            console.error(`[AutoSync] Error grave al sincronizar ${suffix}:`, err);
                          });
                      }
                    }}
                />
              )}
            </AnimatePresence>
          </main>

          <BottomNav activeSection={activeSection} onSectionChange={setActiveSection} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProductivitySubTab({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      data-active={active}
      className={cn(
        "px-4 py-1.5 rounded-md flex items-center gap-2 transition-all flex-none text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-fit",
        active 
          ? "btn-active-highlight" 
          : "text-text-muted hover:text-text-main hover:bg-bg"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Update PlaceholderView to handle PRODUCTIVITY type
// (I will add it in a minute if needed, but let's keep it simple for now)
