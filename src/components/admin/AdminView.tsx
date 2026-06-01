import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Settings,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  FileUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  Shield,
  LogIn,
  Database,
  CheckCircle2,
  Copy,
  Check,
  Cloud,
  CloudOff,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  MasterData,
  Shift,
  HAC,
  Cause,
  AppUser,
  UserPermission,
} from "../../types";
import * as XLSX from "xlsx";
import { cn } from "../../lib/utils";
import { DataTable, Column, TableActions } from "../ui/DataTable";
import {
  ConfirmModal,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassSearchableSelect,
} from "../ui/GlassUI";
import { SYSTEM_VIEWS } from "../../lib/mockData";
import {
  getSheetsApiUrl,
  isSheetsConnected,
  syncTableToSheets,
  fetchTableFromSheets,
  VERCEL_SETUP_GUIDE,
  getBackendSheetsStatus,
  clearClientCache,
} from "../../lib/sheetsService";

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  activeTab: "SHIFTS" | "MACHINES" | "HACS" | "CAUSES" | "CAPACITIES" | any;
  onTabChange: (tab: any) => void;
  onUpdateMasters: (type: string, data: any[]) => void;
  onUserSwitch?: (dni: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  let strA = String(hacA).trim().toUpperCase();
  let strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  // 1. Direct match
  if (strA === strB) return true;

  // 2. Clear alphanumeric match
  const cleanA = strA.replace(/[^A-Z0-9]/g, '');
  const cleanB = strB.replace(/[^A-Z0-9]/g, '');
  if (cleanA === "" || cleanB === "") return false;
  if (cleanA === cleanB) return true;

  // 3. Bidirectional inclusion
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // 4. Prefix/mid comparison by removing "MG" or similar standard prefixes
  const looseA = cleanA.startsWith("MG") ? cleanA.slice(2) : cleanA;
  const looseB = cleanB.startsWith("MG") ? cleanB.slice(2) : cleanB;
  if (looseA === looseB || looseA.includes(looseB) || looseB.includes(looseA)) return true;

  // 5. Split and check numerical similarity (e.g., 672, 673, 674)
  const partsA = strA.split(/[\s.\-_/]+/).filter(Boolean);
  const partsB = strB.split(/[\s.\-_/]+/).filter(Boolean);

  const hasNumA = partsA.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  const hasNumB = partsB.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  
  if (hasNumA && hasNumB) {
    // Check if they share a specific suffix portion (like BT1, PZ1, AM1)
    const suffixA = partsA.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    const suffixB = partsB.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    if (suffixA && suffixB && (suffixA.includes(suffixB) || suffixB.includes(suffixA))) {
      return true;
    }
    // If one is just the group (e.g. 672) and the other is specific (e.g. 672-BT1)
    if (partsA.length === 1 || partsB.length === 1) {
      return true;
    }
  }

  return false;
}

