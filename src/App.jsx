import { useEffect, useMemo, useState } from "react";
import API from "./api";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Database,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Workflow,
  X,
} from "lucide-react";

import ProcessesView from "./modules/processes/ProcessesView";
import IndicatorsView from "./modules/indicators/IndicatorsView";
import DailyView from "./modules/daily/DailyView";
import HistoryView from "./modules/history/HistoryView";
import DashboardView from "./modules/dashboard/DashboardView";

const TABS = [
  { key: "portal", label: "Portal" },
  { key: "processes", label: "Procesos" },
  { key: "indicators", label: "Indicadores" },
  { key: "daily", label: "Captura diaria" },
  { key: "history", label: "Histórico" },
  { key: "dashboard", label: "Dashboard" },
];

const ACCESS_CODES = {
  1: "N1-ETO",
  2: "N2-ETO",
};

const COLORS = {
  navy: "#070b1a",
  navy2: "#08142b",
  green: "#16a34a",
  green2: "#22c55e",
  emerald: "#10b981",
  cyan: "#38bdf8",
  text: "#10162f",
  muted: "#667085",
  line: "#e7ecf4",
  soft: "#f7f9fd",
};

function useViewport() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

function getConfig(width) {
  const isMobile = width <= 760;
  const isTablet = width > 760 && width <= 1180;

  return {
    isMobile,
    isTablet,
    scale: isMobile ? 1 : isTablet ? 0.82 : 0.65,
    headerHeight: isMobile ? 68 : isTablet ? 78 : 78,
    sidebarCollapsed: isMobile ? 0 : isTablet ? 76 : 86,
    sidebarExpanded: isMobile ? Math.min(width * 0.86, 330) : isTablet ? 282 : 300,
    gap: isMobile ? 10 : isTablet ? 14 : 18,
  };
}

const TAB_ICONS = {
  portal: Home,
  processes: Workflow,
  indicators: Target,
  daily: ClipboardCheck,
  history: FileText,
  dashboard: BarChart3,
};

const EMPTY_PROCESS_FORM = {
  name: "",
  level: 1,
};

const EMPTY_INDICATOR_FORM = {
  name: "",
  process_id: "",
  meeting_level: 1,
  unit: "%",
  target_operator: ">=",
  target_value: "",
  use_warning: false,
  warning_operator: null,
  warning_value: "",
  use_critical: false,
  critical_operator: null,
  critical_value: "",
  frequency: "day",
  capture_mode: "shifts",
  shifts: ["A", "B", "C"],
  scope_type: "standard",
};

const EMPTY_ENTITY_FORM = {
  code: "",
  name: "",
  entity_type: "",
  is_active: true,
};

function LogoImage({ className = "" }) {
  return (
    <img
      src="/INOVA.png"
      alt="ETO DIGITAL"
      className={className}
      onError={(e) => {
        e.currentTarget.src = "/INOVA.jpeg";
      }}
    />
  );
}

function AccessHeroLogo() {
  return (
    <div className="access-hero-logo" aria-hidden="true">
      <div className="access-hero-logo-inner">
        <LogoImage className="eto-logo-image hero-logo-image" />
      </div>
    </div>
  );
}

