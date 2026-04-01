import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  LabelList,
} from "recharts";
import API from "./api";

const TABS = [
  { key: "portal", label: "Portal" },
  { key: "processes", label: "Procesos" },
  { key: "indicators", label: "Indicadores" },
  { key: "daily", label: "Captura diaria" },
  { key: "history", label: "Histórico" },
  { key: "dashboard", label: "Dashboard" },
];

const OPERATORS = [">", ">=", "<", "<=", "="];
const UNITS = ["%", "días", "horas", "unidades", "casos", "número"];

const ACCESS_CODES = {
  1: "N1-ETO",
  2: "N2-ETO",
};

const CHART_COLORS = {
  navy: "#133a6b",
  blue: "#2459c3",
  blueSoft: "#6f97de",
  bluePale: "#dfe9fb",
  slate: "#7086a0",
  grid: "#d7e3f1",
  text: "#17324d",
};

const PIE_COLORS = ["#133a6b", "#2459c3", "#6f97de"];

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
  warning_operator: ">=",
  warning_value: "",
  critical_operator: "<",
  critical_value: "",
  shifts: ["A", "B", "C"],
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

function formatCompactName(text = "", max = 22) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatPercent(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

function formatPlainNumber(value) {
  return Number(value || 0).toFixed(2);
}

function formatDateInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export default function App() {
  const [tab, setTab] = useState("portal");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [accessLevel, setAccessLevel] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [processes, setProcesses] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [dailyResults, setDailyResults] = useState([]);
  const [historyResults, setHistoryResults] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [editingProcessId, setEditingProcessId] = useState(null);
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);
  const [editingDailyId, setEditingDailyId] = useState(null);

  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM);
  const [indicatorForm, setIndicatorForm] = useState(EMPTY_INDICATOR_FORM);

  const [dailyForm, setDailyForm] = useState({
    record_date: new Date().toISOString().slice(0, 10),
    process_id: "",
    indicator_id: "",
    shift_a: "",
    shift_b: "",
    shift_c: "",
    observation: "",
  });

  const [historyFilter, setHistoryFilter] = useState({
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    process_id: "",
    indicator_id: "",
  });

  const [monthMatrixMeta, setMonthMatrixMeta] = useState(null);
  const [monthMatrixRows, setMonthMatrixRows] = useState([]);

  const [dashboardFilter, setDashboardFilter] = useState({
    process_id: "",
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    period: "month",
  });

  useEffect(() => {
    if (isAuthorized && accessLevel) {
      loadBaseData();
      setHistoryFilter((prev) => ({ ...prev, level: String(accessLevel) }));
      setDashboardFilter((prev) => ({ ...prev, level: String(accessLevel) }));
      setProcessForm((prev) => ({ ...prev, level: Number(accessLevel) }));
      setIndicatorForm((prev) => ({
        ...prev,
        meeting_level: Number(accessLevel),
      }));
    }
  }, [isAuthorized, accessLevel]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 980) {
        setMobileSidebarOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function loadBaseData() {
    try {
      setLoading(true);
      const [p, i] = await Promise.all([
        API.getProcesses(Number(accessLevel)),
        API.getIndicators({ level: Number(accessLevel) }),
      ]);
      setProcesses(p);
      setIndicators(i);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearMessageSoon(text) {
    setMessage(text);
    window.clearTimeout(window.__etoMsgTimeout);
    window.__etoMsgTimeout = window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  function closeMobileSidebar() {
    if (window.innerWidth <= 980) {
      setMobileSidebarOpen(false);
    }
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

  function resetDailyForm() {
    setEditingDailyId(null);
    setDailyForm({
      record_date: new Date().toISOString().slice(0, 10),
      process_id: "",
      indicator_id: "",
      shift_a: "",
      shift_b: "",
      shift_c: "",
      observation: "",
    });
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
    setIsAuthorized(false);
    setAccessLevel("");
    setAccessCode("");
    setAccessError("");
    setTab("portal");
    setProcesses([]);
    setIndicators([]);
    setDailyResults([]);
    setHistoryResults([]);
    setHistorySummary(null);
    setDashboardOverview(null);
    setDashboardData(null);
    setEditingDailyId(null);
    setMonthMatrixMeta(null);
    setMonthMatrixRows([]);
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
    closeMobileSidebar();
  }

  async function handleDeleteProcess(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el proceso "${item.name}"?\n\nEsto también eliminará sus indicadores y registros asociados si existen.`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteProcess(item.id);
      if (editingProcessId === item.id) resetProcessForm();
      clearMessageSoon("Proceso eliminado correctamente");
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIndicator(e) {
    e.preventDefault();
    try {
      setLoading(true);

      const payload = {
        name: indicatorForm.name.trim(),
        process_id: Number(indicatorForm.process_id),
        meeting_level: Number(accessLevel),
        unit: indicatorForm.unit,
        target_operator: indicatorForm.target_operator,
        target_value: Number(indicatorForm.target_value),
        warning_operator: indicatorForm.warning_operator,
        warning_value: Number(indicatorForm.warning_value),
        critical_operator: indicatorForm.critical_operator,
        critical_value: Number(indicatorForm.critical_value),
        shifts: indicatorForm.shifts,
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
    setIndicatorForm({
      name: item.name,
      process_id: String(item.process_id),
      meeting_level: item.meeting_level,
      unit: item.unit,
      target_operator: item.target_operator,
      target_value: item.target_value,
      warning_operator: item.warning_operator,
      warning_value: item.warning_value,
      critical_operator: item.critical_operator,
      critical_value: item.critical_value,
      shifts: item.shifts
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    });
    closeMobileSidebar();
  }

  async function handleDeleteIndicator(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el indicador "${item.code} - ${item.name}"?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteIndicator(item.id);
      if (editingIndicatorId === item.id) resetIndicatorForm();
      clearMessageSoon("Indicador eliminado correctamente");
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDaily(e) {
    e.preventDefault();
    try {
      setLoading(true);

      const payload = {
        indicator_id: Number(dailyForm.indicator_id),
        record_date: dailyForm.record_date,
        shift_a: dailyForm.shift_a === "" ? null : Number(dailyForm.shift_a),
        shift_b: dailyForm.shift_b === "" ? null : Number(dailyForm.shift_b),
        shift_c: dailyForm.shift_c === "" ? null : Number(dailyForm.shift_c),
        observation: dailyForm.observation,
      };

      if (editingDailyId) {
        await API.updateDailyRecord(editingDailyId, payload);
        clearMessageSoon("Registro actualizado correctamente");
        setEditingDailyId(null);
      } else {
        await API.saveDailyRecord(payload);
        clearMessageSoon("Captura diaria guardada correctamente");
      }

      await handleSearchDaily();
      await loadBaseData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchDaily() {
    try {
      setLoading(true);
      const data = await API.getDailyByDate({
        record_date: dailyForm.record_date,
        process_id: dailyForm.process_id || undefined,
        level: Number(accessLevel),
      });
      setDailyResults(data);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runHistorySearch(customFilters = null) {
    try {
      setLoading(true);
      const filters = {
        ...(customFilters || historyFilter),
        level: Number(accessLevel),
      };
      const [historyData, summaryData] = await Promise.all([
        API.getHistory(filters),
        API.getHistorySummary(filters),
      ]);
      setHistoryResults(historyData);
      setHistorySummary(summaryData);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchHistory(e) {
    e.preventDefault();
    await runHistorySearch();
  }

  async function handleLoadDashboard(e) {
    if (e) e.preventDefault();

    try {
      setLoading(true);
      const filters = {
        ...dashboardFilter,
        level: Number(accessLevel),
      };

      if (filters.process_id) {
        const data = await API.getProcessDashboard(filters);
        setDashboardData(data);
        setDashboardOverview(null);
      } else {
        const overview = await API.getDashboardOverview(filters);
        setDashboardOverview(overview);
        setDashboardData(null);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteHistory(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el registro del indicador "${item.indicator_code} - ${item.indicator_name}" del día ${item.record_date}?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteDailyRecord(item.id);
      clearMessageSoon("Registro eliminado correctamente");
      await runHistorySearch();
      if (dailyForm.record_date === formatDateInput(item.record_date)) {
        await handleSearchDaily();
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditHistory(item) {
    setEditingDailyId(item.id);
    setTab("daily");
    setDailyForm({
      record_date: formatDateInput(item.record_date),
      process_id: String(item.process_id || ""),
      indicator_id: String(item.indicator_id || ""),
      shift_a: item.shift_a ?? "",
      shift_b: item.shift_b ?? "",
      shift_c: item.shift_c ?? "",
      observation: item.observation || "",
    });
    closeMobileSidebar();
    clearMessageSoon("Registro cargado para edición");
  }

  async function handleLoadMonthMatrix() {
    try {
      if (!historyFilter.year || !historyFilter.month || !historyFilter.indicator_id) {
        setMessage("Debes seleccionar año, mes e indicador para carga masiva.");
        return;
      }

      setLoading(true);
      const data = await API.getMonthMatrix({
        year: Number(historyFilter.year),
        month: Number(historyFilter.month),
        indicator_id: Number(historyFilter.indicator_id),
      });
      setMonthMatrixMeta(data);
      setMonthMatrixRows(
        (data.rows || []).map((row) => ({
          ...row,
          record_date: formatDateInput(row.record_date),
          shift_a: row.shift_a ?? "",
          shift_b: row.shift_b ?? "",
          shift_c: row.shift_c ?? "",
          observation: row.observation || "",
        }))
      );
      clearMessageSoon("Matriz mensual cargada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMonthMatrix() {
    try {
      if (!historyFilter.indicator_id || !monthMatrixRows.length) {
        setMessage("No hay matriz mensual cargada para guardar.");
        return;
      }

      setLoading(true);
      await API.saveMonthMatrix({
        indicator_id: Number(historyFilter.indicator_id),
        rows: monthMatrixRows.map((row) => ({
          record_date: row.record_date,
          shift_a: row.shift_a === "" ? null : Number(row.shift_a),
          shift_b: row.shift_b === "" ? null : Number(row.shift_b),
          shift_c: row.shift_c === "" ? null : Number(row.shift_c),
          observation: row.observation || "",
        })),
      });
      clearMessageSoon("Carga masiva guardada correctamente");
      await runHistorySearch();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateMonthMatrixRow(index, field, value) {
    setMonthMatrixRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const filteredIndicatorsForDaily = useMemo(() => {
    if (!dailyForm.process_id) return [];
    return indicators.filter(
      (item) => String(item.process_id) === String(dailyForm.process_id)
    );
  }, [dailyForm.process_id, indicators]);

  const filteredIndicatorsForHistory = useMemo(() => {
    if (!historyFilter.process_id) return indicators;
    return indicators.filter(
      (item) => String(item.process_id) === String(historyFilter.process_id)
    );
  }, [historyFilter.process_id, indicators]);

  const selectedIndicator = useMemo(() => {
    return indicators.find(
      (item) => String(item.id) === String(dailyForm.indicator_id)
    );
  }, [dailyForm.indicator_id, indicators]);

  function toggleShift(shift) {
    setIndicatorForm((prev) => {
      const exists = prev.shifts.includes(shift);
      return {
        ...prev,
        shifts: exists
          ? prev.shifts.filter((s) => s !== shift)
          : [...prev.shifts, shift],
      };
    });
  }

  function formatRule(op, value, unit) {
    if (value === "" || value === null || value === undefined) return "-";
    return `${op} ${value}${unit === "número" ? "" : ` ${unit}`}`;
  }

  function formatGeneral(value, unit = "%") {
    return `${value}${unit === "número" ? "" : ` ${unit}`}`;
  }

  const dashboardPieData = useMemo(() => {
    const source =
      dashboardData?.status_distribution ||
      dashboardOverview?.status_distribution ||
      [];
    const total = source.reduce((acc, item) => acc + item.value, 0);

    return source
      .filter((x) => x.value > 0)
      .map((item) => ({
        ...item,
        percentage: total ? ((item.value / total) * 100).toFixed(1) : "0.0",
      }));
  }, [dashboardData, dashboardOverview]);

  const dashboardBarData = useMemo(() => {
    if (!dashboardData?.indicator_cards?.length) return [];
    return dashboardData.indicator_cards.map((item) => ({
      name: formatCompactName(item.name, 18),
      fullName: item.name,
      general: item.general,
      target: item.target_value,
      warning: item.warning_value,
      critical: item.critical_value,
    }));
  }, [dashboardData]);

  const globalRankingData = useMemo(() => {
    return (dashboardOverview?.process_ranking || []).map((item) => ({
      ...item,
      label: `${Number(item.value).toFixed(2)}%`,
    }));
  }, [dashboardOverview]);

  const activeTabLabel = TABS.find((x) => x.key === tab)?.label || "Portal";

  if (!isAuthorized) {
    return (
      <div className="access-shell tech-access">
        <div className="access-topbar">
          <div className="access-topbar-brand">
            <LogoImage className="eto-logo-image topbar-logo-image" />
            <div>
              <div className="access-topbar-title">ETO DIGITAL</div>
              <div className="access-topbar-sub">
                Control ejecutivo de indicadores
              </div>
            </div>
          </div>

          <div className="access-topbar-badge">Entorno estratégico</div>
        </div>

        <div className="access-layout">
          <section className="tech-left">
            <div className="tech-glow"></div>
            <div className="tech-grid-lines"></div>
            <div className="tech-orb orb-a"></div>
            <div className="tech-orb orb-b"></div>

            <div className="tech-badge-pill">PLATAFORMA INTELIGENTE</div>

            <div className="tech-logo-block">
              <LogoImage className="eto-logo-image tech-logo-main-image" />
            </div>

            <div className="tech-copy">
              <h1>ETO DIGITAL</h1>
              <h2>Visibilidad, control y lectura ejecutiva en tiempo real.</h2>
              <p>
                Plataforma corporativa diseñada para seguimiento operativo,
                análisis de desempeño y lectura ejecutiva centralizada con una
                estética premium y tecnológica.
              </p>
            </div>

            <div className="tech-cards">
              <div className="tech-card">
                <span>01</span>
                <strong>Control total</strong>
                <small>Gestión integral por nivel de reunión.</small>
              </div>

              <div className="tech-card">
                <span>02</span>
                <strong>Análisis ejecutivo</strong>
                <small>Indicadores, tendencias y lectura visual rápida.</small>
              </div>

              <div className="tech-card">
                <span>03</span>
                <strong>Decisiones rápidas</strong>
                <small>Entorno pensado para criterio y acción.</small>
              </div>
            </div>
          </section>

          <section className="access-login-card">
            <div className="access-login-head">
              <AccessHeroLogo />
              <h2>Iniciar acceso</h2>
              <p>Seleccione su nivel e ingrese su código corporativo.</p>
            </div>

            <form onSubmit={handleAccessSubmit} className="access-form">
              <div className="field">
                <label>Nivel</label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  required
                >
                  <option value="">Seleccione</option>
                  <option value="1">Nivel 1</option>
                  <option value="2">Nivel 2</option>
                </select>
              </div>

              <div className="field">
                <label>Código</label>
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Ingrese código"
                  required
                />
              </div>

              {accessError && <div className="access-error">{accessError}</div>}

              <button className="primary access-btn">Ingresar al sistema</button>

              <div className="access-note">
                Acceso controlado por nivel y restringido durante la sesión
                activa.
              </div>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
        mobileSidebarOpen ? "sidebar-mobile-open" : ""
      }`}
    >
      <div
        className={`sidebar-overlay ${mobileSidebarOpen ? "show" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-head premium">
            <LogoImage className="eto-logo-image sidebar-logo-image" />
            <div className="brand-wrap">
              <div className="brand">ETO DIGITAL</div>
              <div className="brand-sub">
                Control ejecutivo de procesos e indicadores
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle desktop-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>

          <button
            type="button"
            className="sidebar-toggle mobile-close"
            onClick={() => setMobileSidebarOpen(false)}
            title="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="sidebar-section-label">Módulos</div>

        <nav className="menu">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={`menu-btn ${tab === item.key ? "active" : ""}`}
              onClick={() => {
                setTab(item.key);
                closeMobileSidebar();
              }}
              title={item.label}
            >
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer-card">
          <span className="sidebar-footer-label">Sesión actual</span>
          <strong>Nivel {accessLevel}</strong>
          <small>Código validado</small>
        </div>
      </aside>

      <main className="content">
        <header className="topbar corporate premium-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setMobileSidebarOpen(true)}
            >
              ☰
            </button>

            <div>
              <div className="section-kicker top-kicker">
                PLATAFORMA CORPORATIVA
              </div>
              <h1>{activeTabLabel}</h1>
              <p>
                Gestión, captura y analítica ejecutiva con visión centralizada.
                Nivel activo: <strong>{accessLevel}</strong>
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              title="Colapsar menú"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              ⧉
            </button>

            <div className="search-box">
              <span>⌕</span>
              <input placeholder="Buscar módulo o vista..." />
            </div>

            <button type="button" className="icon-btn" title="Notificaciones">
              🔔
            </button>

            <span className="status-pill online">Nivel {accessLevel}</span>
            <button type="button" className="secondary" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </header>

        {message && <div className="alert">{message}</div>}

        {tab === "portal" && (
          <>
            <section className="hero-card premium-hero">
              <div>
                <div className="section-kicker">VISIÓN GENERAL</div>
                <h2>Centro de control ETO DIGITAL</h2>
                <p>
                  Plataforma corporativa para parametrizar indicadores, capturar
                  resultados y analizar desempeño operativo por proceso.
                </p>
              </div>
              <button className="ghost-btn" onClick={() => setTab("dashboard")}>
                Ir al dashboard
              </button>
            </section>

            <section className="stats-row portal-kpis">
              <div className="kpi-card elevated">
                <span>Procesos activos</span>
                <strong>{processes.length}</strong>
              </div>
              <div className="kpi-card elevated">
                <span>Indicadores configurados</span>
                <strong>{indicators.length}</strong>
              </div>
              <div className="kpi-card elevated">
                <span>Nivel activo</span>
                <strong>{accessLevel}</strong>
              </div>
            </section>
          </>
        )}

        {tab === "processes" && (
          <section className="content-card">
            <div className="card-header-block">
              <div>
                <div className="section-kicker">DATOS MAESTROS</div>
                <h3>Administración de procesos</h3>
                <p>Solo se muestran procesos del nivel {accessLevel}.</p>
              </div>
            </div>

            <div className="split-grid">
              <div className="panel-block">
                <div className="subsection-title">
                  {editingProcessId ? "Editar proceso" : "Crear proceso"}
                </div>

                <form
                  onSubmit={handleCreateProcess}
                  className="inline-form-grid two-cols"
                >
                  <div className="field">
                    <label>Nombre</label>
                    <input
                      value={processForm.name}
                      onChange={(e) =>
                        setProcessForm({ ...processForm, name: e.target.value })
                      }
                      placeholder="Ej. Seguridad"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Nivel</label>
                    <input value={`Nivel ${accessLevel}`} disabled />
                  </div>

                  <div className="field full">
                    <div className="actions">
                      <button className="primary">
                        {editingProcessId
                          ? "Actualizar proceso"
                          : "Crear proceso"}
                      </button>

                      {editingProcessId && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={resetProcessForm}
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              <div className="panel-block">
                <div className="subsection-title">Listado de procesos</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Proceso</th>
                        <th>Nivel</th>
                        <th className="actions-col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.name}</td>
                          <td>{item.level}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-btn edit"
                                onClick={() => handleEditProcess(item)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="table-btn delete"
                                onClick={() => handleDeleteProcess(item)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!processes.length && (
                        <tr>
                          <td colSpan="4" className="empty">
                            Sin procesos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "indicators" && (
          <section className="content-card">
            <div className="card-header-block">
              <div>
                <div className="section-kicker">DATOS MAESTROS</div>
                <h3>Administración de indicadores</h3>
                <p>Solo se muestran indicadores del nivel {accessLevel}.</p>
              </div>
            </div>

            <div className="split-grid indicators-professional-layout">
              <div className="panel-block">
                <div className="subsection-title">
                  {editingIndicatorId ? "Editar indicador" : "Crear indicador"}
                </div>

                <form onSubmit={handleCreateIndicator} className="form">
                  <div className="field">
                    <label>Nombre</label>
                    <input
                      value={indicatorForm.name}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="Ej. Cumplimiento de despacho"
                      required
                    />
                  </div>

                  <div className="inline-form-grid two-cols">
                    <div className="field">
                      <label>Proceso</label>
                      <select
                        value={indicatorForm.process_id}
                        onChange={(e) =>
                          setIndicatorForm({
                            ...indicatorForm,
                            process_id: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Seleccione</option>
                        {processes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - Nivel {item.level}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Nivel de reunión</label>
                      <input value={`Nivel ${accessLevel}`} disabled />
                    </div>
                  </div>

                  <div className="field">
                    <label>Unidad</label>
                    <select
                      value={indicatorForm.unit}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          unit: e.target.value,
                        })
                      }
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="threshold-grid">
                    <div className="threshold-box">
                      <label>Meta</label>
                      <div className="threshold-row">
                        <select
                          value={indicatorForm.target_operator}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              target_operator: e.target.value,
                            })
                          }
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.01"
                          value={indicatorForm.target_value}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              target_value: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="threshold-box">
                      <label>Warning</label>
                      <div className="threshold-row">
                        <select
                          value={indicatorForm.warning_operator}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              warning_operator: e.target.value,
                            })
                          }
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.01"
                          value={indicatorForm.warning_value}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              warning_value: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="threshold-box">
                      <label>Critical</label>
                      <div className="threshold-row">
                        <select
                          value={indicatorForm.critical_operator}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              critical_operator: e.target.value,
                            })
                          }
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.01"
                          value={indicatorForm.critical_value}
                          onChange={(e) =>
                            setIndicatorForm({
                              ...indicatorForm,
                              critical_value: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rule-preview">
                    <div className="rule-item">
                      <span>Meta</span>
                      <strong>
                        {formatRule(
                          indicatorForm.target_operator,
                          indicatorForm.target_value,
                          indicatorForm.unit
                        )}
                      </strong>
                    </div>
                    <div className="rule-item">
                      <span>Warning</span>
                      <strong>
                        {formatRule(
                          indicatorForm.warning_operator,
                          indicatorForm.warning_value,
                          indicatorForm.unit
                        )}
                      </strong>
                    </div>
                    <div className="rule-item">
                      <span>Critical</span>
                      <strong>
                        {formatRule(
                          indicatorForm.critical_operator,
                          indicatorForm.critical_value,
                          indicatorForm.unit
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="field">
                    <label>Turnos habilitados</label>
                    <div className="checks">
                      {["A", "B", "C"].map((shift) => (
                        <label key={shift} className="check">
                          <input
                            type="checkbox"
                            checked={indicatorForm.shifts.includes(shift)}
                            onChange={() => toggleShift(shift)}
                          />
                          {shift}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="actions">
                    <button className="primary">
                      {editingIndicatorId
                        ? "Actualizar indicador"
                        : "Crear indicador"}
                    </button>

                    {editingIndicatorId && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={resetIndicatorForm}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="panel-block">
                <div className="subsection-title">Listado de indicadores</div>
                <div className="table-wrap indicators-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Proceso</th>
                        <th>Unidad</th>
                        <th>Meta</th>
                        <th>Warning</th>
                        <th>Critical</th>
                        <th>Turnos</th>
                        <th className="actions-col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((item) => (
                        <tr key={item.id}>
                          <td>{item.code}</td>
                          <td>{item.name}</td>
                          <td>{item.process_name}</td>
                          <td>{item.unit}</td>
                          <td>
                            {formatRule(
                              item.target_operator,
                              item.target_value,
                              item.unit
                            )}
                          </td>
                          <td>
                            {formatRule(
                              item.warning_operator,
                              item.warning_value,
                              item.unit
                            )}
                          </td>
                          <td>
                            {formatRule(
                              item.critical_operator,
                              item.critical_value,
                              item.unit
                            )}
                          </td>
                          <td>{item.shifts}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-btn edit"
                                onClick={() => handleEditIndicator(item)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="table-btn delete"
                                onClick={() => handleDeleteIndicator(item)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!indicators.length && (
                        <tr>
                          <td colSpan="9" className="empty">
                            Sin indicadores
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "daily" && (
          <section className="content-card">
            <div className="card-header-block">
              <div>
                <div className="section-kicker">OPERACIÓN</div>
                <h3>
                  {editingDailyId ? "Editar captura diaria" : "Captura diaria"}
                </h3>
                <p>
                  Registra por fecha y turno los resultados operativos por
                  indicador.
                </p>
              </div>
            </div>

            <div className="split-grid">
              <div className="panel-block">
                <form onSubmit={handleSaveDaily} className="form">
                  <div className="inline-form-grid two-cols">
                    <div className="field">
                      <label>Fecha</label>
                      <input
                        type="date"
                        value={dailyForm.record_date}
                        onChange={(e) =>
                          setDailyForm({
                            ...dailyForm,
                            record_date: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="field">
                      <label>Proceso</label>
                      <select
                        value={dailyForm.process_id}
                        onChange={(e) =>
                          setDailyForm({
                            ...dailyForm,
                            process_id: e.target.value,
                            indicator_id: "",
                          })
                        }
                      >
                        <option value="">Seleccione</option>
                        {processes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - Nivel {item.level}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>Indicador</label>
                    <select
                      value={dailyForm.indicator_id}
                      onChange={(e) =>
                        setDailyForm({
                          ...dailyForm,
                          indicator_id: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Seleccione</option>
                      {filteredIndicatorsForDaily.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedIndicator && (
                    <div className="rule-preview compact">
                      <div className="rule-item">
                        <span>Unidad</span>
                        <strong>{selectedIndicator.unit}</strong>
                      </div>
                      <div className="rule-item">
                        <span>Meta</span>
                        <strong>
                          {formatRule(
                            selectedIndicator.target_operator,
                            selectedIndicator.target_value,
                            selectedIndicator.unit
                          )}
                        </strong>
                      </div>
                      <div className="rule-item">
                        <span>Warning</span>
                        <strong>
                          {formatRule(
                            selectedIndicator.warning_operator,
                            selectedIndicator.warning_value,
                            selectedIndicator.unit
                          )}
                        </strong>
                      </div>
                      <div className="rule-item">
                        <span>Critical</span>
                        <strong>
                          {formatRule(
                            selectedIndicator.critical_operator,
                            selectedIndicator.critical_value,
                            selectedIndicator.unit
                          )}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="inline-form-grid three-cols">
                    <div className="field">
                      <label>Turno A</label>
                      <input
                        type="number"
                        step="0.01"
                        value={dailyForm.shift_a}
                        onChange={(e) =>
                          setDailyForm({ ...dailyForm, shift_a: e.target.value })
                        }
                        disabled={!selectedIndicator?.shifts.includes("A")}
                      />
                    </div>

                    <div className="field">
                      <label>Turno B</label>
                      <input
                        type="number"
                        step="0.01"
                        value={dailyForm.shift_b}
                        onChange={(e) =>
                          setDailyForm({ ...dailyForm, shift_b: e.target.value })
                        }
                        disabled={!selectedIndicator?.shifts.includes("B")}
                      />
                    </div>

                    <div className="field">
                      <label>Turno C</label>
                      <input
                        type="number"
                        step="0.01"
                        value={dailyForm.shift_c}
                        onChange={(e) =>
                          setDailyForm({ ...dailyForm, shift_c: e.target.value })
                        }
                        disabled={!selectedIndicator?.shifts.includes("C")}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Observación</label>
                    <textarea
                      rows="4"
                      value={dailyForm.observation}
                      onChange={(e) =>
                        setDailyForm({
                          ...dailyForm,
                          observation: e.target.value,
                        })
                      }
                      placeholder="Detalle del día..."
                    />
                  </div>

                  <div className="actions">
                    <button className="primary">
                      {editingDailyId ? "Actualizar captura" : "Guardar captura"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleSearchDaily}
                    >
                      Consultar día
                    </button>
                    {editingDailyId && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={resetDailyForm}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="panel-block">
                <div className="subsection-title">Resultados del día</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Indicador</th>
                        <th>Proceso</th>
                        <th>General</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyResults.map((item) => (
                        <tr key={item.id}>
                          <td>{item.record_date}</td>
                          <td>
                            {item.indicator_code} - {item.indicator_name}
                          </td>
                          <td>{item.process_name}</td>
                          <td>{formatGeneral(item.general, item.unit)}</td>
                          <td>
                            <span className={`status ${item.status}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!dailyResults.length && (
                        <tr>
                          <td colSpan="5" className="empty">
                            Sin registros para esa fecha
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="content-card">
            <div className="card-header-block">
              <div>
                <div className="section-kicker">CONSULTA</div>
                <h3>Histórico y consolidado por proceso</h3>
                <p>
                  Consulta detalle histórico, filtra por indicador y usa carga
                  masiva por mes.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearchHistory} className="filters-card">
              <div className="inline-form-grid" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                <div className="field">
                  <label>Año</label>
                  <input
                    type="number"
                    value={historyFilter.year}
                    onChange={(e) =>
                      setHistoryFilter({ ...historyFilter, year: e.target.value })
                    }
                    placeholder="2026"
                  />
                </div>

                <div className="field">
                  <label>Mes</label>
                  <input
                    type="number"
                    value={historyFilter.month}
                    onChange={(e) =>
                      setHistoryFilter({
                        ...historyFilter,
                        month: e.target.value,
                      })
                    }
                    placeholder="1-12"
                  />
                </div>

                <div className="field">
                  <label>Día</label>
                  <input
                    type="number"
                    value={historyFilter.day}
                    onChange={(e) =>
                      setHistoryFilter({ ...historyFilter, day: e.target.value })
                    }
                    placeholder="1-31"
                  />
                </div>

                <div className="field">
                  <label>Nivel</label>
                  <input value={`Nivel ${accessLevel}`} disabled />
                </div>

                <div className="field">
                  <label>Proceso</label>
                  <select
                    value={historyFilter.process_id}
                    onChange={(e) =>
                      setHistoryFilter({
                        ...historyFilter,
                        process_id: e.target.value,
                        indicator_id: "",
                      })
                    }
                  >
                    <option value="">Todos</option>
                    {processes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Indicador</label>
                  <select
                    value={historyFilter.indicator_id}
                    onChange={(e) =>
                      setHistoryFilter({
                        ...historyFilter,
                        indicator_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Todos</option>
                    {filteredIndicatorsForHistory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="actions top-space">
                <button className="primary">Consultar histórico</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleLoadMonthMatrix}
                >
                  Cargar mes
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleSaveMonthMatrix}
                >
                  Guardar todo el mes
                </button>
              </div>
            </form>

            {monthMatrixMeta && (
              <section className="panel-block">
                <div className="subsection-title">
                  Carga masiva mensual - {monthMatrixMeta.indicator_code} -{" "}
                  {monthMatrixMeta.indicator_name}
                </div>

                <div className="rule-preview compact" style={{ marginBottom: 14 }}>
                  <div className="rule-item">
                    <span>Proceso</span>
                    <strong>{monthMatrixMeta.process_name}</strong>
                  </div>
                  <div className="rule-item">
                    <span>Unidad</span>
                    <strong>{monthMatrixMeta.unit}</strong>
                  </div>
                  <div className="rule-item">
                    <span>Meta</span>
                    <strong>
                      {formatRule(
                        monthMatrixMeta.target_operator,
                        monthMatrixMeta.target_value,
                        monthMatrixMeta.unit
                      )}
                    </strong>
                  </div>
                  <div className="rule-item">
                    <span>Turnos</span>
                    <strong>{monthMatrixMeta.shifts}</strong>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Turno A</th>
                        <th>Turno B</th>
                        <th>Turno C</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthMatrixRows.map((row, index) => (
                        <tr key={row.record_date}>
                          <td>{row.record_date}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.shift_a}
                              onChange={(e) =>
                                updateMonthMatrixRow(index, "shift_a", e.target.value)
                              }
                              disabled={!monthMatrixMeta.shifts.includes("A")}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.shift_b}
                              onChange={(e) =>
                                updateMonthMatrixRow(index, "shift_b", e.target.value)
                              }
                              disabled={!monthMatrixMeta.shifts.includes("B")}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.shift_c}
                              onChange={(e) =>
                                updateMonthMatrixRow(index, "shift_c", e.target.value)
                              }
                              disabled={!monthMatrixMeta.shifts.includes("C")}
                            />
                          </td>
                          <td>
                            <input
                              value={row.observation}
                              onChange={(e) =>
                                updateMonthMatrixRow(index, "observation", e.target.value)
                              }
                              placeholder="Observación del día"
                            />
                          </td>
                        </tr>
                      ))}
                      {!monthMatrixRows.length && (
                        <tr>
                          <td colSpan="5" className="empty">
                            Sin filas para el mes seleccionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {historySummary && (
              <>
                <section className="stats-row summary-row">
                  <div className="kpi-card elevated">
                    <span>Registros</span>
                    <strong>{historySummary.total_records}</strong>
                  </div>
                  <div className="kpi-card elevated">
                    <span>Promedio general</span>
                    <strong>
                      {formatPercent(historySummary.average_general)}
                    </strong>
                  </div>
                  <div className="kpi-card elevated">
                    <span>OK</span>
                    <strong>{historySummary.ok_count}</strong>
                  </div>
                  <div className="kpi-card elevated">
                    <span>Warning</span>
                    <strong>{historySummary.warning_count}</strong>
                  </div>
                  <div className="kpi-card elevated">
                    <span>Critical</span>
                    <strong>{historySummary.critical_count}</strong>
                  </div>
                </section>

                <section className="panel-block process-summary-block">
                  <div className="subsection-title">Resumen por proceso</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Proceso</th>
                          <th>Promedio general</th>
                          <th>Registros</th>
                          <th>OK</th>
                          <th>Warning</th>
                          <th>Critical</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historySummary.processes.map((item) => (
                          <tr key={item.process_name}>
                            <td>{item.process_name}</td>
                            <td>{formatPercent(item.average_general)}</td>
                            <td>{item.total_records}</td>
                            <td>{item.ok_count}</td>
                            <td>{item.warning_count}</td>
                            <td>{item.critical_count}</td>
                          </tr>
                        ))}
                        {!historySummary.processes.length && (
                          <tr>
                            <td colSpan="6" className="empty">
                              Sin resumen por proceso
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            <section className="panel-block">
              <div className="subsection-title">Detalle histórico</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Proceso</th>
                      <th>Indicador</th>
                      <th>A</th>
                      <th>B</th>
                      <th>C</th>
                      <th>General</th>
                      <th>Estado</th>
                      <th>Obs.</th>
                      <th className="actions-col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyResults.map((item) => (
                      <tr key={item.id}>
                        <td>{item.record_date}</td>
                        <td>{item.process_name}</td>
                        <td>
                          {item.indicator_code} - {item.indicator_name}
                        </td>
                        <td>{item.shift_a ?? "-"}</td>
                        <td>{item.shift_b ?? "-"}</td>
                        <td>{item.shift_c ?? "-"}</td>
                        <td>{formatGeneral(item.general, item.unit)}</td>
                        <td>
                          <span className={`status ${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.observation || "-"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="table-btn edit"
                              onClick={() => handleEditHistory(item)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="table-btn delete"
                              onClick={() => handleDeleteHistory(item)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!historyResults.length && (
                      <tr>
                        <td colSpan="10" className="empty">
                          Sin resultados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {tab === "dashboard" && (
          <section className="content-card dashboard-master-card">
            <div className="card-header-block dashboard-header">
              <div>
                <div className="section-kicker">ANALÍTICA EJECUTIVA</div>
                <h3>Dashboard corporativo</h3>
                <p>
                  Vista global por procesos o análisis detallado por proceso con
                  tendencia, comparativos y Pareto.
                </p>
              </div>
              <div className="dashboard-header-badge">Nivel {accessLevel}</div>
            </div>

            <form onSubmit={handleLoadDashboard} className="filters-card">
              <div className="inline-form-grid dashboard-filters">
                <div className="field">
                  <label>Proceso</label>
                  <select
                    value={dashboardFilter.process_id}
                    onChange={(e) =>
                      setDashboardFilter({
                        ...dashboardFilter,
                        process_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Todos los procesos</option>
                    {processes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Año</label>
                  <input
                    type="number"
                    value={dashboardFilter.year}
                    onChange={(e) =>
                      setDashboardFilter({
                        ...dashboardFilter,
                        year: e.target.value,
                      })
                    }
                    placeholder="2026"
                  />
                </div>

                <div className="field">
                  <label>Mes</label>
                  <input
                    type="number"
                    value={dashboardFilter.month}
                    onChange={(e) =>
                      setDashboardFilter({
                        ...dashboardFilter,
                        month: e.target.value,
                      })
                    }
                    placeholder="1-12"
                  />
                </div>

                <div className="field">
                  <label>Día</label>
                  <input
                    type="number"
                    value={dashboardFilter.day}
                    onChange={(e) =>
                      setDashboardFilter({
                        ...dashboardFilter,
                        day: e.target.value,
                      })
                    }
                    placeholder="1-31"
                  />
                </div>

                <div className="field">
                  <label>Nivel</label>
                  <input value={`Nivel ${accessLevel}`} disabled />
                </div>

                <div className="field">
                  <label>Vista rápida</label>
                  <select
                    value={dashboardFilter.period}
                    onChange={(e) =>
                      setDashboardFilter({
                        ...dashboardFilter,
                        period: e.target.value,
                      })
                    }
                  >
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                  </select>
                </div>

                <div className="field action-field">
                  <label>&nbsp;</label>
                  <button className="primary">
                    {loading ? "Cargando..." : "Cargar dashboard"}
                  </button>
                </div>
              </div>
            </form>

            {dashboardOverview && (
              <>
                <section className="executive-kpi-grid clean-kpis">
                  <div className="executive-kpi blue-main">
                    <span>Promedio general</span>
                    <strong>
                      {formatPercent(dashboardOverview.summary.average_general)}
                    </strong>
                    <small>Consolidado de todos los procesos</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Registros</span>
                    <strong>{dashboardOverview.summary.total_records}</strong>
                    <small>Volumen total analizado</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>OK</span>
                    <strong>{dashboardOverview.summary.ok_count}</strong>
                    <small>En rango esperado</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Warning</span>
                    <strong>{dashboardOverview.summary.warning_count}</strong>
                    <small>Con seguimiento</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Critical</span>
                    <strong>{dashboardOverview.summary.critical_count}</strong>
                    <small>Atención prioritaria</small>
                  </div>
                </section>

                <div className="dashboard-overview-grid premium-overview">
                  <section className="chart-card premium-chart-card">
                    <div className="subsection-title">Ranking de procesos</div>
                    <div className="chart-container executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={globalRankingData}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                          barCategoryGap={28}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis
                            type="number"
                            tickFormatter={(value) => `${value}%`}
                          />
                          <YAxis dataKey="name" type="category" width={140} />
                          <Tooltip formatter={(value) => formatPercent(value)} />
                          <Bar
                            dataKey="value"
                            name="Promedio"
                            fill={CHART_COLORS.blue}
                            radius={[10, 10, 10, 10]}
                          >
                            <LabelList
                              dataKey="value"
                              position="right"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="chart-card premium-chart-card donut-card">
                    <div className="subsection-title">
                      Distribución de estados
                    </div>
                    <div className="chart-container executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardPieData}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={92}
                            innerRadius={58}
                            paddingAngle={4}
                            cornerRadius={8}
                            label={({ name, percentage }) =>
                              `${name}: ${percentage}%`
                            }
                          >
                            {dashboardPieData.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, item) =>
                              `${value} (${item?.payload?.percentage || 0}%)`
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                <section className="dashboard-process-panel">
                  <div className="subsection-title">
                    Vista ejecutiva por proceso
                  </div>
                  <div className="process-overview-grid compact-process-grid">
                    {dashboardOverview.process_cards.map((item, index) => (
                      <div
                        key={item.process_name}
                        className="process-card executive-process-card clean-process-card"
                      >
                        <div className="process-rank-chip">#{index + 1}</div>
                        <div className="process-card-title">
                          {item.process_name}
                        </div>
                        <div className="process-card-value big-percent">
                          {formatPercent(item.average_general)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {dashboardData && (
              <>
                <section className="process-focus-banner">
                  <div>
                    <div className="section-kicker">PROCESO SELECCIONADO</div>
                    <h2>{dashboardData.process.name}</h2>
                    <p>
                      Lectura ejecutiva del proceso con tendencia, comparativos
                      y foco de impacto.
                    </p>
                  </div>
                  <div className="focus-banner-side">
                    <span className="status-pill">
                      Nivel {dashboardData.process.level}
                    </span>
                    <span className="status-pill dark">Detalle ejecutivo</span>
                  </div>
                </section>

                <section className="executive-kpi-grid clean-kpis">
                  <div className="executive-kpi blue-main">
                    <span>Promedio general</span>
                    <strong>
                      {formatPercent(dashboardData.summary.average_general)}
                    </strong>
                    <small>Resultado consolidado del proceso</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Registros</span>
                    <strong>{dashboardData.summary.total_records}</strong>
                    <small>Total de capturas analizadas</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>OK</span>
                    <strong>{dashboardData.summary.ok_count}</strong>
                    <small>Dentro de rango</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Warning</span>
                    <strong>{dashboardData.summary.warning_count}</strong>
                    <small>Seguimiento</small>
                  </div>

                  <div className="executive-kpi blue-neutral">
                    <span>Critical</span>
                    <strong>{dashboardData.summary.critical_count}</strong>
                    <small>Prioridad alta</small>
                  </div>
                </section>

                <div className="dashboard-process-grid premium-process-grid">
                  <section className="chart-card premium-chart-card">
                    <div className="subsection-title">Tendencia general</div>
                    <div className="chart-container executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={dashboardData.trend}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(value) => `${value}%`} />
                          <Tooltip formatter={(value) => formatPercent(value)} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="Promedio"
                            stroke={CHART_COLORS.navy}
                            strokeWidth={3}
                            dot={{ r: 4, fill: CHART_COLORS.navy }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList
                              dataKey="value"
                              position="top"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="chart-card premium-chart-card donut-card">
                    <div className="subsection-title">
                      Distribución del proceso
                    </div>
                    <div className="chart-container executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardPieData}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={90}
                            innerRadius={56}
                            paddingAngle={4}
                            cornerRadius={8}
                            label={({ name, percentage }) =>
                              `${name}: ${percentage}%`
                            }
                          >
                            {dashboardPieData.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, item) =>
                              `${value} (${item?.payload?.percentage || 0}%)`
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="chart-card premium-chart-card full-span">
                    <div className="subsection-title">
                      Comparativo de indicadores
                    </div>
                    <div className="chart-container large-executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dashboardBarData}
                          margin={{ top: 18, right: 18, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => `${value}%`} />
                          <Tooltip formatter={(value) => formatPercent(value)} />

                          <Bar
                            dataKey="general"
                            name="General"
                            fill={CHART_COLORS.navy}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey="general"
                              position="top"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            />
                          </Bar>

                          <Bar
                            dataKey="target"
                            name="Meta"
                            fill={CHART_COLORS.blue}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey="target"
                              position="top"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 700,
                                fontSize: 10,
                              }}
                            />
                          </Bar>

                          <Bar
                            dataKey="warning"
                            name="Warning"
                            fill={CHART_COLORS.blueSoft}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey="warning"
                              position="top"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 700,
                                fontSize: 10,
                              }}
                            />
                          </Bar>

                          <Bar
                            dataKey="critical"
                            name="Critical"
                            fill={CHART_COLORS.bluePale}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey="critical"
                              position="top"
                              formatter={(value) => formatPercent(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 700,
                                fontSize: 10,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="chart-card premium-chart-card full-span">
                    <div className="subsection-title">Pareto de impacto</div>
                    <div className="chart-container large-executive-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={dashboardData.pareto}
                          margin={{ top: 18, right: 18, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip />

                          <Bar
                            yAxisId="left"
                            dataKey="value"
                            name="Impacto"
                            fill={CHART_COLORS.blue}
                            radius={[8, 8, 0, 0]}
                          >
                            <LabelList
                              dataKey="value"
                              position="top"
                              formatter={(value) => formatPlainNumber(value)}
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            />
                          </Bar>

                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="cumulative"
                            name="% Acumulado"
                            stroke={CHART_COLORS.navy}
                            strokeWidth={3}
                            dot={{ r: 4, fill: CHART_COLORS.navy }}
                          >
                            <LabelList
                              dataKey="cumulative"
                              position="top"
                              formatter={(value) =>
                                `${Number(value).toFixed(1)}%`
                              }
                              style={{
                                fill: CHART_COLORS.text,
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                <section className="executive-section">
                  <div className="subsection-title">Monitoreo por indicador</div>
                  <div className="indicator-summary-grid">
                    {dashboardData.indicator_cards.map((item) => (
                      <div
                        key={item.indicator_id}
                        className="indicator-summary-card clean-indicator-card"
                      >
                        <div className="indicator-card-head">
                          <div>
                            <div className="indicator-code">{item.code}</div>
                            <div className="indicator-name">{item.name}</div>
                          </div>
                          <span className={`status ${item.status}`}>
                            {item.status}
                          </span>
                        </div>

                        <div className="indicator-main-value">
                          {formatPercent(item.general)}
                        </div>

                        <div className="indicator-rules compact-rules">
                          <div>
                            Meta:{" "}
                            {formatRule(
                              item.target_operator,
                              item.target_value,
                              item.unit
                            )}
                          </div>
                          <div>
                            Warning:{" "}
                            {formatRule(
                              item.warning_operator,
                              item.warning_value,
                              item.unit
                            )}
                          </div>
                          <div>
                            Critical:{" "}
                            {formatRule(
                              item.critical_operator,
                              item.critical_value,
                              item.unit
                            )}
                          </div>
                          <div>
                            Tendencia:{" "}
                            <strong>
                              {item.direction === "up"
                                ? "Al alza"
                                : item.direction === "down"
                                  ? "A la baja"
                                  : "Estable"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="executive-section">
                  <div className="subsection-title">
                    Micro tendencias por indicador
                  </div>
                  <div className="indicator-trend-grid">
                    {dashboardData.indicator_trends.map((item) => (
                      <div
                        key={item.indicator_id}
                        className="indicator-trend-card clean-trend-card"
                      >
                        <div className="indicator-trend-head">
                          <div>
                            <div className="indicator-code">{item.code}</div>
                            <div className="indicator-name">{item.name}</div>
                          </div>
                          <span className={`trend-badge ${item.direction}`}>
                            {item.direction === "up"
                              ? "Al alza"
                              : item.direction === "down"
                                ? "A la baja"
                                : "Estable"}
                          </span>
                        </div>

                        <div className="indicator-main-value small">
                          {formatPercent(item.last_value)}
                        </div>

                        <div className="mini-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={item.points}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={CHART_COLORS.grid}
                              />
                              <XAxis dataKey="label" hide />
                              <YAxis hide />
                              <Tooltip
                                formatter={(value) => formatPercent(value)}
                              />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke={CHART_COLORS.blue}
                                strokeWidth={2.6}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}