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
  ChevronLeft, ChevronRight, Truck, Droplet
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
import FuelView from './components/productivity/FuelView';
import AdminView from './components/admin/AdminView';
import PlaceholderView from './components/PlaceholderView';
import WelcomeScreen from './components/auth/WelcomeScreen';
import { getSupabaseClient } from './lib/supabaseClient';

// Lib & Types
import { cn } from './lib/utils';
import { Shift, MachineStop, ProductionReport, DaterControl, ScaleControl, InventoryEntry, UserContext, MasterData, AppUser, ProductChange, Company, FuelLoad, AlertNotification } from './types';
import { SHIFTS, PALLETIZERS, BAGGERS, MATERIALS, HACS, CAUSES, CAPACITIES, USERS, SYSTEM_VIEWS, COMPANIES, LOADING_POINTS, LANE_STATUSES } from './lib/mockData';
import { syncTableToSheets, getBackendSheetsStatus, fetchTableFromSheets } from './lib/sheetsService';
import { ToastContainer, ToastMessage } from './components/ui/Toast';

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

  useEffect(() => {
    const el = subNavRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [activeSection, hasEnteredApp]);

  // Master States for CRUD - Completely clean, without mock or preloaded local seed data
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [palletizers, setPalletizers] = useState<any[]>([]);
  const [baggers, setBaggers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [hacs, setHacs] = useState<any[]>([]);
  const [causes, setCauses] = useState<any[]>([]);
  const [capacities, setCapacities] = useState<any[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingPoints, setLoadingPoints] = useState<any[]>([]);
  const [bagSuppliers, setBagSuppliers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuelLoads, setFuelLoads] = useState<any[]>([]);

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
    loadingPoints,
    bagSuppliers,
    vehicles
  };

  // Secure full fallback admin user context if Sheets is completely empty
  const DEFAULT_USER = useMemo<AppUser>(() => ({
    dni: 'ADMIN-SUP',
    name: 'Administrador Principal',
    sapUser: 'admin',
    email: 'admin@system.com',
    position: 'Supervisor General',
    profile: 'Administrador',
    permissions: SYSTEM_VIEWS.map(v => ({
      viewId: v.id,
      label: v.label,
      section: v.section,
      level: 'EDIT'
    }))
  }), []);

  const [userContext, setUserContext] = useState<UserContext>({
    role: 'ADMIN',
    selectedPalletizerId: '',
    selectedShiftId: '',
    selectedDate: format(new Date(), 'yyyy-MM-dd'),
    currentUserDni: ''
  });

  const currentUser = useMemo(() => {
    let found = masters.users.find(u => u.dni === userContext.currentUserDni) || masters.users[0] || DEFAULT_USER;
    if (found && (found.email?.toLowerCase() === 'joni0627@gmail.com' || found.dni === '20-12345678-9')) {
      return {
        ...found,
        profile: 'Administrador' as const,
        permissions: SYSTEM_VIEWS.map(v => ({
          viewId: v.id,
          label: v.label,
          section: v.section,
          level: 'EDIT' as const
        }))
      };
    }
    return found;
  }, [masters.users, userContext.currentUserDni, DEFAULT_USER]);

  const canView = (viewId: string) => {
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level !== 'NONE' : false;
  };

  const canEdit = (viewId: string) => {
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level === 'EDIT' : false;
  };

  // Auto-selection observers as Google Sheets data loads
  useEffect(() => {
    if (palletizers.length > 0 && !userContext.selectedPalletizerId) {
      setUserContext(prev => ({ ...prev, selectedPalletizerId: palletizers[0].id }));
    }
  }, [palletizers, userContext.selectedPalletizerId]);

  useEffect(() => {
    if (shifts.length > 0 && !userContext.selectedShiftId) {
      setUserContext(prev => ({ ...prev, selectedShiftId: shifts[0].id }));
    }
  }, [shifts, userContext.selectedShiftId]);

  useEffect(() => {
    if (users.length > 0 && !userContext.currentUserDni) {
      setUserContext(prev => ({ ...prev, currentUserDni: users[0].dni }));
    }
  }, [users, userContext.currentUserDni]);

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
  const [laneStatuses, setLaneStatuses] = useState<any[]>([]);

  // Toast notifications State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  // Alert Notifications State (derived + read key tracker mapped by user DNI)
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications_v1') || '[]');
    } catch {
      return [];
    }
  });

  const handleMarkAsRead = (id: string) => {
    setReadNotificationKeys(prev => {
      const key = `${currentUser.dni}-${id}`;
      if (prev.includes(key)) return prev;
      const updated = [...prev, key];
      localStorage.setItem('read_notifications_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMarkAllAsRead = (ids: string[]) => {
    setReadNotificationKeys(prev => {
      const prefixes = ids.map(id => `${currentUser.dni}-${id}`);
      const updated = Array.from(new Set([...prev, ...prefixes]));
      localStorage.setItem('read_notifications_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const notifications = useMemo<AlertNotification[]>(() => {
    const list: AlertNotification[] = [];
    
    productChanges.forEach(pc => {
      const prevMat = masters.materials.find(m => m.id === pc.previousMaterialId)?.name || 'Desconocido';
      const newMat = masters.materials.find(m => m.id === pc.newMaterialId)?.name || 'Desconocido';
      
      // Notification for Lab users when product change is pending
      if (pc.approvalStatus === 'PENDIENTE') {
        const id = `${pc.id}-PENDIENTE`;
        list.push({
          id,
          type: 'NEW_PRODUCT_CHANGE',
          date: pc.date,
          title: 'Nuevo Cambio de Producto Pendiente',
          message: `El operario ${pc.operatorName} registró un cambio pidiendo análisis para el nuevo material: ${newMat}.`,
          isReadByUsers: [],
          targetProfile: 'Laboratorio',
          createdAt: pc.date,
          relatedId: pc.id
        });
      }
      
      // Notification for operators when product change has been APPROVED or RECHAZADO
      if (pc.approvalStatus === 'APROBADO' || pc.approvalStatus === 'RECHAZADO') {
        const id = `${pc.id}-${pc.approvalStatus}`;
        list.push({
          id,
          type: 'LAB_ANALYSIS_COMPLETED',
          date: pc.date,
          title: `Cambio de Producto ${pc.approvalStatus === 'APROBADO' ? 'Aprobado' : 'Rechazado'}`,
          message: `El análisis para el cambio de producto de ${prevMat} a ${newMat} fue ${pc.approvalStatus === 'APROBADO' ? 'APROBADO' : 'RECHAZADO'}.${pc.rejectionObservation ? ' Obs: ' + pc.rejectionObservation : ''}`,
          isReadByUsers: [],
          targetProfile: 'Operario',
          createdAt: pc.date,
          relatedId: pc.id
        });
      }
    });

    // Sort newer first
    return [...list].reverse();
  }, [productChanges, masters.materials]);

  // On-demand database synchronization triggered by pressing "Ingresar"
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Sincronizando información...');

  const handleSyncOnEnter = async (targetDni?: string) => {
    setIsSyncing(true);
    setSyncMessage('Iniciando sincronización...');
    try {
      setSyncMessage('Estableciendo conexión con base de datos...');
      const status = await getBackendSheetsStatus();
      
      let finalUsers: AppUser[] = [];

      if (status.configured) {
        setSyncMessage('Sincronizando información...');
        // Parallel fetching of master & transactional data
        const [
          resStops,
          resProduction,
          resDater,
          resScale,
          resStock,
          resChange,
          resDespachos,
          resLoadingLanes,
          // Masters
          resShifts,
          resPalletizers,
          resBaggers,
          resHacs,
          resCauses,
          resMaterials,
          resCapacities,
          resUsers,
          resCompanies,
          resLoadingPoints,
          resBagSuppliers,
          resVehicles,
          resFuelLoads
        ] = await Promise.all([
          fetchTableFromSheets("PAROSV2"),
          fetchTableFromSheets("PRODUCCIONV2"),
          fetchTableFromSheets("CONTROL_FECHADORV2"),
          fetchTableFromSheets("CONTROL_BALANZAV2"),
          fetchTableFromSheets("INVENTARIO_FISICOV2"),
          fetchTableFromSheets("CAMBIO_PRODUCTOV2"),
          fetchTableFromSheets("DESPACHOSV2"),
          fetchTableFromSheets("ESTADO_CALLESV2"),
          // Masters
          fetchTableFromSheets("TURNOSV2"),
          fetchTableFromSheets("PALETIZADORAV2"),
          fetchTableFromSheets("ENSACADORAV2"),
          fetchTableFromSheets("HACSV2"),
          fetchTableFromSheets("CAUSASV2"),
          fetchTableFromSheets("MATERIALESV2"),
          fetchTableFromSheets("CAPACIDADESV2"),
          fetchTableFromSheets("USUARIOSV2"),
          fetchTableFromSheets("EMPRESASV2"),
          fetchTableFromSheets("PUNTOS_CARGAV2"),
          fetchTableFromSheets("PROVEEDORES_BOLSAV2"),
          fetchTableFromSheets("VEHICULOSV2"),
          fetchTableFromSheets("CARGA_COMBUSTIBLEV2")
        ]);

        setSyncMessage('Preparando sistema...');

        if (resStops.success && resStops.data) setStops(resStops.data);
        if (resProduction.success && resProduction.data) setProductionReports(resProduction.data);
        if (resDater.success && resDater.data) setDaterControls(resDater.data);
        if (resScale.success && resScale.data) setScaleControls(resScale.data);
        if (resStock.success && resStock.data) setInventoryEntries(resStock.data);
        if (resChange.success && resChange.data) setProductChanges(resChange.data);
        if (resDespachos.success && resDespachos.data) setDispatchEntries(resDespachos.data);
        if (resLoadingLanes.success && resLoadingLanes.data) setLaneStatuses(resLoadingLanes.data);
        
        // Set Masters if present
        if (resShifts.success && resShifts.data) setShifts(resShifts.data);
        if (resPalletizers.success && resPalletizers.data) setPalletizers(resPalletizers.data);
        if (resBaggers.success && resBaggers.data) setBaggers(resBaggers.data);
        if (resHacs.success && resHacs.data) setHacs(resHacs.data);
        if (resCauses.success && resCauses.data) setCauses(resCauses.data);
        if (resMaterials.success && resMaterials.data) setMaterials(resMaterials.data);
        if (resCapacities.success && resCapacities.data) setCapacities(resCapacities.data);
        if (resUsers.success && resUsers.data) {
          setUsers(resUsers.data);
          finalUsers = resUsers.data;
        }
        if (resCompanies.success && resCompanies.data) setCompanies(resCompanies.data);
        if (resLoadingPoints.success && resLoadingPoints.data) setLoadingPoints(resLoadingPoints.data);
        if (resBagSuppliers.success && resBagSuppliers.data) setBagSuppliers(resBagSuppliers.data);
        if (resVehicles.success && resVehicles.data) setVehicles(resVehicles.data);
        if (resFuelLoads.success && resFuelLoads.data) setFuelLoads(resFuelLoads.data);

        addToast("Sincronización con base de datos completada exitosamente.", "success");
        console.log("[SheetsConfig] Google Sheets database successfully synced on login.");
      } else {
        setSyncMessage('Inicializando base de datos local...');
        // Initialize local states with default mockData lists directly to establish robust offline mode
        setShifts(SHIFTS);
        setPalletizers(PALLETIZERS);
        setBaggers(BAGGERS);
        setMaterials(MATERIALS);
        setHacs(HACS);
        setCauses(CAUSES);
        setCapacities(CAPACITIES);
        setUsers(USERS);
        finalUsers = USERS;
        setCompanies(COMPANIES);
        setLoadingPoints(LOADING_POINTS);
        setLaneStatuses(LANE_STATUSES);
        
        addToast("Ejecutando en memoria local (credenciales no detectadas).", "warning");
        console.log("[SheetsConfig] Google Sheets mode offline. Ready.");
      }

      // Check for saved user session or target login
      const activeDni = targetDni || sessionStorage.getItem('pscqube_user_dni') || (finalUsers[0] ? finalUsers[0].dni : '');
      if (activeDni) {
        setUserContext(prev => ({ ...prev, currentUserDni: activeDni }));
      }
    } catch (err) {
      console.error("[SheetsLoad] Error during on-demand synchronization:", err);
      addToast("Error al sincronizar con base datos o inicializar offline.", "error");
    } finally {
      setIsSyncing(false);
      setHasEnteredApp(true);
    }
  };

  // Automatically restore active user session elements on start
  useEffect(() => {
    const savedDni = sessionStorage.getItem('pscqube_user_dni');
    if (savedDni) {
      handleSyncOnEnter(savedDni);
    }
  }, []);

  // --- Centralized, Synchronized & Toast-Enabled handlers ---
  
  const handleSaveDispatch = (entry: any) => {
    let exists = false;
    let nextEntries: any[] = [];
    setDispatchEntries(prev => {
      exists = !!prev.find(x => x.id === entry.id);
      nextEntries = exists
        ? prev.map(x => x.id === entry.id ? entry : x)
        : [entry, ...prev];
      return nextEntries;
    });

    syncTableToSheets("DESPACHOSV2", nextEntries).then(res => {
      if (res.success) {
        addToast(exists ? "Despacho actualizado con éxito" : "Despacho guardado con éxito", "success");
      } else {
        addToast("Guardado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteDispatch = (id: string) => {
    let nextEntries: any[] = [];
    setDispatchEntries(prev => {
      nextEntries = prev.filter(e => e.id !== id);
      return nextEntries;
    });

    syncTableToSheets("DESPACHOSV2", nextEntries).then(res => {
      if (res.success) {
        addToast("Despacho eliminado", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveStop = (stop: MachineStop) => {
    let exists = false;
    let nextStops: MachineStop[] = [];
    setStops(prev => {
      exists = !!prev.find(x => x.id === stop.id);
      nextStops = exists
        ? prev.map(x => x.id === stop.id ? stop : x)
        : [stop, ...prev];
      return nextStops;
    });

    syncTableToSheets("PAROSV2", nextStops).then(res => {
      if (res.success) {
        addToast(exists ? "Paro actualizado con éxito" : "Paro registrado con éxito", "success");
        fetchTableFromSheets("PRODUCCIONV2").then(pRes => {
          if (pRes.success && pRes.data) {
            setProductionReports(pRes.data);
          }
        });
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteStop = (id: string) => {
    let nextStops: MachineStop[] = [];
    setStops(prev => {
      nextStops = prev.filter(s => s.id !== id);
      return nextStops;
    });

    syncTableToSheets("PAROSV2", nextStops).then(res => {
      if (res.success) {
        addToast("Paro eliminado", "success");
        fetchTableFromSheets("PRODUCCIONV2").then(pRes => {
          if (pRes.success && pRes.data) {
            setProductionReports(pRes.data);
          }
        });
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveProductionReport = (report: ProductionReport) => {
    let exists = false;
    let nextReports: ProductionReport[] = [];
    setProductionReports(prev => {
      exists = !!prev.find(x => x.id === report.id);
      nextReports = exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
      return nextReports;
    });

    syncTableToSheets("PRODUCCIONV2", nextReports).then(res => {
      if (res.success) {
        addToast(exists ? "Producción actualizada con éxito" : "Producción guardada con éxito", "success");
      } else {
        addToast("Guardada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteProductionReport = (id: string) => {
    let nextReports: ProductionReport[] = [];
    setProductionReports(prev => {
      nextReports = prev.filter(r => r.id !== id);
      return nextReports;
    });

    syncTableToSheets("PRODUCCIONV2", nextReports).then(res => {
      if (res.success) {
        addToast("Reporte de producción eliminado de base de datos", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveDaterControl = (report: DaterControl) => {
    let exists = false;
    let nextDater: DaterControl[] = [];
    setDaterControls(prev => {
      exists = !!prev.find(x => x.id === report.id);
      nextDater = exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
      return nextDater;
    });

    syncTableToSheets("CONTROL_FECHADORV2", nextDater).then(res => {
      if (res.success) {
        addToast(exists ? "Control fechador actualizado con éxito" : "Control fechador registrado con éxito", "success");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteDaterControl = (id: string) => {
    let nextDater: DaterControl[] = [];
    setDaterControls(prev => {
      nextDater = prev.filter(c => c.id !== id);
      return nextDater;
    });

    syncTableToSheets("CONTROL_FECHADORV2", nextDater).then(res => {
      if (res.success) {
        addToast("Control fechador eliminado de Google Sheets", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveScaleControl = (report: ScaleControl) => {
    let exists = false;
    let nextScale: ScaleControl[] = [];
    setScaleControls(prev => {
      exists = !!prev.find(x => x.id === report.id);
      nextScale = exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
      return nextScale;
    });

    syncTableToSheets("CONTROL_BALANZAV2", nextScale).then(res => {
      if (res.success) {
        addToast(exists ? "Control de balanza actualizado con éxito" : "Control de balanza registrado con éxito", "success");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteScaleControl = (id: string) => {
    let nextScale: ScaleControl[] = [];
    setScaleControls(prev => {
      nextScale = prev.filter(c => c.id !== id);
      return nextScale;
    });

    syncTableToSheets("CONTROL_BALANZAV2", nextScale).then(res => {
      if (res.success) {
        addToast("Control de balanza eliminado", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveInventory = (entry: InventoryEntry) => {
    let exists = false;
    let nextInventory: InventoryEntry[] = [];
    setInventoryEntries(prev => {
      exists = !!prev.find(x => x.id === entry.id);
      nextInventory = exists
        ? prev.map(x => x.id === entry.id ? entry : x)
        : [entry, ...prev];
      return nextInventory;
    });

    syncTableToSheets("INVENTARIO_FISICOV2", nextInventory).then(res => {
      if (res.success) {
        addToast(exists ? "Registro de insumo actualizado" : "Registro de insumo guardado", "success");
      } else {
        addToast("Guardado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteInventory = (id: string) => {
    let nextInventory: InventoryEntry[] = [];
    setInventoryEntries(prev => {
      nextInventory = prev.filter(e => e.id !== id);
      return nextInventory;
    });

    syncTableToSheets("INVENTARIO_FISICOV2", nextInventory).then(res => {
      if (res.success) {
        addToast("Registro de insumo eliminado", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveProductChange = (report: ProductChange) => {
    let exists = false;
    let nextChanges: ProductChange[] = [];
    setProductChanges(prev => {
      exists = !!prev.find(x => x.id === report.id);
      nextChanges = exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
      return nextChanges;
    });

    syncTableToSheets("CAMBIO_PRODUCTOV2", nextChanges).then(res => {
      if (res.success) {
        addToast(exists ? "Cambio de producto actualizado con éxito" : "Cambio de producto registrado con éxito", "success");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteProductChange = (id: string) => {
    let nextChanges: ProductChange[] = [];
    setProductChanges(prev => {
      nextChanges = prev.filter(c => c.id !== id);
      return nextChanges;
    });

    syncTableToSheets("CAMBIO_PRODUCTOV2", nextChanges).then(res => {
      if (res.success) {
        addToast("Cambio de producto eliminado", "success");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveLaneStatus = (laneStatus: any) => {
    let exists = false;
    let nextLanes: any[] = [];
    const statusesToSave = Array.isArray(laneStatus) ? laneStatus : [laneStatus];

    setLaneStatuses(prev => {
      let current = [...prev];
      statusesToSave.forEach(status => {
        const idx = current.findIndex(x => x.id === status.id);
        if (idx > -1) {
          current[idx] = status;
          exists = true;
        } else {
          current = [status, ...current];
        }
      });
      nextLanes = current;
      return current;
    });

    syncTableToSheets("ESTADO_CALLESV2", nextLanes).then(res => {
      if (res.success) {
        addToast(
          Array.isArray(laneStatus)
            ? "Estados de calles actualizados con éxito"
            : (exists ? "Calle de carga actualizada con éxito" : "Calle de carga registrada con éxito"),
          "success"
        );
      } else {
        addToast("Registrada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteLaneStatus = (id: string) => {
    let nextLanes: any[] = [];
    setLaneStatuses(prev => {
      nextLanes = prev.filter(l => l.id !== id);
      return nextLanes;
    });

    syncTableToSheets("ESTADO_CALLESV2", nextLanes).then(res => {
      if (res.success) {
        addToast("Calle de carga eliminada", "success");
      } else {
        addToast("Eliminada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveFuelLoad = (load: any) => {
    let exists = false;
    let nextLoads: any[] = [];
    setFuelLoads(prev => {
      exists = !!prev.find(x => x.id === load.id);
      nextLoads = exists
        ? prev.map(x => x.id === load.id ? load : x)
        : [load, ...prev];
      return nextLoads;
    });

    syncTableToSheets("CARGA_COMBUSTIBLEV2", nextLoads).then(res => {
      if (res.success) {
        addToast(exists ? "Carga de combustible actualizada con éxito" : "Carga de combustible registrada con éxito", "success");
      } else {
        addToast("Guardada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteFuelLoad = (id: string) => {
    let nextLoads: any[] = [];
    setFuelLoads(prev => {
      nextLoads = prev.filter(e => e.id !== id);
      return nextLoads;
    });

    syncTableToSheets("CARGA_COMBUSTIBLEV2", nextLoads).then(res => {
      if (res.success) {
        addToast("Carga de combustible eliminada con éxito", "success");
      } else {
        addToast("Eliminada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
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
      totalTons = contextReports.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
      // Guard against BDP = 0 to avoid Infinity
      const sumTonsOverBDP = contextReports.reduce((sum, r) => sum + ((Number(r.tonsProduced) || 0) / (Number(r.bdp) || 100)), 0);
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
    <>
      <AnimatePresence mode="wait">
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full bg-[#1c1d24]/60 border border-white/10 p-10 rounded-2xl shadow-2xl flex flex-col items-center space-y-6">
              {/* Spinning Circle */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black tracking-tight text-white uppercase logo-glow">
                  PSCQUBE
                </h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.25em]">
                  Sincronizando Base de Datos
                </p>
              </div>

              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full animate-[pulse_2s_infinite] w-full" />
              </div>

              <p className="text-xs text-text-muted font-black uppercase tracking-widest leading-relaxed">
                {syncMessage}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!hasEnteredApp ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <WelcomeScreen 
              onEnter={()  => handleSyncOnEnter()} 
              onLoginSuccess={(user, email) => {
                sessionStorage.setItem('pscqube_user_dni', user.dni);
                sessionStorage.setItem('pscqube_user', JSON.stringify(user));
                sessionStorage.setItem('pscqube_google_email', email);
                handleSyncOnEnter(user.dni);
              }}
              addToast={addToast}
            />
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
            currentUser={currentUser}
            notifications={notifications}
            readNotificationKeys={readNotificationKeys}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNavigateToChange={() => {
              setActiveSection('PRODUCTIVITY');
              setProdTab('CHANGE');
            }}
            onLogout={async () => {
              try {
                const supabase = await getSupabaseClient();
                if (supabase) {
                  await supabase.auth.signOut();
                }
              } catch (e) {
                console.warn("[Logout Supabase SignOut Warning]", e);
              }
              sessionStorage.clear();
              window.location.reload();
            }}
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
                            className="flex items-center gap-2 no-scrollbar py-1 scroll-smooth px-4 touch-horizontal touch-pan-x overscroll-x-contain overflow-x-auto"
                          >
                            {canView('LOADING_LANES') && <ProductivitySubTab active={prodTab === 'LOADING_LANES'} onClick={() => setProdTab('LOADING_LANES')} icon={null} label="Calles Carga" />}
                            {canView('CHANGE') && <ProductivitySubTab active={prodTab === 'CHANGE'} onClick={() => setProdTab('CHANGE')} icon={<Bot size={14} />} label="Cambio Producto" />}
                            {canView('GASOIL') && <ProductivitySubTab active={prodTab === 'GASOIL'} onClick={() => setProdTab('GASOIL')} icon={<Droplet size={14} />} label="Combustible" />}
                            {canView('SCALE') && <ProductivitySubTab active={prodTab === 'SCALE'} onClick={() => setProdTab('SCALE')} icon={<Activity size={14} />} label="Control Balanzas" />}
                            {canView('DATER') && <ProductivitySubTab active={prodTab === 'DATER'} onClick={() => setProdTab('DATER')} icon={<ClipboardList size={14} />} label="Control Fechadores" />}
                            {canView('DASHBOARD') && <ProductivitySubTab active={prodTab === 'DASHBOARD'} onClick={() => setProdTab('DASHBOARD')} icon={<Activity size={14} />} label="Dashboard" />}
                            {canView('DESPACHOS') && <ProductivitySubTab active={prodTab === 'DESPACHOS'} onClick={() => setProdTab('DESPACHOS')} icon={<Truck size={14} />} label="Despachos" />}
                            {canView('STOCK') && <ProductivitySubTab active={prodTab === 'STOCK'} onClick={() => setProdTab('STOCK')} icon={<PlusCircle size={14} />} label="Insumos" />}
                            {canView('MANTENIMIENTO') && <ProductivitySubTab active={prodTab === 'MANTENIMIENTO'} onClick={() => setProdTab('MANTENIMIENTO')} icon={<Settings size={14} />} label="Mantenimiento" />}
                            {canView('PAROS') && <ProductivitySubTab active={prodTab === 'PAROS'} onClick={() => setProdTab('PAROS')} icon={<AlertTriangle size={14} />} label="Paros" />}
                            {canView('PRODUCCION') && <ProductivitySubTab active={prodTab === 'PRODUCCION'} onClick={() => setProdTab('PRODUCCION')} icon={<Package size={14} />} label="Producción" />}
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
                      onSave={handleSaveDispatch}
                      onDelete={handleDeleteDispatch}
                      selectedShiftId={userContext.selectedShiftId}
                      selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'PAROS' && (
                    <StopsView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveStop}
                        onDelete={handleDeleteStop}
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
                        onSave={handleSaveProductionReport}
                        onDelete={handleDeleteProductionReport}
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
                        onSave={handleSaveDaterControl}
                        onDelete={handleDeleteDaterControl}
                        history={daterControls.filter(c => c.shiftId === userContext.selectedShiftId && c.date === userContext.selectedDate)}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'SCALE' && (
                    <ScaleControlView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveScaleControl}
                        onDelete={handleDeleteScaleControl}
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
                        onSave={handleSaveInventory}
                        onDelete={handleDeleteInventory}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'CHANGE' && (
                    <ProductChangeView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={productChanges.filter(c => c.shiftId === userContext.selectedShiftId && c.date === userContext.selectedDate)}
                        onSave={handleSaveProductChange}
                        onDelete={handleDeleteProductChange}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'LOADING_LANES' && (
                    <LoadingLanesView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={laneStatuses.filter(l => l.shiftId === userContext.selectedShiftId && l.date === userContext.selectedDate)}
                        onSave={handleSaveLaneStatus}
                        onDelete={handleDeleteLaneStatus}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'GASOIL' && (
                    <FuelView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={fuelLoads.filter(f => (!f.shiftId || f.shiftId === userContext.selectedShiftId) && f.date === userContext.selectedDate)}
                        allFuelLoads={fuelLoads}
                        onSave={handleSaveFuelLoad}
                        onDelete={handleDeleteFuelLoad}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'MANTENIMIENTO' && (
                    <PlaceholderView title="Módulo: MANTENIMIENTO" type="PRODUCTIVITY" />
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
                      if (type === 'BAG_SUPPLIERS' || type === 'PROVEEDORES_BOLSA') setBagSuppliers(data);
                      if (type === 'VEHICULOS' || type === 'VEHICULES') setVehicles(data);

                      // Sincronización automática en tiempo real con Google Sheets
                      const cleanType = String(type).toUpperCase().trim();
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
                        PUNTOS_CARGA: "PUNTOS_CARGAV2",
                        LOADING_POINTS: "PUNTOS_CARGAV2",
                        BAG_SUPPLIERS: "PROVEEDORES_BOLSAV2",
                        PROVEEDORES_BOLSA: "PROVEEDORES_BOLSAV2",
                        VEHICULOS: "VEHICULOSV2",
                        VEHICLES: "VEHICULOSV2"
                      };
                      const suffix = tabSuffixMapping[cleanType];
                      
                      console.log(`[AutoSync] onUpdateMasters invocado. Tipo original: "${type}", Tipo limpio: "${cleanType}", Suffix: "${suffix || 'No encontrado'}"`, targetData);

                      if (suffix) {
                        syncTableToSheets(suffix, targetData)
                          .then(res => {
                            if (res.success) {
                              addToast(`Maestro ${cleanType} guardado y sincronizado con éxito`, "success");
                              console.log(`[AutoSync] Sincronización automática de ${suffix} exitosa en Google Sheets.`);
                            } else {
                              addToast(`Maestro guardado localmente (error sync: ${res.error})`, "warning");
                              console.warn(`[AutoSync] Falló la sincronización de ${suffix}:`, res.error);
                            }
                          })
                          .catch(err => {
                            addToast(`Maestro guardado localmente. Error de conexión.`, "warning");
                            console.error(`[AutoSync] Error crítico de red al sincronizar ${suffix}:`, err);
                          });
                      } else {
                        console.warn(`[AutoSync] No se encontró mapeo de sufijo para tabla: "${type}"`);
                      }
                    }}
                />
              )}
            </AnimatePresence>
          </main>

          <BottomNav activeSection={activeSection} onSectionChange={setActiveSection} />
          
          {/* Toast Notification Container */}
          <ToastContainer toasts={toasts} onClose={id => setToasts(prev => prev.filter(t => t.id !== id))} />
        </motion.div>
      )}
    </AnimatePresence>
   </>
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