function normalizeShifts(shifts) {
  if (Array.isArray(shifts)) {
    return shifts.map((x) => String(x).trim()).filter(Boolean);
  }

  if (typeof shifts === "string") {
    return shifts
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function hasOptionalValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasCompleteOptionalRule(form, prefix) {
  return (
    form?.[`use_${prefix}`] === true &&
    !!form?.[`${prefix}_operator`] &&
    hasOptionalValue(form?.[`${prefix}_value`])
  );
}

function optionalRulePayload(source, prefix) {
  const enabled = hasCompleteOptionalRule(source, prefix);

  return {
    [`use_${prefix}`]: enabled,
    [`${prefix}_operator`]: enabled ? source?.[`${prefix}_operator`] : null,
    [`${prefix}_value`]: enabled ? Number(source?.[`${prefix}_value`]) : null,
  };
}

function readEtoAccessFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const etoAuthorized = params.get("etoAuthorized");
  const etoAccessLevel = params.get("etoAccessLevel");
  const etoAccessCode = params.get("etoAccessCode");
  const etoUser = params.get("etoUser");
  const etoRole = params.get("etoRole");

  if (etoAuthorized === "true" && etoAccessLevel && etoAccessCode) {
    sessionStorage.setItem("etoAuthorized", "true");
    sessionStorage.setItem("etoAccessLevel", etoAccessLevel);
    sessionStorage.setItem("etoAccessCode", etoAccessCode);
    sessionStorage.setItem("etoUser", etoUser || "");
    sessionStorage.setItem("etoRole", etoRole || "");

    window.history.replaceState({}, document.title, window.location.pathname);

    return {
      authorized: true,
      level: etoAccessLevel,
      code: etoAccessCode,
    };
  }

  return {
    authorized: sessionStorage.getItem("etoAuthorized") === "true",
    level: sessionStorage.getItem("etoAccessLevel") || "",
    code: sessionStorage.getItem("etoAccessCode") || "",
  };
}


function PortalView({
  processes,
  indicators,
  accessLevel,
  setTab,
}) {
  const shortcuts = [
    {
      key: "processes",
      title: "Procesos",
      subtitle: "Crea, edita y administra la estructura operativa.",
      icon: Workflow,
      meta: `${processes.length} activos`,
      tone: "green",
    },
    {
      key: "indicators",
      title: "Indicadores",
      subtitle: "Define metas, reglas y seguimiento de desempeño.",
      icon: Target,
      meta: `${indicators.length} configurados`,
      tone: "emerald",
    },
    {
      key: "daily",
      title: "Captura diaria",
      subtitle: "Registra resultados por fecha, turno y proceso.",
      icon: ClipboardCheck,
      meta: "Operación diaria",
      tone: "teal",
    },
    {
      key: "history",
      title: "Histórico",
      subtitle: "Consulta trazabilidad, análisis y consolidado mensual.",
      icon: FileText,
      meta: "Consulta avanzada",
      tone: "slate",
    },
    {
      key: "dashboard",
      title: "Dashboard",
      subtitle: "Visualiza KPIs ejecutivos y comportamiento del proceso.",
      icon: LayoutDashboard,
      meta: "Vista ejecutiva",
      tone: "dark",
    },
  ];

  const quickMetrics = [
    {
      label: "Procesos activos",
      value: processes.length,
      icon: FolderKanban,
    },
    {
      label: "Indicadores configurados",
      value: indicators.length,
      icon: BarChart3,
    },
    {
      label: "Nivel activo",
      value: accessLevel,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="portal-shell">
      <section className="portal-hero">
        <div className="portal-hero-copy">
          <span className="section-kicker">VISIÓN GENERAL</span>
          <h2>Centro de control</h2>
          <p>
            Plataforma corporativa para parametrizar indicadores, capturar
            resultados y analizar desempeño operativo por proceso.
          </p>

          <div className="portal-hero-actions">
            <button
              type="button"
              className="portal-primary-btn"
              onClick={() => setTab("dashboard")}
            >
              <LayoutDashboard size={18} />
              Ir al dashboard
            </button>

            <button
              type="button"
              className="portal-secondary-btn"
              onClick={() => setTab("daily")}
            >
              <ClipboardCheck size={18} />
              Captura diaria
            </button>
          </div>
        </div>

        <div className="portal-hero-side">
          <div className="portal-status-card">
            <div className="portal-status-top">
              <div className="portal-status-icon">
                <Database size={18} />
              </div>
              <span className="portal-status-pill">Nivel {accessLevel}</span>
            </div>

            <div className="portal-status-body">
              <strong>Operación lista</strong>
              <p>
                El módulo está preparado para administrar procesos, indicadores
                y seguimiento operativo.
              </p>
            </div>

            <div className="portal-status-grid">
              <div>
                <small>Estado</small>
                <b>Activo</b>
              </div>
              <div>
                <small>Sesión</small>
                <b>ETO DIGITAL</b>
              </div>
              <div>
                <small>Monitoreo</small>
                <b>En línea</b>
              </div>
              <div>
                <small>Actualización</small>
                <b>Tiempo real</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-kpi-grid">
        {quickMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="portal-kpi-card">
              <div className="portal-kpi-icon">
                <Icon size={20} />
              </div>
              <div className="portal-kpi-text">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="portal-content-grid">
        <article className="portal-panel portal-panel-large">
          <div className="portal-panel-head">
            <div>
              <span className="portal-panel-kicker">ACCESO RÁPIDO</span>
              <h3>Módulos disponibles</h3>
              <p>
                Ingresa directamente al flujo de trabajo que necesitas gestionar.
              </p>
            </div>
          </div>

          <div className="portal-shortcuts-grid">
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`portal-shortcut-card tone-${item.tone}`}
                  onClick={() => setTab(item.key)}
                >
                  <div className="portal-shortcut-top">
                    <div className="portal-shortcut-icon">
                      <Icon size={19} />
                    </div>
                    <span>{item.meta}</span>
                  </div>

                  <div className="portal-shortcut-body">
                    <strong>{item.title}</strong>
                    <p>{item.subtitle}</p>
                  </div>

                  <div className="portal-shortcut-link">
                    <span>Abrir módulo</span>
                    <ArrowRight size={16} />
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="portal-side-stack">
          <article className="portal-panel portal-info-card">
            <div className="portal-panel-kicker">RESUMEN OPERATIVO</div>
            <h3>Control centralizado</h3>
            <ul className="portal-bullet-list">
              <li>
                <span><Clock3 size={15} /></span>
                Gestión rápida de procesos e indicadores.
              </li>
              <li>
                <span><ClipboardCheck size={15} /></span>
                Captura diaria y consulta histórica en un solo lugar.
              </li>
              <li>
                <span><BarChart3 size={15} /></span>
                Visión ejecutiva con KPIs y analítica por proceso.
              </li>
            </ul>
          </article>

          <article className="portal-panel portal-highlight-card">
            <div className="portal-highlight-icon">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <div className="portal-panel-kicker">RECOMENDADO</div>
              <h3>Explora el dashboard</h3>
              <p>
                Visualiza tendencias, resultados y desempeño consolidado de tus
                indicadores.
              </p>
            </div>
            <button
              type="button"
              className="portal-cta-link"
              onClick={() => setTab("dashboard")}
            >
              Ver dashboard
              <ArrowRight size={16} />
            </button>
          </article>
        </aside>
      </section>
    </div>
  );
}

export default function App() {
  const viewportWidth = useViewport();
  const config = useMemo(() => getConfig(viewportWidth), [viewportWidth]);

  const [tab, setTab] = useState("portal");
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const initialEtoAccess = readEtoAccessFromUrl();

  const [accessLevel, setAccessLevel] = useState(initialEtoAccess.level);
  const [accessCode, setAccessCode] = useState(initialEtoAccess.code);
  const [accessError, setAccessError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(initialEtoAccess.authorized);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [processes, setProcesses] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [entities, setEntities] = useState([]);

  const [editingProcessId, setEditingProcessId] = useState(null);
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);
  const [editingEntityId, setEditingEntityId] = useState(null);

  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM);
  const [indicatorForm, setIndicatorForm] = useState(EMPTY_INDICATOR_FORM);
  const [entityForm, setEntityForm] = useState(EMPTY_ENTITY_FORM);

  const [selectedIndicatorForEntities, setSelectedIndicatorForEntities] =
    useState(null);
  const [selectedIndicatorEntityTargets, setSelectedIndicatorEntityTargets] =
    useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedEntityTargetValue, setSelectedEntityTargetValue] =
    useState("");

  useEffect(() => {
    const currentAccess = readEtoAccessFromUrl();

    if (!currentAccess.authorized || !currentAccess.level || !currentAccess.code) {
      window.location.replace("http://localhost:5173");
      return;
    }

    setAccessLevel(currentAccess.level);
    setAccessCode(currentAccess.code);
    setIsAuthorized(true);
  }, []);

  useEffect(() => {
    if (isAuthorized && accessLevel) {
      loadBaseData();
      setProcessForm((prev) => ({
        ...prev,
        level: Number(accessLevel),
      }));
      setIndicatorForm((prev) => ({
        ...prev,
        meeting_level: Number(accessLevel),
      }));
    }
  }, [isAuthorized, accessLevel]);

  useEffect(() => {
    if (config.isMobile) {
      setSidebarPinned(false);
      setSidebarHover(false);
    } else {
      setMobileSidebarOpen(false);
    }
  }, [config.isMobile, tab]);

  async function loadBaseData() {
    try {
      setLoading(true);

      const [processList, indicatorList, entityList] = await Promise.all([
        API.getProcesses(Number(accessLevel)),
        API.getIndicators({ level: Number(accessLevel) }),
        API.getEntities(),
      ]);

      setProcesses(processList);
      setIndicators(indicatorList);
      setEntities(entityList);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEntities() {
    const entityList = await API.getEntities();
    setEntities(entityList);
    return entityList;
  }

  function clearMessageSoon(text) {
    setMessage(text);
    window.clearTimeout(window.__etoMsgTimeout);
    window.__etoMsgTimeout = window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  function handleAccessSubmit(e) {
    e.preventDefault();

    if (!accessLevel) {
      setAccessError("Debes seleccionar el nivel de ingreso.");
      return;
    }

    const expectedCode = ACCESS_CODES[Number(accessLevel)];
    if (accessCode.trim().toUpperCase() !== expectedCode) {
      setAccessError("Código incorrecto para el nivel seleccionado.");
      return;
    }

    setAccessError("");
    setIsAuthorized(true);
  }

  function handleLogout() {
    sessionStorage.removeItem("etoAuthorized");
    sessionStorage.removeItem("etoAccessLevel");
    sessionStorage.removeItem("etoAccessCode");
    sessionStorage.removeItem("etoUser");
    sessionStorage.removeItem("etoRole");

    sessionStorage.removeItem("auth");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("nombre");
    sessionStorage.removeItem("usuario");
    sessionStorage.removeItem("rol");
    sessionStorage.removeItem("estado");
    sessionStorage.removeItem("permisos");
    sessionStorage.removeItem("pilarSeleccionado");
    sessionStorage.removeItem("pilarNombre");
    sessionStorage.removeItem("pilarRuta");

    setIsAuthorized(false);
    setAccessLevel("");
    setAccessCode("");
    setAccessError("");
    setTab("portal");
    setProcesses([]);
    setIndicators([]);
    setEntities([]);
    setEditingProcessId(null);
    setEditingIndicatorId(null);
    setEditingEntityId(null);
    setProcessForm(EMPTY_PROCESS_FORM);
    setIndicatorForm(EMPTY_INDICATOR_FORM);
    setEntityForm(EMPTY_ENTITY_FORM);
    setSelectedIndicatorForEntities(null);
    setSelectedIndicatorEntityTargets([]);
    setSelectedEntityId("");
    setSelectedEntityTargetValue("");
    setMessage("");

    window.location.href = "http://localhost:5173/login?resetLogin=true";
  }

  function resetProcessForm() {
    setProcessForm({
      ...EMPTY_PROCESS_FORM,
      level: Number(accessLevel) || 1,
    });
    setEditingProcessId(null);
  }

  function resetIndicatorForm() {
    setIndicatorForm({
      ...EMPTY_INDICATOR_FORM,
      meeting_level: Number(accessLevel) || 1,
    });
    setEditingIndicatorId(null);
  }

  function resetEntityForm() {
    setEntityForm(EMPTY_ENTITY_FORM);
    setEditingEntityId(null);
  }

  async function handleCreateProcess(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const payload = {
        name: processForm.name.trim(),
        level: Number(accessLevel),
      };

      if (editingProcessId) {
        await API.updateProcess(editingProcessId, payload);
        clearMessageSoon("Proceso actualizado correctamente");
      } else {
        await API.createProcess(payload);
        clearMessageSoon("Proceso creado correctamente");
      }

      resetProcessForm();
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditProcess(item) {
    setTab("processes");
    setEditingProcessId(item.id);
    setProcessForm({
      name: item.name,
      level: item.level,
    });
  }

  async function handleDeleteProcess(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el proceso "${item.name}"?\n\nEsto también eliminará sus indicadores y registros asociados si existen.`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteProcess(item.id);

      if (editingProcessId === item.id) {
        resetProcessForm();
      }

      clearMessageSoon("Proceso eliminado correctamente");
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIndicator(e, formOverride = null) {
    if (e?.preventDefault) e.preventDefault();

    try {
      setLoading(true);

      const source = formOverride || indicatorForm;
      const warningRule = optionalRulePayload(source, "warning");
      const criticalRule = optionalRulePayload(source, "critical");
      const scopeType = source.scope_type || "standard";
      const captureMode = scopeType === "entity" ? "single" : source.capture_mode;

      const payload = {
        name: String(source.name || "").trim(),
        process_id: Number(source.process_id),
        meeting_level: Number(accessLevel),
        unit: source.unit,
        target_operator: source.target_operator,
        target_value: Number(source.target_value),

        // Estos flags son IMPORTANTES porque api.js tambien los usa
        // para no borrar Warning/Critical al construir el payload final.
        use_warning: warningRule.use_warning,
        warning_operator: warningRule.warning_operator,
        warning_value: warningRule.warning_value,

        use_critical: criticalRule.use_critical,
        critical_operator: criticalRule.critical_operator,
        critical_value: criticalRule.critical_value,

        frequency: source.frequency,
        capture_mode: captureMode,
        shifts:
          scopeType === "entity" || captureMode === "single"
            ? []
            : normalizeShifts(source.shifts),
        scope_type: scopeType,
      };

      if (editingIndicatorId) {
        await API.updateIndicator(editingIndicatorId, payload);
        clearMessageSoon("Indicador actualizado correctamente");
      } else {
        await API.createIndicator(payload);
        clearMessageSoon("Indicador creado correctamente");
      }

      resetIndicatorForm();
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditIndicator(item) {
    setTab("indicators");
    setEditingIndicatorId(item.id);

    const hasWarning =
      !!item.warning_operator && hasOptionalValue(item.warning_value);
    const hasCritical =
      !!item.critical_operator && hasOptionalValue(item.critical_value);

    setIndicatorForm({
      name: item.name,
      process_id: String(item.process_id),
      meeting_level: item.meeting_level,
      unit: item.unit,
      target_operator: item.target_operator,
      target_value: item.target_value,
      use_warning: hasWarning,
      warning_operator: hasWarning ? item.warning_operator : null,
      warning_value: hasWarning ? item.warning_value : "",
      use_critical: hasCritical,
      critical_operator: hasCritical ? item.critical_operator : null,
      critical_value: hasCritical ? item.critical_value : "",
      frequency: item.frequency || "day",
      capture_mode: item.capture_mode || "shifts",
      shifts: normalizeShifts(item.shifts),
      scope_type: item.scope_type || "standard",
    });
  }

  async function handleDeleteIndicator(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el indicador "${item.code} - ${item.name}"?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteIndicator(item.id);

      if (editingIndicatorId === item.id) {
        resetIndicatorForm();
      }

      if (selectedIndicatorForEntities?.id === item.id) {
        setSelectedIndicatorForEntities(null);
        setSelectedIndicatorEntityTargets([]);
        setSelectedEntityId("");
        setSelectedEntityTargetValue("");
        resetEntityForm();
      }

      clearMessageSoon("Indicador eliminado correctamente");
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleShift(shift) {
    setIndicatorForm((prev) => {
      const normalized = normalizeShifts(prev.shifts);
      const exists = normalized.includes(shift);

      return {
        ...prev,
        shifts: exists
          ? normalized.filter((s) => s !== shift)
          : [...normalized, shift],
      };
    });
  }

  async function handleLoadIndicatorEntityTargets(indicator) {
    try {
      setLoading(true);
      setTab("indicators");
      setSelectedIndicatorForEntities(indicator);

      const targets = await API.getEntityTargets({
        indicator_id: indicator.id,
        active_only: true,
      });

      setSelectedIndicatorEntityTargets(targets || []);
      setSelectedEntityId("");
      setSelectedEntityTargetValue("");
      resetEntityForm();
      clearMessageSoon("Entidades del indicador cargadas correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEntity() {
    try {
      setLoading(true);

      const payload = {
        code: String(entityForm.code || "").trim(),
        name: String(entityForm.name || "").trim(),
        entity_type: String(entityForm.entity_type || "").trim(),
        is_active: Boolean(entityForm.is_active),
      };

      if (!payload.name) {
        throw new Error("Debes ingresar el nombre de la entidad");
      }

      if (!payload.entity_type) {
        throw new Error("Debes ingresar el tipo de entidad");
      }

      let savedEntity = null;

      if (editingEntityId) {
        savedEntity = await API.updateEntity(editingEntityId, payload);
        clearMessageSoon("Entidad actualizada correctamente");
      } else {
        savedEntity = await API.createEntity(payload);
        clearMessageSoon("Entidad creada correctamente");
      }

      const entityList = await loadEntities();

      if (savedEntity?.id) {
        setSelectedEntityId(String(savedEntity.id));
      } else {
        const matchedEntity = entityList.find((item) => {
          const sameCode =
            payload.code &&
            String(item.code || "").trim().toLowerCase() ===
              payload.code.toLowerCase();

          const sameName =
            String(item.name || "")
              .trim()
              .toLowerCase() === payload.name.toLowerCase();

          const sameType =
            String(item.entity_type || "")
              .trim()
              .toLowerCase() === payload.entity_type.toLowerCase();

          return (sameCode || sameName) && sameType;
        });

        if (matchedEntity?.id) {
          setSelectedEntityId(String(matchedEntity.id));
        }
      }

      resetEntityForm();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditEntity(item) {
    setEditingEntityId(item.id);
    setEntityForm({
      code: item.entity_code || item.code || "",
      name: item.entity_name || item.name || "",
      entity_type: item.entity_type || "",
      is_active: item.is_active ?? true,
    });
  }

  async function handleDeleteEntity(item) {
    const entityId = item.entity_id || item.id;
    const entityName = item.entity_name || item.name || "-";

    const ok = window.confirm(
      `¿Deseas eliminar la entidad "${entityName}"?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteEntity(entityId);

      if (editingEntityId === entityId) {
        resetEntityForm();
      }

      if (selectedEntityId && Number(selectedEntityId) === Number(entityId)) {
        setSelectedEntityId("");
      }

      await loadEntities();

      if (selectedIndicatorForEntities?.id) {
        const targets = await API.getEntityTargets({
          indicator_id: selectedIndicatorForEntities.id,
          active_only: true,
        });
        setSelectedIndicatorEntityTargets(targets || []);
      }

      clearMessageSoon("Entidad eliminada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrUpdateEntityTarget() {
    try {
      if (!selectedIndicatorForEntities?.id) {
        throw new Error("Primero debes seleccionar un indicador");
      }

      if (!selectedEntityId) {
        throw new Error("Debes seleccionar una entidad");
      }

      setLoading(true);

      await API.createOrUpdateEntityTarget({
        indicator_id: Number(selectedIndicatorForEntities.id),
        entity_id: Number(selectedEntityId),
        target_value:
          selectedEntityTargetValue === "" ||
          selectedEntityTargetValue === null
            ? Number(selectedIndicatorForEntities.target_value || 0)
            : Number(selectedEntityTargetValue),
        is_active: true,
      });

      const targets = await API.getEntityTargets({
        indicator_id: selectedIndicatorForEntities.id,
        active_only: true,
      });

      setSelectedIndicatorEntityTargets(targets || []);
      setSelectedEntityId("");
      setSelectedEntityTargetValue("");
      clearMessageSoon("Entidad asociada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEntityTarget(item) {
    const ok = window.confirm(
      `¿Deseas quitar a "${item.entity_name}" del indicador "${
        selectedIndicatorForEntities?.name || ""
      }"?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteEntityTarget(item.id);

      if (selectedIndicatorForEntities?.id) {
        const targets = await API.getEntityTargets({
          indicator_id: selectedIndicatorForEntities.id,
          active_only: true,
        });
        setSelectedIndicatorEntityTargets(targets || []);
      }

      clearMessageSoon("Entidad quitada del indicador");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const activeTabLabel = TABS.find((x) => x.key === tab)?.label || "Portal";
  const sidebarExpanded = config.isMobile
    ? sidebarPinned || mobileSidebarOpen
    : sidebarPinned || sidebarHover;

  const usuario =
    sessionStorage.getItem("etoUser") ||
    sessionStorage.getItem("usuario") ||
    "N1-ETO";

  const rol =
    sessionStorage.getItem("etoRole") ||
    sessionStorage.getItem("rol") ||
    `NIVEL_${accessLevel}_ETO`;

  const contentPaddingLeft = config.isMobile
    ? config.gap
    : (sidebarExpanded ? config.sidebarExpanded : config.sidebarCollapsed) + config.gap * 2;

  const closeMobileMenu = () => {
    if (config.isMobile) {
      setMobileSidebarOpen(false);
      setSidebarPinned(false);
    }
  };

  function renderContent() {
    if (message) {
      return <div className="alert">{message}</div>;
    }

    if (tab === "portal") {
      return (
        <PortalView
          processes={processes}
          indicators={indicators}
          accessLevel={accessLevel}
          setTab={setTab}
        />
      );
    }

    if (tab === "processes") {
      return (
        <ProcessesView
          accessLevel={accessLevel}
          processes={processes}
          processForm={processForm}
          setProcessForm={setProcessForm}
          editingProcessId={editingProcessId}
          handleCreateProcess={handleCreateProcess}
          handleEditProcess={handleEditProcess}
          handleDeleteProcess={handleDeleteProcess}
          resetProcessForm={resetProcessForm}
          loading={loading}
        />
      );
    }

    if (tab === "indicators") {
      return (
        <IndicatorsView
          accessLevel={accessLevel}
          processes={processes}
          indicators={indicators}
          indicatorForm={indicatorForm}
          setIndicatorForm={setIndicatorForm}
          editingIndicatorId={editingIndicatorId}
          handleCreateIndicator={handleCreateIndicator}
          handleEditIndicator={handleEditIndicator}
          handleDeleteIndicator={handleDeleteIndicator}
          resetIndicatorForm={resetIndicatorForm}
          toggleShift={toggleShift}
          entities={entities}
          selectedIndicatorForEntities={selectedIndicatorForEntities}
          selectedIndicatorEntityTargets={selectedIndicatorEntityTargets}
          selectedEntityId={selectedEntityId}
          selectedEntityTargetValue={selectedEntityTargetValue}
          setSelectedEntityId={setSelectedEntityId}
          setSelectedEntityTargetValue={setSelectedEntityTargetValue}
          handleLoadIndicatorEntityTargets={handleLoadIndicatorEntityTargets}
          handleCreateOrUpdateEntityTarget={handleCreateOrUpdateEntityTarget}
          handleDeleteEntityTarget={handleDeleteEntityTarget}
          entityForm={entityForm}
          setEntityForm={setEntityForm}
          handleCreateEntity={handleCreateEntity}
          handleEditEntity={handleEditEntity}
          handleDeleteEntity={handleDeleteEntity}
          editingEntityId={editingEntityId}
          resetEntityForm={resetEntityForm}
          loading={loading}
        />
      );
    }

    if (tab === "daily") {
      return (
        <DailyView
          accessLevel={accessLevel}
          processes={processes}
          indicators={indicators}
        />
      );
    }

    if (tab === "history") {
      return (
        <HistoryView
          accessLevel={accessLevel}
          processes={processes}
          indicators={indicators}
        />
      );
    }

    return (
      <DashboardView
        accessLevel={accessLevel}
        processes={processes}
        indicators={indicators}
      />
    );
  }

  if (!isAuthorized || !accessLevel) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(135deg, #020617 0%, #07162e 50%, #081b33 100%)",
          color: "#ffffff",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 22, marginBottom: 8 }}>
            Validando acceso ETO...
          </strong>
          <span style={{ color: "rgba(255,255,255,.68)", fontSize: 14 }}>
            Redirigiendo al login principal de INOVA.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="layout-root eto-layout"
      style={{
        "--ui-scale": config.scale,
        "--header-height": `${config.headerHeight}px`,
      }}
    >
      <style>{css}</style>

      <header className="topbar" style={{ height: config.headerHeight }}>
        <div className="topbar-left">
          <button
            type="button"
            className="top-icon-btn"
            onClick={() => {
              if (config.isMobile) {
                setMobileSidebarOpen((value) => !value);
                setSidebarPinned((value) => !value);
              } else {
                setSidebarPinned((value) => !value);
              }
            }}
            aria-label={sidebarExpanded ? "Cerrar menú" : "Abrir menú"}
          >
            {config.isMobile ? (
              sidebarExpanded ? <X size={20} /> : <Menu size={21} />
            ) : sidebarPinned ? (
              <PanelLeftClose size={19} />
            ) : (
              <PanelLeftOpen size={19} />
            )}
          </button>

          <BrandHeader />
        </div>

        <div className="topbar-right">
          <button type="button" className="top-icon-btn notification-btn" aria-label="Notificaciones">
            <Bell size={18} />
            <i />
          </button>

          <div className="user-chip">
            <div className="user-avatar">
              <UserRound size={17} />
            </div>
            <div className="user-info">
              <strong>{usuario}</strong>
              <small>{rol}</small>
            </div>
            <ChevronDown className="user-chevron" size={16} />
          </div>
        </div>
      </header>

      {!config.isMobile && !sidebarPinned && (
        <div
          className="sidebar-hotzone-global"
          onMouseEnter={() => setSidebarHover(true)}
        />
      )}

      <section className="workspace" style={{ height: `calc(100dvh - ${config.headerHeight}px)` }}>
        <main className="content-area">
          <div
            className="content-wrap"
            style={{
              paddingLeft: contentPaddingLeft,
              paddingRight: config.gap,
              paddingTop: config.gap,
              paddingBottom: config.gap,
            }}
          >
            <div className="content-card">
              {renderContent()}
            </div>
          </div>
        </main>

        {config.isMobile && sidebarExpanded && (
          <button
            type="button"
            className="mobile-backdrop"
            aria-label="Cerrar menú"
            onClick={() => {
              setMobileSidebarOpen(false);
              setSidebarPinned(false);
            }}
          />
        )}

        <aside
          className={sidebarExpanded ? "sidebar expanded" : "sidebar collapsed"}
          style={{
            width: sidebarExpanded ? config.sidebarExpanded : config.sidebarCollapsed,
            left: config.gap,
            top: config.gap,
            bottom: config.gap,
            transform:
              config.isMobile && !sidebarExpanded
                ? `translateX(-${config.sidebarExpanded + config.gap}px)`
                : "translateX(0)",
          }}
          onMouseEnter={() => {
            if (!config.isMobile) {
              setSidebarHover(true);
            }
          }}
          onMouseLeave={() => {
            if (!config.isMobile && !sidebarPinned) {
              setSidebarHover(false);
            }
          }}
        >
          <div className="sidebar-inner">
            <div className="sidebar-top">
              {sidebarExpanded ? (
                <BrandSidebar />
              ) : (
                <img className="sidebar-logo-mini" src="/favicon1.ico" alt="INOVA" />
              )}
            </div>

            <div className="sidebar-nav">
              {sidebarExpanded && <SectionTitle>Gestión ETO</SectionTitle>}

              {TABS.map((item) => {
                const Icon = TAB_ICONS[item.key] || Activity;
                const active = tab === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    style={tabButtonStyle(active, sidebarExpanded)}
                    title={item.label}
                    onClick={() => {
                      setTab(item.key);
                      closeMobileMenu();
                    }}
                  >
                    <Icon size={18} />
                    {sidebarExpanded && <span>{item.label}</span>}
                  </button>
                );
              })}

              {sidebarExpanded && <SectionTitle>Sesión</SectionTitle>}

              <button
                type="button"
                style={tabButtonStyle(false, sidebarExpanded)}
                title="Configuración"
              >
                <Settings size={18} />
                {sidebarExpanded && <span>Configuración</span>}
              </button>
            </div>

            {sidebarExpanded && (
              <div className="sidebar-bottom-card">
                <div className="circuit-bg" />
                <Activity size={17} />
                <span>Nivel {accessLevel} activo</span>
              </div>
            )}

            {sidebarExpanded && (
              <button type="button" className="logout-btn" onClick={handleLogout}>
                <LogOut size={17} />
                Cerrar sesión
              </button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="brand-header">
      <img src="/favicon1.ico" alt="INOVA" />
      <div>
        <strong>INOVA</strong>
        <small>ETO DIGITAL</small>
      </div>
    </div>
  );
}

function BrandSidebar() {
  return (
    <div className="brand-sidebar">
      <img src="/favicon1.ico" alt="INOVA" />
      <div>
        <strong>INOVA</strong>
        <small>ETO DIGITAL</small>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="section-title">{children}</div>;
}

function tabButtonStyle(isActive, expanded) {
  return {
    minHeight: expanded ? 44 : 48,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: expanded ? "flex-start" : "center",
    gap: 12,
    padding: expanded ? "0 14px" : 0,
    borderRadius: 14,
    color: isActive ? "#16a34a" : "#17213b",
    background: isActive
      ? "linear-gradient(135deg, rgba(34,197,94,.13), rgba(16,185,129,.08))"
      : "transparent",
    border: `1px solid ${isActive ? "rgba(34,197,94,.18)" : "transparent"}`,
    textDecoration: "none",
    fontWeight: isActive ? 900 : 750,
    fontSize: 13,
    letterSpacing: "-.01em",
    boxShadow: isActive ? "inset 4px 0 0 #22c55e" : "none",
    transition: "background .18s ease, color .18s ease, border-color .18s ease",
    cursor: "pointer",
  };
}

const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; margin: 0; padding: 0; }
body {
  overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  background: #f6f8fc;
}
button, input { font: inherit; }
button { -webkit-tap-highlight-color: transparent; }

.layout-root {
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  color: #10162f;
  background:
    radial-gradient(circle at 10% 0%, rgba(34,197,94,.10), transparent 26%),
    radial-gradient(circle at 86% 4%, rgba(16,185,129,.10), transparent 28%),
    linear-gradient(180deg, #f7f9fd 0%, #eef3fb 100%);
}

.topbar {
  width: calc(100% / var(--ui-scale));
  transform: scale(var(--ui-scale));
  transform-origin: top left;
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(300px, 1fr);
  align-items: center;
  gap: 18px;
  padding: 0 clamp(16px, 2vw, 28px);
  background:
    radial-gradient(circle at 18% 100%, rgba(34,197,94,.30), transparent 13%),
    radial-gradient(circle at 78% 100%, rgba(6,182,212,.24), transparent 15%),
    linear-gradient(90deg, #050713 0%, #07100c 34%, #06251e 64%, #050713 100%);
  border-bottom: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 16px 42px rgba(15,23,42,.24);
  position: relative;
  z-index: 80;
}

.topbar-left,
.topbar-right {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}
.topbar-right { justify-content: flex-end; }

.top-icon-btn {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  color: rgba(255,255,255,.84);
  background: rgba(255,255,255,.055);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 10px 26px rgba(0,0,0,.18);
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.brand-header img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  filter: brightness(0) invert(1) drop-shadow(0 0 16px rgba(255,255,255,.24));
}
.brand-header strong {
  display: block;
  color: #fff;
  font-size: 23px;
  line-height: .92;
  font-weight: 950;
  letter-spacing: .04em;
}
.brand-header small {
  display: block;
  margin-top: 6px;
  color: rgba(255,255,255,.74);
  font-size: 10px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: .19em;
  white-space: nowrap;
}

.notification-btn { position: relative; }
.notification-btn i {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 12px rgba(34,197,94,.8);
}

.user-chip {
  min-width: 0;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 6px;
  border-radius: 999px;
  color: #fff;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.065);
}
.user-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 0 20px rgba(34,197,94,.35);
}
.user-info { display: grid; line-height: 1; min-width: 0; }
.user-info strong {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 900;
}
.user-info small {
  margin-top: 4px;
  color: rgba(255,255,255,.62);
  font-size: 10px;
  font-weight: 800;
}
.user-chevron { color: rgba(255,255,255,.72); }

.workspace {
  position: relative;
  width: calc(100% / var(--ui-scale));
  height: calc((100dvh - 78px) / var(--ui-scale)) !important;
  overflow: hidden;
  transform: scale(var(--ui-scale));
  transform-origin: top left;
}
.content-area {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.content-wrap {
  width: 100%;
  height: 100%;
  transition: padding-left .22s ease, padding .22s ease;
}
.content-card {
  width: 100%;
  height: 100%;
  overflow: auto;
  border-radius: 24px;
  background:
    radial-gradient(circle at 90% 100%, rgba(34,197,94,.05), transparent 28%),
    linear-gradient(135deg, rgba(255,255,255,.97), rgba(246,249,255,.96));
  border: 1px solid #e7ecf4;
  box-shadow:
    0 24px 70px rgba(15,23,42,.10),
    inset 0 1px 0 rgba(255,255,255,.90);
  scrollbar-width: none;
}
.content-card::-webkit-scrollbar,
.sidebar::-webkit-scrollbar,
.sidebar-nav::-webkit-scrollbar { width: 0; height: 0; }

.sidebar-hotzone-global {
  position: fixed;
  z-index: 999999;
  left: 0;
  top: var(--header-height);
  bottom: 0;
  width: 74px;
  background: transparent;
  cursor: pointer;
}
.sidebar-hotzone-global::after {
  content: "";
  position: absolute;
  top: 16px;
  left: 0;
  width: 4px;
  height: calc(100% - 32px);
  border-radius: 0 999px 999px 0;
  background: linear-gradient(180deg, rgba(34,197,94,.52), rgba(16,185,129,.20));
  opacity: .40;
}

.mobile-backdrop {
  position: absolute;
  z-index: 65;
  inset: 0;
  border: 0;
  background: rgba(15,23,42,.30);
  backdrop-filter: blur(3px);
}

.sidebar {
  position: absolute;
  z-index: 100000;
  overflow: hidden;
  border-radius: 24px;
  background: rgba(255,255,255,.98);
  border: 1px solid #e6ebf3;
  box-shadow: 0 22px 70px rgba(15,23,42,.14);
  transition: width .22s ease, transform .22s ease, left .22s ease, top .22s ease, bottom .22s ease;
}
.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px;
  overflow: hidden;
}
.sidebar.collapsed .sidebar-inner {
  padding: 12px 8px;
  align-items: center;
}

.sidebar-top {
  flex: 0 0 auto;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background:
    radial-gradient(circle at 10% 0%, rgba(34,197,94,.14), transparent 36%),
    linear-gradient(135deg, #ffffff, #f8fffb);
  border: 1px solid #e7ecf4;
  overflow: hidden;
}
.sidebar.collapsed .sidebar-top {
  width: 54px;
  min-height: 54px;
  border-radius: 18px;
}
.sidebar-logo-mini {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: brightness(.2) saturate(1.6) sepia(.18) hue-rotate(92deg) drop-shadow(0 4px 12px rgba(34,197,94,.18));
}

.brand-sidebar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}
.brand-sidebar img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: brightness(.2) saturate(1.6) sepia(.18) hue-rotate(92deg) drop-shadow(0 4px 12px rgba(34,197,94,.18));
}
.brand-sidebar strong {
  display: block;
  color: #17213b;
  font-size: 21px;
  line-height: .95;
  font-weight: 950;
  letter-spacing: .03em;
}
.brand-sidebar small {
  display: block;
  margin-top: 6px;
  color: #7b8496;
  font-size: 10px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: .15em;
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 7px;
  overflow: auto;
  padding-top: 12px;
  scrollbar-width: none;
}
.section-title {
  color: #7b8496;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 14px 12px 5px;
}
.sidebar-nav button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-bottom-card {
  position: relative;
  flex: 0 0 118px;
  overflow: hidden;
  margin-top: 12px;
  border-radius: 20px;
  border: 1px solid #e7ecf4;
  background: linear-gradient(135deg, #ffffff, #f8fffb);
  color: #667085;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  font-size: 12px;
  font-weight: 800;
}
.circuit-bg {
  position: absolute;
  inset: 0;
  opacity: .50;
  background:
    linear-gradient(135deg, transparent 42%, rgba(34,197,94,.11) 42.5%, transparent 43%),
    linear-gradient(155deg, transparent 55%, rgba(16,185,129,.11) 55.5%, transparent 56%),
    radial-gradient(circle at 20% 80%, rgba(34,197,94,.16), transparent 18%);
}
.sidebar-bottom-card svg,
.sidebar-bottom-card span {
  position: relative;
  z-index: 1;
}

.logout-btn {
  flex: 0 0 auto;
  height: 42px;
  margin-top: 12px;
  border-radius: 14px;
  border: 1px solid rgba(244,63,94,.16);
  background: rgba(244,63,94,.06);
  color: #be123c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.alert {
  margin: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.08);
  color: #166534;
  font-weight: 800;
}

.hero-card,
.premium-hero {
  background:
    radial-gradient(circle at 92% 0%, rgba(34,197,94,.16), transparent 34%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(240,253,244,.84)) !important;
  border: 1px solid rgba(34,197,94,.18) !important;
  box-shadow:
    0 24px 60px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92) !important;
}

.section-kicker {
  color: #15803d !important;
  letter-spacing: .14em;
  font-weight: 950;
}

.hero-card h2,
.premium-hero h2 {
  color: #07130d !important;
}

.hero-card p,
.premium-hero p {
  color: #475569 !important;
}

.ghost-btn {
  border: 1px solid rgba(34,197,94,.30) !important;
  background: rgba(34,197,94,.08) !important;
  color: #15803d !important;
  box-shadow: 0 10px 28px rgba(34,197,94,.12) !important;
}

.ghost-btn:hover {
  background: linear-gradient(135deg, #16a34a, #22c55e) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 34px rgba(34,197,94,.25) !important;
}

.kpi-card,
.kpi-card.elevated {
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.13), transparent 32%),
    linear-gradient(135deg, #ffffff, #f8fffb) !important;
  border: 1px solid rgba(34,197,94,.16) !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.07) !important;
}

.kpi-card span {
  color: #64748b !important;
}

.kpi-card strong {
  color: #16a34a !important;
  text-shadow: 0 0 18px rgba(34,197,94,.14);
}


@media (max-width: 1180px) {
  .topbar { grid-template-columns: minmax(240px, 1fr) auto; }
  .brand-header small { display: none; }
}

@media (max-width: 760px) {
  .topbar {
    padding: 0 10px;
    grid-template-columns: 1fr auto;
    gap: 10px;
  }
  .topbar-left { gap: 9px; }
  .brand-header img { width: 42px; height: 42px; }
  .brand-header strong { font-size: 18px; }
  .notification-btn { display: none; }
  .user-chip {
    width: 42px;
    padding: 0;
    justify-content: center;
  }
  .user-info,
  .user-chevron { display: none; }
  .content-card { border-radius: 20px; }
  .sidebar { border-radius: 22px; }
}

@media (max-width: 460px) {
  .brand-header div { display: none; }
  .top-icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }
}

/* =========================
   PORTAL ETO PROFESIONAL
   ========================= */
.portal-shell {
  display: grid;
  gap: 22px;
  padding: 20px;
}

.portal-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, .95fr);
  gap: 22px;
  padding: 24px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 88% 14%, rgba(34,197,94,.14), transparent 22%),
    radial-gradient(circle at 94% 70%, rgba(16,185,129,.10), transparent 28%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(240,253,244,.90));
  border: 1px solid rgba(34,197,94,.14);
  box-shadow: 0 22px 55px rgba(15,23,42,.07);
}

.portal-hero-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.portal-hero-copy h2 {
  margin: 10px 0 12px;
  font-size: clamp(34px, 3vw, 52px);
  line-height: .98;
  letter-spacing: -.04em;
  color: #111827;
}

.portal-hero-copy p {
  max-width: 760px;
  margin: 0;
  color: #64748b;
  font-size: 18px;
  line-height: 1.6;
}

.portal-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 24px;
}

.portal-primary-btn,
.portal-secondary-btn,
.portal-cta-link {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.portal-primary-btn {
  height: 48px;
  padding: 0 22px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-weight: 900;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 18px 35px rgba(34,197,94,.22);
}

.portal-secondary-btn {
  height: 48px;
  padding: 0 22px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #166534;
  font-weight: 850;
  border: 1px solid rgba(34,197,94,.18);
  background: rgba(34,197,94,.07);
}

.portal-hero-side {
  display: flex;
}

.portal-status-card {
  width: 100%;
  border-radius: 24px;
  padding: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,252,249,.96));
  border: 1px solid rgba(34,197,94,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
}

.portal-status-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.portal-status-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #16a34a;
  background: rgba(34,197,94,.12);
}

.portal-status-pill {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 900;
  color: #15803d;
  border: 1px solid rgba(34,197,94,.18);
  background: rgba(34,197,94,.08);
}

.portal-status-body {
  margin-top: 18px;
}

.portal-status-body strong {
  display: block;
  font-size: 22px;
  font-weight: 900;
  color: #0f172a;
}

.portal-status-body p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.55;
}

.portal-status-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.portal-status-grid div {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #edf2f7;
  background: rgba(255,255,255,.85);
}

.portal-status-grid small {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.portal-status-grid b {
  display: block;
  margin-top: 6px;
  color: #111827;
  font-size: 15px;
  font-weight: 900;
}

.portal-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.portal-kpi-card {
  min-height: 120px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.12), transparent 32%),
    linear-gradient(135deg, #ffffff, #f8fffb);
  border: 1px solid rgba(34,197,94,.14);
  box-shadow: 0 16px 38px rgba(15,23,42,.06);
}

.portal-kpi-icon {
  width: 56px;
  height: 56px;
  flex: 0 0 auto;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: rgba(34,197,94,.12);
  color: #16a34a;
}

.portal-kpi-text span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .11em;
  text-transform: uppercase;
}

.portal-kpi-text strong {
  display: block;
  margin-top: 8px;
  color: #16a34a;
  font-size: clamp(32px, 2.2vw, 42px);
  line-height: 1;
  font-weight: 950;
}

.portal-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, .92fr);
  gap: 22px;
}

.portal-side-stack {
  display: grid;
  gap: 22px;
}

.portal-panel {
  padding: 22px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,251,255,.96));
  border: 1px solid #e8eef5;
  box-shadow: 0 18px 42px rgba(15,23,42,.06);
}

.portal-panel-kicker {
  display: inline-block;
  color: #15803d;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.portal-panel-head h3,
.portal-info-card h3,
.portal-highlight-card h3 {
  margin: 8px 0 6px;
  font-size: 28px;
  line-height: 1;
  color: #111827;
}

.portal-panel-head p,
.portal-info-card p,
.portal-highlight-card p {
  margin: 0;
  color: #64748b;
  line-height: 1.55;
}

.portal-shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.portal-shortcut-card {
  text-align: left;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid #e8eef5;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.portal-shortcut-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 35px rgba(15,23,42,.08);
  border-color: rgba(34,197,94,.20);
}

.portal-shortcut-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.portal-shortcut-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
}

.portal-shortcut-top span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.portal-shortcut-body strong {
  display: block;
  color: #0f172a;
  font-size: 21px;
  font-weight: 900;
}

.portal-shortcut-body p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.55;
}

.portal-shortcut-link {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #15803d;
  font-size: 13px;
  font-weight: 900;
}

.portal-shortcut-card.tone-green .portal-shortcut-icon,
.portal-shortcut-card.tone-emerald .portal-shortcut-icon,
.portal-shortcut-card.tone-teal .portal-shortcut-icon,
.portal-shortcut-card.tone-slate .portal-shortcut-icon,
.portal-shortcut-card.tone-dark .portal-shortcut-icon {
  background: rgba(34,197,94,.12);
  color: #16a34a;
}

.portal-shortcut-card.tone-slate .portal-shortcut-icon {
  background: rgba(148,163,184,.12);
  color: #334155;
}

.portal-shortcut-card.tone-dark .portal-shortcut-icon {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #ffffff;
}

.portal-bullet-list {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: grid;
  gap: 14px;
}

.portal-bullet-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #334155;
  line-height: 1.55;
  font-weight: 600;
}

.portal-bullet-list li span {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #16a34a;
  background: rgba(34,197,94,.10);
}

.portal-highlight-card {
  display: grid;
  gap: 14px;
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.12), transparent 28%),
    linear-gradient(135deg, #ffffff, #f8fffb);
}

.portal-highlight-icon {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 16px 30px rgba(34,197,94,.22);
}

.portal-cta-link {
  height: 46px;
  width: fit-content;
  padding: 0 18px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(34,197,94,.08);
  color: #15803d;
  font-weight: 900;
  border: 1px solid rgba(34,197,94,.18);
}

@media (max-width: 1180px) {
  .portal-hero,
  .portal-content-grid {
    grid-template-columns: 1fr;
  }

  .portal-shortcuts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .portal-shell {
    padding: 14px;
    gap: 16px;
  }

  .portal-hero,
  .portal-panel,
  .portal-kpi-card {
    padding: 18px;
    border-radius: 22px;
  }

  .portal-kpi-grid {
    grid-template-columns: 1fr;
  }

  .portal-hero-copy h2 {
    font-size: 30px;
  }

  .portal-hero-copy p {
    font-size: 15px;
  }

  .portal-status-grid {
    grid-template-columns: 1fr;
  }
}

`;
