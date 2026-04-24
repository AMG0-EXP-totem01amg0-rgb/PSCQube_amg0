/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { 
  AlertTriangle, Package, ClipboardList, Fuel, Wrench,
  Activity, PlusCircle, ShieldCheck, Settings, Bot 
} from 'lucide-react';

// Modules
import { Header, BottomNav } from './components/layout/LayoutComponents';
import DashboardView from './components/productivity/DashboardView';
import StopsView from './components/productivity/StopsView';
import ProductionView from './components/productivity/ProductionView';
import AdminView from './components/admin/AdminView';
import PlaceholderView from './components/PlaceholderView';
import WelcomeScreen from './components/auth/WelcomeScreen';

// Lib & Types
import { cn } from './lib/utils';
import { Shift, MachineStop, ProductionReport, UserContext, MasterData } from './types';
import { SHIFTS, PALLETIZERS, BAGGERS, MATERIALS, HACS, CAUSES, CAPACITIES } from './lib/mockData';

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
type ProductivityTab = 'DASHBOARD' | 'PAROS' | 'PRODUCCION' | 'STOCK' | 'GASOIL' | 'MANTENIMIENTO';

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
  
  // Auto-scroll to center active sub-tab
  useEffect(() => {
    if (subNavRef.current) {
      const activeElement = subNavRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [prodTab, activeSection]);
  
  const [userContext, setUserContext] = useState<UserContext>({
    role: 'ADMIN',
    selectedPalletizerId: PALLETIZERS[0].id,
    selectedShiftId: SHIFTS[0].id,
    selectedDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [stops, setStops] = useState<MachineStop[]>([]);
  const [productionReports, setProductionReports] = useState<ProductionReport[]>([]);
  
  // Master States for CRUD
  const [shifts, setShifts] = useState<Shift[]>(SHIFTS);
  const [palletizers, setPalletizers] = useState(PALLETIZERS);
  const [baggers, setBaggers] = useState(BAGGERS);
  const [materials, setMaterials] = useState(MATERIALS);
  const [hacs, setHacs] = useState(HACS);
  const [causes, setCauses] = useState(CAUSES);
  const [capacities, setCapacities] = useState(CAPACITIES);

  const masters: MasterData = {
    palletizers,
    baggers,
    materials,
    hacs,
    causes,
    shifts,
    capacities
  };

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
                        <div className="bg-surface p-1.5 rounded-2xl border border-border shadow-lg relative overflow-hidden">
                          {/* Carousel edge masks */}
                          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
                          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />
                          
                          <div 
                            ref={subNavRef}
                            className="flex items-center gap-2 no-scrollbar py-1 scroll-smooth px-4 touch-horizontal touch-pan-x overscroll-x-contain"
                          >
                            <ProductivitySubTab active={prodTab === 'DASHBOARD'} onClick={() => setProdTab('DASHBOARD')} icon={<Activity size={14} />} label="Dashboard" />
                            <ProductivitySubTab active={prodTab === 'PAROS'} onClick={() => setProdTab('PAROS')} icon={<AlertTriangle size={14} />} label="Paros" />
                            <ProductivitySubTab active={prodTab === 'PRODUCCION'} onClick={() => setProdTab('PRODUCCION')} icon={<Package size={14} />} label="Producción" />
                            <ProductivitySubTab active={prodTab === 'STOCK'} onClick={() => setProdTab('STOCK')} icon={<PlusCircle size={14} />} label="Insumos" />
                            <ProductivitySubTab active={prodTab === 'GASOIL'} onClick={() => setProdTab('GASOIL')} icon={<ShieldCheck size={14} />} label="Combustible" />
                            <ProductivitySubTab active={prodTab === 'MANTENIMIENTO'} onClick={() => setProdTab('MANTENIMIENTO')} icon={<Settings size={14} />} label="Mantenimiento" />
                          </div>
                        </div>
                      </div>
                  </div>

                  {prodTab === 'DASHBOARD' && (
                    <DashboardView 
                        kpis={kpis} 
                        masters={masters}
                        selectedPalletizer={selectedPalletizer} 
                        selectedShift={selectedShift}
                        onTabChange={tab => setProdTab(tab)} 
                        stops={stops.filter(s => s.machineId === userContext.selectedPalletizerId && s.shiftId === userContext.selectedShiftId && s.date === userContext.selectedDate)}
                        productionReports={productionReports.filter(r => r.palletizerId === userContext.selectedPalletizerId && r.shiftId === userContext.selectedShiftId && r.date === userContext.selectedDate)}
                    />
                  )}
                  {prodTab === 'PAROS' && (
                    <StopsView 
                        masters={masters} 
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
                  {['STOCK', 'GASOIL', 'MANTENIMIENTO'].includes(prodTab) && (
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
                    activeTab={adminTab} 
                    onTabChange={setAdminTab} 
                    onUpdateMasters={(type, data) => {
                      if (type === 'SHIFTS') setShifts(data as Shift[]);
                      if (type === 'MACHINES') setPalletizers(data);
                      if (type === 'BAGGERS') setBaggers(data);
                      if (type === 'HACS') setHacs(data);
                      if (type === 'CAUSES') setCauses(data);
                      if (type === 'CAPACITIES') setCapacities(data);
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
