import { useEffect, useState } from "react";
import API from "./api";

import PortalView from "./modules/portal/PortalView";
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
  frequency: "day",
  capture_mode: "shifts",
  shifts: ["A", "B", "C"],
  scope_type: "standard",
};

const EMPTY_PERSON_FORM = {
  code: "",
  full_name: "",
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

export default function App() {
  const [tab, setTab] = useState("portal");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [accessLevel, setAccessLevel] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [processes, setProcesses] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [persons, setPersons] = useState([]);

  const [editingProcessId, setEditingProcessId] = useState(null);
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);

  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM);
  const [indicatorForm, setIndicatorForm] = useState(EMPTY_INDICATOR_FORM);
  const [personForm, setPersonForm] = useState(EMPTY_PERSON_FORM);

  const [selectedIndicatorForPersons, setSelectedIndicatorForPersons] =
    useState(null);
  const [selectedIndicatorPersonTargets, setSelectedIndicatorPersonTargets] =
    useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonTargetValue, setSelectedPersonTargetValue] =
    useState("");

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

      const [processList, indicatorList, personList] = await Promise.all([
        API.getProcesses(Number(accessLevel)),
        API.getIndicators({ level: Number(accessLevel) }),
        API.getPersons(),
      ]);

      setProcesses(processList);
      setIndicators(indicatorList);
      setPersons(personList);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPersons() {
    const personList = await API.getPersons();
    setPersons(personList);
    return personList;
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
    setIsAuthorized(false);
    setAccessLevel("");
    setAccessCode("");
    setAccessError("");
    setTab("portal");
    setProcesses([]);
    setIndicators([]);
    setPersons([]);
    setEditingProcessId(null);
    setEditingIndicatorId(null);
    setProcessForm(EMPTY_PROCESS_FORM);
    setIndicatorForm(EMPTY_INDICATOR_FORM);
    setPersonForm(EMPTY_PERSON_FORM);
    setSelectedIndicatorForPersons(null);
    setSelectedIndicatorPersonTargets([]);
    setSelectedPersonId("");
    setSelectedPersonTargetValue("");
    setMessage("");
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
        frequency: indicatorForm.frequency,
        capture_mode:
          indicatorForm.scope_type === "entity"
            ? "single"
            : indicatorForm.capture_mode,
        shifts:
          indicatorForm.scope_type === "entity" ||
          indicatorForm.capture_mode === "single"
            ? []
            : normalizeShifts(indicatorForm.shifts),
        scope_type: indicatorForm.scope_type,
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

      if (selectedIndicatorForPersons?.id === item.id) {
        setSelectedIndicatorForPersons(null);
        setSelectedIndicatorPersonTargets([]);
        setSelectedPersonId("");
        setSelectedPersonTargetValue("");
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

  async function handleLoadIndicatorPersonTargets(indicator) {
    try {
      setLoading(true);
      setTab("indicators");
      setSelectedIndicatorForPersons(indicator);

      const targets = await API.getPersonTargets({
        indicator_id: indicator.id,
        active_only: true,
      });

      setSelectedIndicatorPersonTargets(targets || []);
      setSelectedPersonId("");
      setSelectedPersonTargetValue("");
      clearMessageSoon("Entidades del indicador cargadas correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePerson() {
    try {
      setLoading(true);

      const payload = {
        code: String(personForm.code || "").trim(),
        full_name: String(personForm.full_name || "").trim(),
        is_active: Boolean(personForm.is_active),
      };

      if (!payload.full_name) {
        throw new Error("Debes ingresar el nombre de la entidad");
      }

      const created = await API.createPerson(payload);
      const personList = await loadPersons();

      setPersonForm(EMPTY_PERSON_FORM);

      if (created?.id) {
        setSelectedPersonId(String(created.id));
      } else {
        const matchedPerson = personList.find((item) => {
          const sameCode =
            payload.code &&
            String(item.code || "").trim().toLowerCase() ===
              payload.code.toLowerCase();

          const sameName =
            String(item.full_name || item.name || "")
              .trim()
              .toLowerCase() === payload.full_name.toLowerCase();

          return sameCode || sameName;
        });

        if (matchedPerson?.id) {
          setSelectedPersonId(String(matchedPerson.id));
        }
      }

      clearMessageSoon("Entidad creada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrUpdatePersonTarget() {
    try {
      if (!selectedIndicatorForPersons?.id) {
        throw new Error("Primero debes seleccionar un indicador");
      }

      if (!selectedPersonId) {
        throw new Error("Debes seleccionar una entidad");
      }

      setLoading(true);

      await API.createOrUpdatePersonTarget({
        indicator_id: Number(selectedIndicatorForPersons.id),
        person_id: Number(selectedPersonId),
        target_value:
          selectedPersonTargetValue === "" ||
          selectedPersonTargetValue === null
            ? Number(selectedIndicatorForPersons.target_value || 0)
            : Number(selectedPersonTargetValue),
        is_active: true,
      });

      const targets = await API.getPersonTargets({
        indicator_id: selectedIndicatorForPersons.id,
        active_only: true,
      });

      setSelectedIndicatorPersonTargets(targets || []);
      setSelectedPersonId("");
      setSelectedPersonTargetValue("");
      clearMessageSoon("Entidad asociada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePersonTarget(item) {
    const ok = window.confirm(
      `¿Deseas quitar a "${item.person_name || item.entity_name}" del indicador "${
        selectedIndicatorForPersons?.name || ""
      }"?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deletePersonTarget(item.id);

      if (selectedIndicatorForPersons?.id) {
        const targets = await API.getPersonTargets({
          indicator_id: selectedIndicatorForPersons.id,
          active_only: true,
        });
        setSelectedIndicatorPersonTargets(targets || []);
      }

      clearMessageSoon("Entidad quitada del indicador");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

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
                if (window.innerWidth <= 980) {
                  setMobileSidebarOpen(false);
                }
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
          <PortalView
            processes={processes}
            indicators={indicators}
            accessLevel={accessLevel}
            setTab={setTab}
          />
        )}

        {tab === "processes" && (
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
        )}

        {tab === "indicators" && (
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
            entities={persons}
            selectedIndicatorForEntities={selectedIndicatorForPersons}
            selectedIndicatorEntityTargets={selectedIndicatorPersonTargets}
            selectedEntityId={selectedPersonId}
            selectedEntityTargetValue={selectedPersonTargetValue}
            setSelectedEntityId={setSelectedPersonId}
            setSelectedEntityTargetValue={setSelectedPersonTargetValue}
            handleLoadIndicatorEntityTargets={handleLoadIndicatorPersonTargets}
            handleCreateOrUpdateEntityTarget={handleCreateOrUpdatePersonTarget}
            handleDeleteEntityTarget={handleDeletePersonTarget}
            entityForm={{
              code: personForm.code,
              name: personForm.full_name,
              entity_type: "persona",
              is_active: personForm.is_active,
            }}
            setEntityForm={(next) =>
              setPersonForm({
                code: next.code ?? "",
                full_name: next.name ?? "",
                is_active: next.is_active ?? true,
              })
            }
            handleCreateEntity={handleCreatePerson}
            loading={loading}
          />
        )}

        {tab === "daily" && (
          <DailyView
            accessLevel={accessLevel}
            processes={processes}
            indicators={indicators}
          />
        )}

        {tab === "history" && (
          <HistoryView
            accessLevel={accessLevel}
            processes={processes}
            indicators={indicators}
          />
        )}

        {tab === "dashboard" && (
          <DashboardView
            accessLevel={accessLevel}
            processes={processes}
            indicators={indicators}
          />
        )}
      </main>
    </div>
  );
}