export function normalizeSearchText(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildCauseSearchIndex(cause: any, masters: MasterData): string[] {
  const parts: string[] = [];

  // Own cause fields
  if (cause.hac) parts.push(cause.hac);
  if (cause.text) parts.push(cause.text);
  if (cause.stopType) parts.push(cause.stopType);
  if (cause.partObject) parts.push(cause.partObject);
  if (cause.causeCode) parts.push(cause.causeCode);
  if (cause.sapCause) parts.push(cause.sapCause);
  if (cause.symptomGroup) parts.push(cause.symptomGroup);
  if (cause.symptomCode) parts.push(cause.symptomCode);
  if (cause.causeGroup) parts.push(cause.causeGroup);

  // Related HAC details
  const relatedHacs = (masters.hacs || []).filter(
    (h) => h.hac === cause.hac || safeHacMatch(h.hac, cause.hac)
  );
  relatedHacs.forEach((h) => {
    if (h.hac) parts.push(h.hac);
    if (h.detail) parts.push(h.detail);
    if (h.gpoCodObjeto) parts.push(h.gpoCodObjeto);
    if (h.equipment) parts.push(h.equipment);
  });

  // Related machines/equipments (palletizers) with matching HAC
  const relatedPalletizers = (masters.palletizers || []).filter(
    (p) => p.hacId === cause.hac || safeHacMatch(p.hacId, cause.hac)
  );
  relatedPalletizers.forEach((p) => {
    if (p.name) parts.push(p.name);
    if (p.hacId) parts.push(p.hacId);
  });

  // Related baggers with matching HAC
  const relatedBaggers = (masters.baggers || []).filter(
    (b) => b.hacId === cause.hac || safeHacMatch(b.hacId, cause.hac)
  );
  relatedBaggers.forEach((b) => {
    if (b.name) parts.push(b.name);
    if (b.hacId) parts.push(b.hacId);
  });

  return parts;
}

export default function AdminView({
  masters,
  currentUser,
  activeTab,
  onTabChange,
  onUpdateMasters,
  onUserSwitch,
  addToast,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshingActiveTab, setIsRefreshingActiveTab] = useState(false);

  const tabToSuffix: Record<string, string> = {
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
  };

  const handleRefreshActiveTab = async () => {
    const suffix = tabToSuffix[activeTab];
    if (!suffix) return;
    setIsRefreshingActiveTab(true);
    try {
      clearClientCache(suffix);
      const result = await fetchTableFromSheets(suffix, true);
      if (result.success && result.data) {
        onUpdateMasters(activeTab, result.data);
        if (addToast) {
          addToast(`Pestaña ${activeTab} actualizada con éxito desde Supabase.`, "success");
        }
      } else {
        if (addToast) {
          addToast("Error al renovar datos: " + (result.error || "Desconocido"), "error");
        }
      }
    } catch (e: any) {
      if (addToast) {
        addToast("Error de conexión: " + e.message, "error");
      }
    } finally {
      setIsRefreshingActiveTab(false);
    }
  };
  const [expandedHacs, setExpandedHacs] = useState<Record<string, boolean>>({});

  const toggleHac = (hacCode: string) => {
    setExpandedHacs((prev) => ({
      ...prev,
      [hacCode]: !prev[hacCode],
    }));
  };

  // States for Google Sheets V2 Integration
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    Record<
      string,
      { status: "idle" | "loading" | "success" | "error"; message?: string }
    >
  >({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    configured: boolean;
    email: string | null;
    sheetId: string | null;
    hasKey: boolean;
    diagnostics?: {
      envVariables: { hasEmail: boolean; hasKey: boolean; hasSheetId: boolean };
      emailPreview?: string;
      sheetIdPreview?: string;
      keyDetails?: {
        rawLength: number;
        cleanedLength: number;
        hasBeginHeader: boolean;
        hasEndFooter: boolean;
        newlineCountInCleaned: number;
        advice: string;
      };
      connectionTest?: {
        success: boolean;
        title?: string;
        sheetsFound?: string[];
        error?: string;
        hint?: string;
      };
    };
  }>({ configured: false, email: null, sheetId: null, hasKey: false });

  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  const refreshStatus = () => {
    setIsRefreshingStatus(true);
    getBackendSheetsStatus()
      .then((status) => {
        setBackendStatus(status);
        setIsRefreshingStatus(false);
      })
      .catch(() => {
        setIsRefreshingStatus(false);
      });
  };

  // Fetch credentials configuration status when rendering SHEETS pane
  useEffect(() => {
    if (activeTab === "SHEETS") {
      refreshStatus();
    }
  }, [activeTab]);

  const canView = (viewId: string) => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find((p) => p.viewId === viewId);
    return perm ? perm.level !== "NONE" : false;
  };

  const tabMapping: Record<string, string> = {
    SHIFTS: "TURNOS",
    MACHINES: "PALETIZADORAS",
    BAGGERS: "EMBOLSADORAS",
    EQUIPOS: "EQUIPOS",
    HACS: "EQUIPOS",
    CAUSES: "CAUSAS",
     MATERIALS: "MATERIALES",
    CAPACITIES: "CAPACIDADES",
    USERS: "USUARIOS",
    COMPANIES: "EMPRESAS",
    LOADING_POINTS: "PUNTOS_CARGA",
    PUNTOS_CARGA: "PUNTOS_CARGA",
    PROVEEDORES_BOLSA: "PROVEEDORES_BOLSA",
    VEHICULOS: "VEHICULOS",
  };

  const isVisible = (tab: string) => {
    if (tab === "SHEETS") return true;
    return canView(tabMapping[tab] || tab);
  };

  const isEditable = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const sectionId = tabMapping[activeTab] || activeTab;
    const perm = currentUser?.permissions?.find((p) => p.viewId === sectionId);
    return perm ? perm.level === "EDIT" : false;
  }, [currentUser, activeTab]);

  const sectionsList = useMemo(() => {
    return [
      { key: "CAPACITIES", label: "Capacidades" },
      { key: "CAUSES", label: "Causas" },
      { key: "COMPANIES", label: "Empresas" },
      { key: "BAGGERS", label: "Ensacadoras" },
      { key: "HACS", label: "Equipos" },
      { key: "MACHINES", label: "Maquinas" },
      { key: "MATERIALS", label: "Materiales" },
      { key: "PROVEEDORES_BOLSA", label: "Proveedores Bolsa" },
      { key: "PUNTOS_CARGA", label: "Puntos Carga" },
      { key: "SHIFTS", label: "Turnos" },
      { key: "USERS", label: "Usuarios" },
      { key: "VEHICULOS", label: "Vehículos" },
      { key: "SHEETS", label: "Conexión Sheets v2" },
    ].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, []);

  useEffect(() => {
    if (!isVisible(activeTab)) {
      const firstVisible = sectionsList
        .map((s) => s.key)
        .find((t) => isVisible(t));
      if (firstVisible) onTabChange(firstVisible);
    }
  }, [currentUser, activeTab, sectionsList]);

  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;
      if (activeBtn) {
        const container = scrollRef.current;
        const scrollLeft =
          activeBtn.offsetLeft -
          container.offsetWidth / 2 +
          activeBtn.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const getCurrentList = () => {
    if (activeTab === "SHIFTS") return masters.shifts;
    if (activeTab === "MACHINES") return masters.palletizers;
    if (activeTab === "BAGGERS") return masters.baggers;
    if (activeTab === "HACS") return masters.hacs;
    if (activeTab === "CAUSES") return masters.causes;
    if (activeTab === "MATERIALS") return masters.materials;
    if (activeTab === "CAPACITIES") return masters.capacities;
    if (activeTab === "USERS") return masters.users;
    if (activeTab === "COMPANIES") return masters.companies;
    if (activeTab === "PUNTOS_CARGA" || activeTab === "LOADING_POINTS")
      return masters.loadingPoints;
    if (activeTab === "PROVEEDORES_BOLSA") return masters.bagSuppliers || [];
    if (activeTab === "VEHICULOS") return masters.vehicles || [];
    return [];
  };

  const filteredData = useMemo(() => {
    const list = getCurrentList();
    let result = [...list];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      if (term !== "") {
        if (activeTab === "CAUSES") {
          const queryNorm = normalizeSearchText(term);
          result = result.filter((cause) => {
            const indexParts = buildCauseSearchIndex(cause, masters);
            return indexParts.some((part) => {
              const partNorm = normalizeSearchText(part);
              return partNorm.includes(queryNorm);
            });
          });
        } else {
          const cleanTerm = term.replace(/[^a-z0-9]/g, "");
          result = result.filter((item) => {
            // 1. If item has a HAC identifier, use the highly optimized bi-directional alphanumeric matcher
            const targetHac = (item as any).hac || (item as any).hacId || (item as any).hac_id;
            if (targetHac) {
              const cleanTarget = String(targetHac).toLowerCase().replace(/[^a-z0-9]/g, "");
              
              // Standard inclusion of clean strings
              if (cleanTarget.includes(cleanTerm) || cleanTerm.includes(cleanTarget)) {
                return true;
              }
              
              // Loose comparison removing standard "mg" prefix if any
              const looseTarget = cleanTarget.startsWith("mg") ? cleanTarget.substring(2) : cleanTarget;
              const looseQuery = cleanTerm.startsWith("mg") ? cleanTerm.substring(2) : cleanTerm;
              if (looseTarget && looseQuery && (looseTarget.includes(looseQuery) || looseQuery.includes(looseTarget))) {
                return true;
              }
            }

            // 2. Generic fallback search across all entries
            return Object.entries(item).some(([key, val]) => {
              if (val === undefined || val === null) return false;
              const strVal = String(val).toLowerCase();
              
              // Standard inclusion
              if (strVal.includes(term)) return true;
              
              // Loose alphanumeric inclusion on any string
              const cleanVal = strVal.replace(/[^a-z0-9]/g, "");
              if (cleanTerm && cleanVal.includes(cleanTerm)) return true;

              // Handled explicitly above, but keep as third fallback
              if (key === "hac" && safeHacMatch(val, term)) {
                return true;
              }
              
              return false;
            });
          });
        }
      }
    }

    // Apply sorting based on activeTab
    if (activeTab === "SHIFTS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "MATERIALS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "USERS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "PROVEEDORES_BOLSA") {
      result.sort((a: any, b: any) => {
        const nameA = a.nombre || "";
        const nameB = b.nombre || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "VEHICULOS") {
      result.sort((a: any, b: any) => {
        const nameA = a.identificación || "";
        const nameB = b.identificación || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "CAPACITIES") {
      result.sort((a: any, b: any) => {
        const pNameA =
          masters.palletizers.find((p) => p.id === a.palletizerId)?.name || "";
        const pNameB =
          masters.palletizers.find((p) => p.id === b.palletizerId)?.name || "";
        const pCompare = pNameA.localeCompare(pNameB, "es", {
          sensitivity: "base",
        });
        if (pCompare !== 0) return pCompare;

        const bNameA =
          masters.baggers.find((bg) => bg.id === a.baggerId)?.name || "";
        const bNameB =
          masters.baggers.find((bg) => bg.id === b.baggerId)?.name || "";
        const bCompare = bNameA.localeCompare(bNameB, "es", {
          sensitivity: "base",
        });
        if (bCompare !== 0) return bCompare;

        const mNameA =
          masters.materials.find((m) => m.id === a.materialId)?.name || "";
        const mNameB =
          masters.materials.find((m) => m.id === b.materialId)?.name || "";
        return mNameA.localeCompare(mNameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "CAUSES") {
      result.sort((a: any, b: any) => {
        const hacA = String(a.hac || "").trim();
        const hacB = String(b.hac || "").trim();
        const hacCompare = hacA.localeCompare(hacB, "es", {
          sensitivity: "base",
          numeric: true,
        });
        if (hacCompare !== 0) return hacCompare;

        const textA = String(a.text || "").trim();
        const textB = String(b.text || "").trim();
        return textA.localeCompare(textB, "es", {
          sensitivity: "base",
          numeric: true,
        });
      });
    }

    return result;
  }, [masters, activeTab, searchTerm]);

  const groupedCapacities = useMemo(() => {
    if (activeTab !== "CAPACITIES") return [];

    // Group filteredData capacities by palletizerId
    const palletizerIds = Array.from(
      new Set(filteredData.map((c: any) => c.palletizerId)),
    );

    const groups = palletizerIds.map((pId) => {
      const palletizerObj = masters.palletizers.find((p) => p.id === pId) || {
        id: pId,
        name: `Paletizadora Desconocida (${pId})`,
      };
      const items = filteredData.filter((c: any) => c.palletizerId === pId);
      return {
        palletizer: palletizerObj,
        capacities: items,
      };
    });

    // Sort the groups by palletizer name alphabetically
    groups.sort((a, b) =>
      a.palletizer.name.localeCompare(b.palletizer.name, "es", {
        sensitivity: "base",
      }),
    );

    return groups;
  }, [filteredData, activeTab, masters.palletizers]);

  const groupedCauses = useMemo(() => {
    if (activeTab !== "CAUSES") return [];

    const groups: Record<string, Cause[]> = {};
    filteredData.forEach((cause: any) => {
      const key = cause.hac || "SIN_HAC";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(cause);
    });

    return Object.entries(groups)
      .map(([hacKey, items]) => {
        const hacObj = (masters.hacs || []).find(
          (h) => h.hac === hacKey || safeHacMatch(h.hac, hacKey)
        );
        return {
          hac: hacKey,
          hacDetail: hacObj ? hacObj.detail : "",
          causes: items.sort((a, b) =>
            String(a.text || "").localeCompare(String(b.text || ""), "es", {
              sensitivity: "base",
              numeric: true,
            })
          ),
        };
      })
      .sort((a, b) => a.hac.localeCompare(b.hac, "es", { sensitivity: "base" }));
  }, [filteredData, activeTab, masters.hacs]);

  const handleDelete = () => {
    if (!deletingId) return;
    const list = getCurrentList() as any[];
    let newList;
    if (activeTab === "CAPACITIES") {
      newList = list.filter(
        (i) => `${i.palletizerId}-${i.baggerId}-${i.materialId}` !== deletingId,
      );
    } else if (activeTab === "USERS") {
      newList = list.filter((i) => i.dni !== deletingId);
    } else {
      newList = list.filter((i) => i.id !== deletingId);
    }
    onUpdateMasters(activeTab, newList);
    setDeletingId(null);
  };

  const handleSave = (item: any) => {
    const list = getCurrentList() as any[];
    let newList;
    const isEdit =
      activeTab === "CAPACITIES"
        ? list.some(
            (i) =>
              `${i.palletizerId}-${i.baggerId}-${i.materialId}`.trim().toLowerCase() ===
              `${item.palletizerId}-${item.baggerId}-${item.materialId}`.trim().toLowerCase(),
          )
        : activeTab === "USERS"
          ? list.some((i) => String(i.dni).trim() === String(item.dni).trim())
          : list.some(
              (i) =>
                (i.id !== undefined && i.id !== null && String(i.id).trim().toUpperCase() === String(item.id).trim().toUpperCase()) ||
                (i.ID !== undefined && i.ID !== null && String(i.ID).trim().toUpperCase() === String(item.id).trim().toUpperCase())
            );

    if (isEdit) {
      if (activeTab === "CAPACITIES") {
        newList = list.map((i) =>
          `${i.palletizerId}-${i.baggerId}-${i.materialId}`.trim().toLowerCase() ===
          `${item.palletizerId}-${item.baggerId}-${item.materialId}`.trim().toLowerCase()
            ? item
            : i,
        );
      } else if (activeTab === "USERS") {
        newList = list.map((i) => (String(i.dni).trim() === String(item.dni).trim() ? item : i));
      } else {
        newList = list.map((i) => {
          const iId = String(i.id || i.ID || "").trim().toUpperCase();
          const itemId = String(item.id || item.ID || "").trim().toUpperCase();
          return iId === itemId ? item : i;
        });
      }
    } else {
      newList = [item, ...list];
    }
    onUpdateMasters(activeTab, newList);
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const actionsColumn = (row?: any): Column<any> => ({
    header: "Acciones",
    align: "right",
    accessor: (r) =>
      isEditable ? (
        <TableActions
          onEdit={() => {
            setEditingItem(r);
            setIsFormOpen(true);
          }}
          onDelete={() => {
            let id = r.id;
            if (activeTab === "CAPACITIES")
              id = `${r.palletizerId}-${r.baggerId}-${r.materialId}`;
            if (activeTab === "USERS") id = r.dni;
            setDeletingId(id);
          }}
        />
      ) : (
        <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">
          Lectura
        </span>
      ),
  });

  const shiftColumns: Column<any>[] = [
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Inicio", accessor: "startTime" },
    { header: "Fin", accessor: "endTime" },
    {
      header: "Hs",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.durationHours}H</span>
      ),
    },
    actionsColumn(),
  ];

  const machineColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "HAC ID", accessor: "hacId" },
    actionsColumn(),
  ];

  const baggerColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "HAC", accessor: "hacId" },
    {
      header: "Boquillas",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.nozzles}</span>
      ),
    },
    {
      header: "P. MUESTREO",
      align: "center",
      accessor: (row) =>
        row.isSamplingPoint ? (
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)] mx-auto" />
        ) : null,
    },
    actionsColumn(),
  ];

  const hacColumns: Column<any>[] = [
    {
      header: "HAC",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.hac}</span>
      ),
    },
    {
      header: "Detalle",
      accessor: (row) => (
        <span className="font-bold text-text-main uppercase">{row.detail}</span>
      ),
    },
    { header: "GPO Cód. Objeto", accessor: "gpoCodObjeto" },
    { header: "Equipo", accessor: "equipment" },
    {
      header: "Ctrl F/B",
      align: "center",
      accessor: (row) => (
        <div className="flex justify-center gap-1.5">
          {row.isDater && (
            <div
              className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"
              title="Fechador"
            />
          )}
          {row.isScale && (
            <div
              className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse"
              title="Balanza"
            />
          )}
        </div>
      ),
    },
    actionsColumn(),
  ];

  const causeColumns: Column<any>[] = [
    {
      header: "HAC",
      accessor: (row) => (
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
          {row.hac}
        </span>
      ),
    },
    {
      header: "Texto de Causa",
      accessor: (row) => (
        <span className="font-bold text-text-main uppercase leading-tight block max-w-[200px] truncate">
          {row.text}
        </span>
      ),
    },
    {
      header: "Tipo",
      accessor: (row) => (
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[9px] font-bold border uppercase",
            row.stopType === "INTERNO"
              ? "border-primary/20 text-primary bg-primary/5"
              : "border-emerald-500/20 text-emerald-500 bg-emerald-500/5",
          )}
        >
          {row.stopType}
        </span>
      ),
    },
    {
      header: "PARTE/CAUSA SAP",
      accessor: (row) => (
        <span className="text-[9px] font-mono opacity-70">
          P: {row.partObject} / C: {row.causeCode}
        </span>
      ),
    },
    actionsColumn(),
  ];

  const materialColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Código SAP", accessor: "code" },
    {
      header: "P. Embalaje",
      accessor: (row) => (
        <span className="font-mono text-[10px]">{row.packingWeight}kg</span>
      ),
    },
    {
      header: "P. Bolsa",
      accessor: (row) => (
        <span className="font-mono text-[10px]">{row.bagWeight}kg</span>
      ),
    },
    {
      header: "Atributos",
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isPallet && (
            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              PALLET
            </span>
          )}
          {row.isProductive && (
            <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              PROD
            </span>
          )}
          {row.isSupply && (
            <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              INSUMO
            </span>
          )}
          {row.isBigBag && (
            <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              BIGBAG
            </span>
          )}
          {row.isDispatch && (
            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              DESPACHO
            </span>
          )}
        </div>
      ),
    },
    actionsColumn(),
  ];

  const capacityColumns: Column<any>[] = [
    {
      header: "Paletizadora",
      accessor: (row) =>
        masters.palletizers.find((p) => p.id === row.palletizerId)?.name ||
        "N/A",
    },
    {
      header: "Ensacadora",
      accessor: (row) =>
        masters.baggers.find((b) => b.id === row.baggerId)?.name || "N/A",
    },
    {
      header: "Material",
      accessor: (row) =>
        masters.materials.find((m) => m.id === row.materialId)?.name || "N/A",
    },
    {
      header: "BDP",
      accessor: (row) => (
        <span className="font-black text-text-main">{row.bdp} TN/H</span>
      ),
    },
    actionsColumn(),
  ];

  const companyColumns: Column<any>[] = [
    {
      header: "Empresa",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "CUIT", accessor: "taxId" },
    {
      header: "Dirección",
      accessor: (row) => (
        <span className="text-[10px] opacity-70">{row.address}</span>
      ),
    },
    actionsColumn(),
  ];

  const loadingPointColumns: Column<any>[] = [
    {
      header: "Punto de Carga",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    {
      header: "Tipo",
      accessor: (row) => (
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
            row.type === "BOLSA"
              ? "border-blue-500/20 text-blue-500 bg-blue-500/5"
              : "border-amber-500/20 text-amber-500 bg-amber-500/5",
          )}
        >
          {row.type}
        </span>
      ),
    },
    actionsColumn(),
  ];

  const bagSupplierColumns: Column<any>[] = [
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.nombre}</span>
      ),
    },
    { header: "Dirección", accessor: "direccion" },
    { header: "Teléfono", accessor: "telefono" },
    { header: "Email", accessor: "email" },
    actionsColumn(),
  ];

  const vehicleColumns: Column<any>[] = [
    {
      header: "Identificación",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.identificación}</span>
      ),
    },
    { header: "Marca", accessor: "marca" },
    { header: "Tipo", accessor: "tipo" },
    { header: "Carga Máxima", accessor: "carga_maxima" },
    actionsColumn(),
  ];

  const userColumns: Column<AppUser>[] = [
    { header: "DNI / Legajo", accessor: "dni" },
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Usuario RED / SAP", accessor: "sapUser" },
    {
      header: "Email",
      accessor: (row) => (
        <span className="text-[10px] opacity-70">{row.email}</span>
      ),
    },
    {
      header: "Acciones",
      align: "right",
      accessor: (row) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onUserSwitch?.(row.dni)}
            title="Simular Login"
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              currentUser.dni === row.dni
                ? "bg-primary text-white"
                : "bg-surface text-text-muted hover:text-primary border border-border",
            )}
          >
            <LogIn size={14} />
          </button>
          <TableActions
            onEdit={() => {
              setEditingItem(row);
              setIsFormOpen(true);
            }}
            onDelete={() => setDeletingId(row.dni)}
          />
        </div>
      ),
    },
  ];

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      processImportedData(data);
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // Reset input
  };

  const processImportedData = (data: any[]) => {
    const list = getCurrentList() as any[];
    const newList = [...list];

    data.forEach((row) => {
      let item: any = {};

      if (activeTab === "HACS") {
        item = {
          id: `HAC-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ""),
          detail: String(row["Detalle HAC"] || row.detail || ""),
          gpoCodObjeto: String(
            row["GPO.CÓD. OBJETO"] || row.gpoCodObjeto || "",
          ),
          equipment: String(row.EQUIPO || row.equipment || ""),
          isDater: !!(row["Control Fechador?"] || row.isDater),
          isScale: !!(row["Control Balanza?"] || row.isScale),
        };
      } else if (activeTab === "CAUSES") {
        item = {
          id: `PARO-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ""),
          text: String(row["TEXTO DE CAUSA"] || row.text || ""),
          partObject: String(row["PARTE OBJETO"] || row.partObject || ""),
          symptomGroup: String(
            row["GPO.CÓD. SINTOMA"] || row.symptomGroup || "",
          ),
          symptomCode: String(row["CÓD. SINTOMA"] || row.symptomCode || ""),
          sapCause: String(row["CAUSA SAP"] || row.sapCause || ""),
          causeGroup: String(row["GPO.COD. CAUSA"] || row.causeGroup || ""),
          causeCode: String(row["CÓDIGO CAUSA"] || row.causeCode || ""),
          stopType:
            String(row["TIPO PARO"] || row.stopType || "").toUpperCase() ===
            "EXTERNO"
              ? "EXTERNO"
              : "INTERNO",
        };
      } else {
        // Basic generic mapping for other tabs if they want to try
        item = { ...row };
        if (!item.id)
          item.id = Math.random().toString(36).substr(2, 6).toUpperCase();
      }

      if (item.id) newList.push(item);
    });

    onUpdateMasters(activeTab, newList);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="layout-container py-8 relative"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="text-primary" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-main tracking-tight uppercase">
              Gestión de Maestros
            </h3>
            <p className="text-xs text-text-muted font-medium">
              Configuración centralizada de catálogos y sistemas.
            </p>
          </div>
        </div>

        <div className="relative group overflow-hidden">
          {/* Carousel Arrows - Only visible on desktop hover */}
          <div className="absolute inset-y-0 left-0 items-center pl-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollBy({
                    left: -150,
                    behavior: "smooth",
                  });
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
                if (scrollRef.current) {
                  scrollRef.current.scrollBy({ left: 150, behavior: "smooth" });
                }
              }}
              className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Carousel edge masks */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex bg-bg-input/50 p-1.5 rounded-2xl border border-border overflow-x-auto gap-1 no-scrollbar select-none min-w-0 shadow-sm scroll-smooth px-6"
          >
            {sectionsList.map((sec) =>
              isVisible(sec.key) ? (
                <AdminSubTab
                  key={sec.key}
                  active={activeTab === sec.key}
                  onClick={() => onTabChange(sec.key)}
                  label={sec.label}
                />
              ) : null
            )}
          </div>
        </div>
      </div>

      {activeTab === "SHEETS" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Connection Header and Vercel guidance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-surface border border-border rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

              <div>
                <div className="flex items-center gap-3">
                  {backendStatus.configured ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Cloud size={20} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <CloudOff size={20} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-black text-text-main uppercase tracking-wider">
                      Variables de Entorno en Vercel
                    </h4>
                    <p className="text-xs text-text-muted mt-0.5">
                      {backendStatus.configured
                        ? "Credenciales de Google Service Account detectadas por el Servidor backend."
                        : "Falta configurar variables de integración de Google Sheets en tu dashboard de Vercel."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-bg rounded-xl border border-border space-y-3">
                    <div>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                        Cuenta de Servicio (EMAIL)
                      </p>
                      <p className="font-mono text-xs text-text-main font-semibold mt-1">
                        {backendStatus.email || (
                          <span className="text-red-500 font-bold">
                            FALTA: GOOGLE_SERVICE_ACCOUNT_EMAIL
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="border-t border-border pt-2">
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                        ID del Documento (SHEET ID)
                      </p>
                      <p className="font-mono text-xs text-text-main font-semibold mt-1">
                        {backendStatus.sheetId || (
                          <span className="text-red-500 font-bold">
                            FALTA: GOOGLE_SHEET_ID
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="border-t border-border pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                          Clave Privada JWT (KEY)
                        </p>
                        <p className="font-mono text-xs text-text-main font-semibold mt-1">
                          {backendStatus.hasKey ? (
                            "••••••••••••••••••••••••••••••••"
                          ) : (
                            <span className="text-red-500 font-bold">
                              FALTA: GOOGLE_SERVICE_ACCOUNT_KEY
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-widest px-2.5 py-1 rounded font-bold",
                          backendStatus.hasKey
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500",
                        )}
                      >
                        {backendStatus.hasKey ? "PRESENTE" : "AUSENTE"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-xs font-semibold text-text-muted flex items-center gap-2">
                  <Info size={14} className="text-primary" />
                  <span>
                    Al sincronizar, las pestañas tendrán el sufijo{" "}
                    <strong className="text-primary font-black">V2</strong>.
                  </span>
                </div>

                <button
                  disabled={!backendStatus.configured || isSyncingAll}
                  onClick={async () => {
                    setIsSyncingAll(true);
                    const items = [
                      {
                        suffix: "TURNOSV2",
                        type: "SHIFTS",
                        data: masters.shifts,
                      },
                      {
                        suffix: "PALETIZADORAV2",
                        type: "MACHINES",
                        data: masters.palletizers,
                      },
                      {
                        suffix: "ENSACADORAV2",
                        type: "BAGGERS",
                        data: masters.baggers,
                      },
                      { suffix: "HACSV2", type: "HACS", data: masters.hacs },
                      {
                        suffix: "CAUSASV2",
                        type: "CAUSES",
                        data: masters.causes,
                      },
                      {
                        suffix: "MATERIALESV2",
                        type: "MATERIALS",
                        data: masters.materials,
                      },
                      {
                        suffix: "CAPACIDADESV2",
                        type: "CAPACITIES",
                        data: masters.capacities,
                      },
                      {
                        suffix: "USUARIOSV2",
                        type: "USERS",
                        data: masters.users,
                      },
                      {
                        suffix: "EMPRESASV2",
                        type: "COMPANIES",
                        data: masters.companies,
                      },
                      {
                        suffix: "PUNTOS_CARGAV2",
                        type: "PUNTOS_CARGA",
                        data: masters.loadingPoints,
                      },
                    ];
                    for (const item of items) {
                      setSyncStatus((prev) => ({
                        ...prev,
                        [item.suffix]: { status: "loading" },
                      }));
                      const result = await syncTableToSheets(
                        item.suffix,
                        item.data,
                      );
                      if (result.success) {
                        setSyncStatus((prev) => ({
                          ...prev,
                          [item.suffix]: {
                            status: "success",
                            message: `Enviados ${item.data.length}`,
                          },
                        }));
                      } else {
                        setSyncStatus((prev) => ({
                          ...prev,
                          [item.suffix]: {
                            status: "error",
                            message: result.error || "Fallo",
                          },
                        }));
                      }
                    }
                    setIsSyncingAll(false);
                  }}
                  className="px-4 h-10 rounded-lg font-bold text-xs bg-primary text-white flex items-center gap-2 hover:bg-primary/95 transition-all outline-none disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-sm uppercase tracking-widest text-center justify-center w-full sm:w-auto"
                >
                  <RefreshCw
                    size={14}
                    className={cn("text-white", isSyncingAll && "animate-spin")}
                  />
                  {isSyncingAll ? "Sincronizando..." : "Sincronizar Todas (V2)"}
                </button>
              </div>
            </div>

            <div className="p-6 bg-surface border border-border rounded-xl flex flex-col justify-between shadow-sm">
              <div>
                <h4 className="text-sm font-black text-text-main uppercase tracking-wider">
                  Integración Holcim Servidor
                </h4>
                <div className="mt-4 flex items-center gap-3 p-3.5 rounded-xl bg-bg/50 border border-border">
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full flex items-center justify-center relative",
                      backendStatus.configured
                        ? "text-emerald-500"
                        : "text-amber-500",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full animate-ping opacity-70",
                        backendStatus.configured
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                      )}
                    />
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        backendStatus.configured
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                      )}
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-text-main uppercase tracking-wide">
                      {backendStatus.configured
                        ? "DIRECCIONADA EN VERCEL"
                        : "MODO LOCAL DESCONECTADO"}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {backendStatus.configured
                        ? "Google Sheets con Service Account"
                        : "Usando tablas internas de sesión"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-xs text-text-muted">
                <p className="flex items-start gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>
                    Escribe y actualiza cualquier maestro en la app local.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>
                    Presiona <strong>Enviar</strong> para guardar la tabla en
                    Google Sheets.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>
                    Presiona <strong>Traer</strong> para cargar datos remotos a
                    tu sesión de Vercel.
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Diagnostics Panel */}
          {backendStatus.diagnostics && (
            <div className="p-6 bg-surface border border-border rounded-xl shadow-sm relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-text-main uppercase tracking-wider">
                      Panel de Diagnóstico en Tiempo Real
                    </h4>
                    <p className="text-xs text-text-muted mt-0.5">
                      Evaluación de autenticación y enlace dinámico con el documento de Google.
                    </p>
                  </div>
                </div>

                <button
                  onClick={refreshStatus}
                  disabled={isRefreshingStatus}
                  className="px-4 h-9 rounded-lg border border-border bg-bg hover:bg-bg/80 text-text-main text-xs font-bold uppercase tracking-widest flex items-center gap-2 outline-none transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={cn(isRefreshingStatus && "animate-spin")}
                  />
                  {isRefreshingStatus ? "Reevaluando..." : "Probar Enlace"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Test Section */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    Prueba de Enlace Directo (Google Sheets API)
                  </h5>

                  {backendStatus.diagnostics.connectionTest ? (
                    backendStatus.diagnostics.connectionTest.success ? (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide">
                          <CheckCircle2 size={16} />
                          <span>¡Conexión Exitosa con Google Sheet!</span>
                        </div>
                        <p className="text-xs text-emerald-500/80 leading-relaxed">
                          La aplicación se comunicó de forma segura con el
                          documento{" "}
                          <strong className="text-emerald-500 underline">
                            "
                            {backendStatus.diagnostics.connectionTest.title}
                            "
                          </strong>{" "}
                          y tiene permisos de lectura/escritura.
                        </p>
                        {backendStatus.diagnostics.connectionTest
                          .sheetsFound && (
                          <div className="pt-2 border-t border-emerald-500/10">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/60">
                              Hojas encontradas en el documento (
                              {
                                backendStatus.diagnostics.connectionTest
                                  .sheetsFound.length
                              }
                              ):
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {backendStatus.diagnostics.connectionTest.sheetsFound.map(
                                (name: string) => (
                                  <span
                                    key={name}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 uppercase font-mono"
                                  >
                                    {name}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 font-black text-xs text-red-500 uppercase tracking-wide">
                          <AlertTriangle size={16} className="text-red-500" />
                          <span>Fallo de Enlace Directo</span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">
                            ERROR RETORNADO POR CLIENTE GOOGLE SHEETS:
                          </p>
                          <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] font-mono text-red-400 break-all overflow-auto max-h-24 select-text leading-normal">
                            {backendStatus.diagnostics.connectionTest.error}
                          </div>
                        </div>

                        <div className="p-3 bg-amber-500/5 border border-amber-500/10 text-amber-500 rounded-lg space-y-1">
                          <p className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1">
                            <Info size={11} /> CONSEJO DIRECTO DE RESOLUCIÓN:
                          </p>
                          <p className="text-[11px] font-medium leading-relaxed">
                            {backendStatus.diagnostics.connectionTest.hint}
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="p-4 bg-bg rounded-xl border border-border text-center py-6 text-xs text-text-muted">
                      Completa los tres campos de variable en Vercel para iniciar
                      la prueba dinámica de enlace.
                    </div>
                  )}
                </div>

                {/* Private Key Format Check Section */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    Análisis de Formato de Clave Privada (JWT KEY)
                  </h5>

                  {backendStatus.diagnostics.keyDetails ? (
                    <div className="p-4 bg-bg border border-border rounded-xl space-y-3.5">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-2 border border-border bg-bg-input/20 rounded-lg">
                          <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider block">
                            Longitud Inicial
                          </span>
                          <span className="text-xs font-black text-text-main font-mono">
                            {backendStatus.diagnostics.keyDetails.rawLength}{" "}
                            carac.
                          </span>
                        </div>
                        <div className="p-2 border border-border bg-bg-input/20 rounded-lg">
                          <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider block">
                            Saltos de Línea
                          </span>
                          <span className="text-xs font-black text-text-main font-mono">
                            {
                              backendStatus.diagnostics.keyDetails
                                .newlineCountInCleaned
                            }{" "}
                            saltos
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-[11px] text-text-muted font-semibold">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span>¿Contiene cabecera -----BEGIN PRIVATE KEY-----?</span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold",
                              backendStatus.diagnostics.keyDetails
                                .hasBeginHeader
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-red-500/10 text-red-500",
                            )}
                          >
                            {backendStatus.diagnostics.keyDetails
                              .hasBeginHeader
                              ? "SÍ"
                              : "NO"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span>¿Contiene pie -----END PRIVATE KEY-----?</span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold",
                              backendStatus.diagnostics.keyDetails.hasEndFooter
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-red-500/10 text-red-500",
                            )}
                          >
                            {backendStatus.diagnostics.keyDetails.hasEndFooter
                              ? "SÍ"
                              : "NO"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Longitud tras limpieza:</span>
                          <span className="font-mono font-bold text-text-main">
                            {backendStatus.diagnostics.keyDetails.cleanedLength}{" "}
                            carac.
                          </span>
                        </div>
                      </div>

                      {backendStatus.diagnostics.keyDetails.advice && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-500/90 text-[11px] rounded-lg leading-relaxed">
                          ⚠️ <strong>Atención:</strong>{" "}
                          {backendStatus.diagnostics.keyDetails.advice}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-bg rounded-xl border border-border text-center py-6 text-xs text-text-muted">
                      No hay una clave privada provista para el análisis.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tables Mapping list & individual actions */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-bg-input/30 border-b border-border flex justify-between items-center">
              <h4 className="text-xs font-black text-text-main uppercase tracking-widest flex items-center gap-2">
                <Database size={14} className="text-primary" />
                MÁPEO Y SINCRONIZACIÓN DE HOJAS DE RUTA (TABLAS V2)
              </h4>
              <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase">
                Estructuras terminadas en V2
              </span>
            </div>

            <div className="divide-y divide-border">
              {[
                {
                  label: "Turnos",
                  suffix: "TURNOSV2",
                  type: "SHIFTS",
                  data: masters.shifts,
                },
                {
                  label: "Paletizadoras",
                  suffix: "PALETIZADORAV2",
                  type: "MACHINES",
                  data: masters.palletizers,
                },
                {
                  label: "Ensacadoras",
                  suffix: "ENSACADORAV2",
                  type: "BAGGERS",
                  data: masters.baggers,
                },
                {
                  label: "Equipos (HAC)",
                  suffix: "HACSV2",
                  type: "HACS",
                  data: masters.hacs,
                },
                {
                  label: "Causas de Paros",
                  suffix: "CAUSASV2",
                  type: "CAUSES",
                  data: masters.causes,
                },
                {
                  label: "Materiales",
                  suffix: "MATERIALESV2",
                  type: "MATERIALS",
                  data: masters.materials,
                },
                {
                  label: "Capacidades",
                  suffix: "CAPACIDADESV2",
                  type: "CAPACITIES",
                  data: masters.capacities,
                },
                {
                  label: "Usuarios (USUARIO2)",
                  suffix: "USUARIOSV2",
                  type: "USERS",
                  data: masters.users,
                },
                {
                  label: "Empresas",
                  suffix: "EMPRESASV2",
                  type: "COMPANIES",
                  data: masters.companies,
                },
                {
                  label: "Puntos Carga",
                  suffix: "PUNTOS_CARGAV2",
                  type: "PUNTOS_CARGA",
                  data: masters.loadingPoints,
                },
              ].map((tbl) => {
                const status = syncStatus[tbl.suffix];
                return (
                  <div
                    key={tbl.suffix}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-bg/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-1.5 h-6 bg-primary/30 rounded-full" />
                      <div>
                        <span className="text-xs font-bold text-text-main block uppercase">
                          {tbl.label}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted mt-0.5 uppercase tracking-wide">
                          Hoja de cálculo:{" "}
                          <strong className="text-primary font-semibold">
                            {tbl.suffix}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Count and state */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="px-3 py-1.5 bg-bg border border-border rounded-lg text-center min-w-32">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                          Registros Locales
                        </span>
                        <span className="text-xs font-black text-text-main">
                          {tbl.data.length} ítems
                        </span>
                      </div>

                      {status && (
                        <div
                          className={cn(
                            "px-3 py-1 bg-border/20 border text-[10px] font-bold rounded-lg flex items-center gap-1.5 max-w-xs",
                            status.status === "loading" &&
                              "border-primary/20 text-primary bg-primary/5",
                            status.status === "success" &&
                              "border-emerald-500/20 text-emerald-500 bg-emerald-500/5",
                            status.status === "error" &&
                              "border-red-500/20 text-red-500 bg-red-500/5",
                          )}
                        >
                          {status.status === "loading" && (
                            <RefreshCw
                              size={11}
                              className="animate-spin text-primary"
                            />
                          )}
                          {status.status === "success" && (
                            <CheckCircle2
                              size={11}
                              className="text-emerald-500"
                            />
                          )}
                          <span className="truncate">
                            {status.status === "loading"
                              ? "Transmitiendo..."
                              : status.message}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          disabled={
                            !backendStatus.configured ||
                            isSyncingAll ||
                            status?.status === "loading"
                          }
                          onClick={async () => {
                            setSyncStatus((prev) => ({
                              ...prev,
                              [tbl.suffix]: { status: "loading" },
                            }));
                            const result = await syncTableToSheets(
                              tbl.suffix,
                              tbl.data,
                            );
                            if (result.success) {
                              setSyncStatus((prev) => ({
                                ...prev,
                                [tbl.suffix]: {
                                  status: "success",
                                  message: `Enviados ${tbl.data.length}`,
                                },
                              }));
                            } else {
                              setSyncStatus((prev) => ({
                                ...prev,
                                [tbl.suffix]: {
                                  status: "error",
                                  message: result.error || "Fallo",
                                },
                              }));
                            }
                          }}
                          className="h-8 px-3 rounded bg-surface border border-border text-[10px] font-bold uppercase tracking-widest text-text-main flex items-center gap-1.5 hover:bg-bg outline-none transition-all hover:border-primary/30 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                        >
                          <ArrowUpCircle size={12} className="text-primary" />
                          Enviar
                        </button>

                        <button
                          disabled={
                            !backendStatus.configured ||
                            isSyncingAll ||
                            status?.status === "loading"
                          }
                          onClick={async () => {
                            setSyncStatus((prev) => ({
                              ...prev,
                              [tbl.suffix]: { status: "loading" },
                            }));
                            const result = await fetchTableFromSheets(
                              tbl.suffix,
                            );
                            if (result.success && result.data) {
                              onUpdateMasters(tbl.type, result.data);
                              setSyncStatus((prev) => ({
                                ...prev,
                                [tbl.suffix]: {
                                  status: "success",
                                  message: `Recibidos ${result.data.length}`,
                                },
                              }));
                            } else {
                              setSyncStatus((prev) => ({
                                ...prev,
                                [tbl.suffix]: {
                                  status: "error",
                                  message: result.error || "Vacía / Error",
                                },
                              }));
                            }
                          }}
                          className="h-8 px-3 rounded bg-surface border border-border text-[10px] font-bold uppercase tracking-widest text-text-main flex items-center gap-1.5 hover:bg-bg outline-none transition-all hover:border-emerald-500/30 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                        >
                          <ArrowDownCircle
                            size={12}
                            className="text-emerald-500"
                          />
                          Traer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Google Service Account setup instructions guide */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-surface border border-border rounded-xl shadow-sm space-y-4">
              <h4 className="text-sm font-black text-text-main uppercase tracking-wider">
                Instrucciones de Servicio
              </h4>
              <div className="space-y-3.5 text-xs text-text-muted font-medium">
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary">
                    1
                  </div>
                  <p className="flex-1 leading-relaxed">
                    Crea una <strong>Cuenta de Servicio</strong> en Google Cloud
                    Console.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary">
                    2
                  </div>
                  <p className="flex-1 leading-relaxed">
                    Genera y descarga la clave <strong>JSON</strong> de esa
                    cuenta.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary">
                    3
                  </div>
                  <p className="flex-1 leading-relaxed">
                    Copia ese correo electronico de servicio y{" "}
                    <strong>compártele</strong> tu planilla de Google Sheet con
                    permisos de <strong>Editor</strong>.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary">
                    4
                  </div>
                  <p className="flex-1 leading-relaxed">
                    Ingresa a Vercel y añade las tres variables descritas a la
                    derecha.
                  </p>
                </div>
              </div>
            </div>

            {/* Code Block paste container */}
            <div className="lg:col-span-2 p-6 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col justify-between shadow-lg relative">
              <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="font-mono text-[10px] text-neutral-400 font-bold ml-2">
                    vercel-credentials-guide.md
                  </span>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(VERCEL_SETUP_GUIDE);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="h-8 px-3 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all outline-none"
                >
                  {copiedScript ? (
                    <>
                      <Check
                        size={12}
                        className="text-emerald-500 animate-pulse"
                      />
                      <span className="text-emerald-500">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copiar Guía</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 flex-1 max-h-[220px] overflow-auto no-scrollbar rounded-lg bg-neutral-950 p-4 border border-neutral-900">
                <pre className="text-[10px] font-mono text-neutral-300 leading-relaxed text-left whitespace-pre-wrap">
                  {VERCEL_SETUP_GUIDE}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en maestros..."
                className="w-full h-10 bg-bg-input border border-border rounded-lg pl-10 pr-4 text-sm text-text-main focus:border-primary/50 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleExcelImport}
              />
              {isEditable && (
                <>
                  {(activeTab === "HACS" || activeTab === "CAUSES") && (
                    <GlassButton
                      variant="secondary"
                      className="h-10 px-4"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp size={16} /> Importar Excel
                    </GlassButton>
                  )}
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setIsFormOpen(true);
                    }}
                    className="h-10 px-4 bg-primary text-white rounded-lg font-semibold text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-sm"
                  >
                    <Plus size={16} /> Nuevo Registro
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-[600px] overflow-auto no-scrollbar">
            {activeTab === "SHIFTS" && (
              <DataTable
                title="Listado de Turnos"
                countLabel="turnos"
                columns={shiftColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "MACHINES" && (
              <DataTable
                title="Listado de Maquinas"
                countLabel="equipos"
                columns={machineColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "BAGGERS" && (
              <DataTable
                title="Listado de Ensacadoras"
                countLabel="ensacadoras"
                columns={baggerColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "HACS" && (
              <DataTable
                title="Listado de Equipos (HAC)"
                countLabel="items"
                columns={hacColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "CAUSES" && (
              <div className="space-y-4">
                {groupedCauses.map((group) => {
                  const isExpanded = !!expandedHacs[group.hac];
                  return (
                    <div
                      key={group.hac}
                      className="border border-border rounded-xl bg-surface/10 overflow-hidden shadow-sm"
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleHac(group.hac)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-surface/80 hover:bg-surface/90 border-b border-border transition-all text-left"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded font-black tracking-wide">
                            {group.hac}
                          </span>
                          {group.hacDetail && (
                            <span className="text-xs font-black text-text-main uppercase tracking-wider">
                              {group.hacDetail}
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted font-bold font-mono uppercase bg-bg px-2 py-0.5 rounded border border-border">
                            {group.causes.length} {group.causes.length === 1 ? 'causa' : 'causas'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            size={16}
                            className={cn(
                              "text-text-muted transition-transform duration-200",
                              isExpanded ? "rotate-180" : ""
                            )}
                          />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-4 bg-bg-input/10 animate-fade-in">
                          <DataTable
                            columns={causeColumns.filter((col) => col.header !== "HAC")}
                            data={group.causes}
                            keyExtractor={(r) => r.id}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedCauses.length === 0 && (
                  <div className="p-12 text-center text-xs font-medium text-text-muted bg-surface rounded-xl border border-border">
                    No se encontraron causas coincidentes.
                  </div>
                )}
              </div>
            )}
            {activeTab === "MATERIALS" && (
              <DataTable
                title="Listado de Materiales"
                countLabel="materiales"
                columns={materialColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "CAPACITIES" && (
              <div className="space-y-6">
                {groupedCapacities.map((group) => (
                  <div
                    key={group.palletizer.id}
                    className="border border-border rounded-xl bg-surface/10 overflow-hidden shadow-sm"
                  >
                    <div className="bg-surface/80 border-b border-border px-5 py-3 flex justify-between items-center bg-gradient-to-r from-bg to-transparent">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-text-main uppercase tracking-wider">
                          Paletizadora: {group.palletizer.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-text-muted font-bold font-mono uppercase bg-bg px-2.5 py-0.5 rounded border border-border">
                        {group.capacities.length} {group.capacities.length === 1 ? 'Combinación' : 'Combinaciones'}
                      </span>
                    </div>
                    <div className="p-4 bg-bg-input/20">
                      <DataTable
                        columns={capacityColumns.filter((col) => col.header !== "Paletizadora")}
                        data={group.capacities}
                        keyExtractor={(r) =>
                          `${r.palletizerId}-${r.baggerId}-${r.materialId}`
                        }
                      />
                    </div>
                  </div>
                ))}
                {groupedCapacities.length === 0 && (
                  <div className="p-8 text-center text-xs text-text-muted bg-surface rounded-xl border border-border">
                    No se encontraron combinaciones de capacidades.
                  </div>
                )}
              </div>
            )}
            {activeTab === "USERS" && (
              <DataTable
                title="Base de Usuarios"
                countLabel="usuarios"
                columns={userColumns}
                data={filteredData}
                keyExtractor={(r) => r.dni}
              />
            )}
            {activeTab === "COMPANIES" && (
              <DataTable
                title="Datos de Empresa"
                countLabel="sedes"
                columns={companyColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {(activeTab === "PUNTOS_CARGA" ||
              activeTab === "LOADING_POINTS") && (
              <DataTable
                title="Puntos de Carga"
                countLabel="puntos"
                columns={loadingPointColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "PROVEEDORES_BOLSA" && (
              <DataTable
                title="Proveedores de Bolsa"
                countLabel="proveedores"
                columns={bagSupplierColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "VEHICULOS" && (
              <DataTable
                title="Vehículos"
                countLabel="vehículos"
                columns={vehicleColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deletingId}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro? Esta acción no se puede deshacer."
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />

      {isFormOpen && (
        <MasterFormModal
          type={activeTab}
          item={editingItem}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
          masters={masters}
        />
      )}
    </motion.div>
  );
}

function MasterFormModal({ type, item, onClose, onSave, masters }: any) {
  const [formData, setFormData] = useState<any>(
    item || {
      permissions: SYSTEM_VIEWS.map((v) => ({
        viewId: v.id,
        label: v.label,
        section: v.section,
        level: "NONE",
      })),
    },
  );

  const [productivityExpanded, setProductivityExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const typeNames: Record<string, { name: string; female?: boolean }> = {
    SHIFTS: { name: "Turno", female: false },
    MACHINES: { name: "Maquina", female: true },
    BAGGERS: { name: "Ensacadora", female: true },
    HACS: { name: "Equipo", female: false },
    CAUSES: { name: "Causa", female: true },
    MATERIALS: { name: "Material", female: false },
    CAPACITIES: { name: "Capacidad", female: true },
    USERS: { name: "Usuario", female: false },
    COMPANIES: { name: "Empresa", female: true },
    PUNTOS_CARGA: { name: "Punto de Carga", female: false },
    LOADING_POINTS: { name: "Punto de Carga", female: false },
    PROVEEDORES_BOLSA: { name: "Proveedor de Bolsa", female: false },
    VEHICULOS: { name: "Vehículo", female: false },
  };

  const config = typeNames[type] || { name: type, female: false };
  const title = item
    ? `Editar ${config.name}`
    : `Nuev${config.female ? "a" : "o"} ${config.name}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalData = { ...formData };

    // Auto-generate ID if missing for all types
    if (!finalData.id && type !== "USERS") {
      const prefix =
        type === "CAPACITIES" ? "CAP" : type.substring(0, 3).toUpperCase();
      finalData.id =
        `${prefix}-` + Math.random().toString(36).substr(2, 4).toUpperCase();
      if (type === "BAGGERS") finalData.type = "ENSACADORA";
    }

    // For users, we use DNI as ID if needed but essentially DNI is the key

    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden z-[201]",
          type === "USERS"
            ? "max-w-4xl max-h-[90vh] overflow-y-auto"
            : "max-w-lg",
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-main transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {type === "SHIFTS" && (
                <>
                  <GlassInput
                    label="Nombre"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Inicio"
                    type="time"
                    value={formData.startTime || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Fin"
                    type="time"
                    value={formData.endTime || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Horas"
                    type="number"
                    value={formData.durationHours || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        durationHours: parseFloat(e.target.value),
                      })
                    }
                  />
                </>
              )}

              {type === "MACHINES" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="HAC ID"
                    value={formData.hacId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hacId: e.target.value })
                    }
                  />
                </>
              )}

              {type === "BAGGERS" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="HAC ID"
                    value={formData.hacId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hacId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Boquillas"
                    type="number"
                    value={formData.nozzles || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        nozzles: parseInt(e.target.value),
                      })
                    }
                  />
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <input
                      type="checkbox"
                      id="isSamplingPoint"
                      checked={formData.isSamplingPoint || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isSamplingPoint: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                    />
                    <label
                      htmlFor="isSamplingPoint"
                      className="text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Es Punto de Muestreo?
                    </label>
                  </div>
                </>
              )}

              {type === "HACS" && (
                <>
                  <GlassInput
                    label="HAC"
                    value={formData.hac || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hac: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Detalle HAC"
                    value={formData.detail || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, detail: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.CÓD. OBJETO (SAP)"
                    value={formData.gpoCodObjeto || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, gpoCodObjeto: e.target.value })
                    }
                  />
                  <GlassInput
                    label="EQUIPO (SAP)"
                    value={formData.equipment || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, equipment: e.target.value })
                    }
                  />
                  <div className="flex gap-6 p-4 bg-primary/5 rounded-xl border border-primary/10 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isDater || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDater: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
                        Control Fechador?
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isScale || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isScale: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
                        Control Balanza?
                      </span>
                    </label>
                  </div>
                </>
              )}

              {type === "CAUSES" && (
                <>
                  <GlassSearchableSelect
                    label="HAC"
                    options={(masters.hacs || []).map((h: any) => ({
                      label: h.hac,
                      value: h.hac,
                      searchTags: [h.hac, h.detail]
                    }))}
                    value={formData.hac || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hac: e.target.value })
                    }
                    placeholder="Buscar y seleccionar HAC..."
                  />
                  <GlassInput
                    label="Texto de Causa"
                    value={formData.text || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Tipo de Paro"
                    options={[
                      { label: "INTERNO", value: "INTERNO" },
                      { label: "EXTERNO", value: "EXTERNO" },
                    ]}
                    value={formData.stopType || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, stopType: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Parte Objeto (SAP)"
                    value={formData.partObject || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, partObject: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.CÓD. SÍNTOMA (SAP)"
                    value={formData.symptomGroup || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, symptomGroup: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CÓD. SÍNTOMA (SAP)"
                    value={formData.symptomCode || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, symptomCode: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CAUSA SAP (SAP)"
                    value={formData.sapCause || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, sapCause: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.COD. CAUSA (SAP)"
                    value={formData.causeGroup || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, causeGroup: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CÓDIGO CAUSA (SAP)"
                    value={formData.causeCode || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, causeCode: e.target.value })
                    }
                  />
                </>
              )}

              {type === "MATERIALS" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Código SAP"
                    value={formData.code || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                  />
                  <GlassInput
                    label="P. Embalaje (kg)"
                    type="number"
                    value={formData.packingWeight || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        packingWeight: parseFloat(e.target.value),
                      })
                    }
                  />
                  <GlassInput
                    label="P. Bolsa (kg)"
                    type="number"
                    value={formData.bagWeight || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        bagWeight: parseFloat(e.target.value),
                      })
                    }
                  />

                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isPallet"
                        checked={formData.isPallet || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isPallet: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isPallet"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Tarima
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isProductive"
                        checked={formData.isProductive || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isProductive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isProductive"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Productivo
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isSupply"
                        checked={formData.isSupply || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isSupply: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isSupply"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Insumo
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isBigBag"
                        checked={formData.isBigBag || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isBigBag: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isBigBag"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es BigBag
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isDispatch"
                        checked={formData.isDispatch || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDispatch: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isDispatch"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Despacho
                      </label>
                    </div>
                  </div>
                </>
              )}

              {type === "CAPACITIES" && (
                <>
                  <GlassSelect
                    label="Paletizadora"
                    options={masters.palletizers.map((p: any) => ({
                      label: p.name,
                      value: p.id,
                    }))}
                    value={formData.palletizerId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, palletizerId: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Ensacadora"
                    options={masters.baggers.map((b: any) => ({
                      label: b.name,
                      value: b.id,
                    }))}
                    value={formData.baggerId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, baggerId: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Material (Productivo)"
                    options={masters.materials
                      .filter((m: any) => m.isProductive)
                      .map((m: any) => ({ label: m.name, value: m.id }))}
                    value={formData.materialId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, materialId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="BDP (TN/H)"
                    type="number"
                    value={formData.bdp || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        bdp: parseFloat(e.target.value),
                      })
                    }
                  />
                </>
              )}

              {type === "USERS" && (
                <>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GlassInput
                      label="DNI / LEGAJO"
                      value={formData.dni || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, dni: e.target.value })
                      }
                    />
                    <GlassInput
                      label="NOMBRE / APELLIDO"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                    <GlassInput
                      label="USUARIO RED / SAP"
                      value={formData.sapUser || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, sapUser: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassInput
                      label="EMAIL"
                      value={formData.email || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                    <GlassInput
                      label="EMAIL 2 (Opcional)"
                      value={formData.email2 || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email2: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassSelect
                      label="PUESTO"
                      options={[
                        {
                          label: "Operario Maquinista",
                          value: "Operario Maquinista",
                        },
                        {
                          label: "Operario Técnico",
                          value: "Operario Técnico",
                        },
                        {
                          label: "Operario Autoelevador",
                          value: "Operario Autoelevador",
                        },
                        { label: "Operario Granel", value: "Operario Granel" },
                        {
                          label: "Operario Supervisor",
                          value: "Operario Supervisor",
                        },
                        { label: "Operario Líbero", value: "Operario Líbero" },
                        { label: "Laboratórista", value: "Laboratórista" },
                      ]}
                      value={formData.position || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                    />
                    <GlassSelect
                      label="PERFIL"
                      options={[
                        { label: "Administrador", value: "Administrador" },
                        { label: "Operario", value: "Operario" },
                        { label: "Técnico", value: "Técnico" },
                        { label: "Administrativo", value: "Administrativo" },
                        { label: "Supervisor", value: "Supervisor" },
                        { label: "Laboratorio", value: "Laboratorio" },
                      ]}
                      value={formData.profile || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, profile: e.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2 mt-4">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">
                      Visualizaciones Habilitadas
                    </h4>
                    <div className="border border-border rounded-xl overflow-hidden bg-bg/30">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-bg/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider">
                              Sección / Vista
                            </th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">
                              Nivel de Acceso
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {/* PRODUCTIVITY SECTION */}
                          <tr 
                            className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors select-none"
                            onClick={() => setProductivityExpanded(!productivityExpanded)}
                          >
                            <td colSpan={2} className="px-4 py-2.5 text-[9px] font-black text-primary tracking-widest uppercase bg-bg/20">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  ⚡ Funcionalidades de Productividad
                                </span>
                                {productivityExpanded ? <ChevronDown size={14} className="text-primary/70" /> : <ChevronRight size={14} className="text-primary/70" />}
                              </div>
                            </td>
                          </tr>
                          {productivityExpanded && SYSTEM_VIEWS.filter((v) => v.section === "PRODUCTIVITY").map((view) => {
                            const p = formData.permissions.find(
                              (perm: any) => perm.viewId === view.id,
                            ) || { level: "NONE" };
                            return (
                              <tr
                                key={view.id}
                                className="hover:bg-white/5 transition-colors"
                              >
                                <td className="px-4 py-3 pl-6">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-main">
                                      {view.label}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {["NONE", "VIEW", "EDIT"].map((lvl) => (
                                      <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => {
                                          const newPerms = [
                                            ...formData.permissions,
                                          ];
                                          const idx = newPerms.findIndex(
                                            (perm: any) =>
                                              perm.viewId === view.id,
                                          );
                                          if (idx >= 0) {
                                            newPerms[idx] = {
                                              ...newPerms[idx],
                                              level: lvl,
                                            };
                                          } else {
                                            newPerms.push({
                                              viewId: view.id,
                                              label: view.label,
                                              section: view.section,
                                              level: lvl,
                                            });
                                          }
                                          setFormData({
                                            ...formData,
                                            permissions: newPerms,
                                          });
                                        }}
                                        className={cn(
                                          "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                          p.level === lvl
                                            ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                            : "bg-surface text-text-muted border-border hover:border-text-muted",
                                        )}
                                      >
                                        {lvl === "NONE"
                                          ? "BLOQUEADO"
                                          : lvl === "VIEW"
                                            ? "SOLO VER"
                                            : "EDITAR"}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* ADMIN SECTION */}
                          <tr 
                            className="bg-[#005596]/5 dark:bg-primary/5 cursor-pointer hover:bg-[#005596]/10 dark:hover:bg-primary/10 transition-colors select-none"
                            onClick={() => setAdminExpanded(!adminExpanded)}
                          >
                            <td colSpan={2} className="px-4 py-2.5 text-[9px] font-black text-[#005596] dark:text-primary tracking-widest uppercase bg-bg/20 border-t border-border">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  ⚙️ Catálogos y Maestros del Sistema (Admin)
                                </span>
                                {adminExpanded ? <ChevronDown size={14} className="text-[#005596]/70 dark:text-primary/70" /> : <ChevronRight size={14} className="text-[#005596]/70 dark:text-primary/70" />}
                              </div>
                            </td>
                          </tr>
                          {adminExpanded && SYSTEM_VIEWS.filter((v) => v.section === "ADMIN").map((view) => {
                            const p = formData.permissions.find(
                              (perm: any) => perm.viewId === view.id,
                            ) || { level: "NONE" };
                            return (
                              <tr
                                key={view.id}
                                className="hover:bg-white/5 transition-colors"
                              >
                                <td className="px-4 py-3 pl-6">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-main">
                                      {view.label}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {["NONE", "VIEW", "EDIT"].map((lvl) => (
                                      <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => {
                                          const newPerms = [
                                            ...formData.permissions,
                                          ];
                                          const idx = newPerms.findIndex(
                                            (perm: any) =>
                                              perm.viewId === view.id,
                                          );
                                          if (idx >= 0) {
                                            newPerms[idx] = {
                                              ...newPerms[idx],
                                              level: lvl,
                                            };
                                          } else {
                                            newPerms.push({
                                              viewId: view.id,
                                              label: view.label,
                                              section: view.section,
                                              level: lvl,
                                            });
                                          }
                                          setFormData({
                                            ...formData,
                                            permissions: newPerms,
                                          });
                                        }}
                                        className={cn(
                                          "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                          p.level === lvl
                                            ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                            : "bg-surface text-text-muted border-border hover:border-text-muted",
                                        )}
                                      >
                                        {lvl === "NONE"
                                          ? "BLOQUEADO"
                                          : lvl === "VIEW"
                                            ? "SOLO VER"
                                            : "EDITAR"}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {type === "COMPANIES" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre / Razón Social"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <GlassInput
                    label="CUIT"
                    value={formData.taxId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, taxId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Teléfono"
                    value={formData.phone || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                  <div className="md:col-span-2">
                    <GlassInput
                      label="URL de Logo (PNG/JPG)"
                      value={formData.logo || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, logo: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Dirección"
                      value={formData.address || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Email Institucional"
                      value={formData.email || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {(type === "PUNTOS_CARGA" || type === "LOADING_POINTS") && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre de Calle / Punto"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassSelect
                      label="Tipo de Carga"
                      options={[
                        { label: "BOLSA", value: "BOLSA" },
                        { label: "GRANEL", value: "GRANEL" },
                      ]}
                      value={formData.type || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {type === "PROVEEDORES_BOLSA" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre"
                      value={formData.nombre || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Dirección"
                      value={formData.direccion || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, direccion: e.target.value })
                      }
                    />
                  </div>
                  <GlassInput
                    label="Teléfono"
                    value={formData.telefono || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </>
              )}

              {type === "VEHICULOS" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Identificación"
                      value={formData.identificación || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, identificación: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Marca"
                      value={formData.marca || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, marca: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassSelect
                      label="Tipo"
                      options={[
                        { label: "Autoelevador", value: "Autoelevador" },
                        { label: "Camión", value: "Camión" },
                        { label: "Camioneta", value: "Camioneta" },
                        { label: "Vehículo utilitario", value: "Vehículo utilitario" }
                      ]}
                      value={formData.tipo || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, tipo: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassInput
                      label="Carga Máxima"
                      value={formData.carga_maxima || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, carga_maxima: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <GlassButton
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                type="button"
              >
                Cancelar
              </GlassButton>
              <GlassButton className="flex-1" type="submit">
                <Save size={18} /> Guardar
              </GlassButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function AdminSubTab({ active, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className={cn(
        "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shrink-0",
        active
          ? "btn-active-highlight"
          : "text-text-muted hover:text-text-main hover:bg-bg",
      )}
    >
      {label}
    </button>
  );
}
