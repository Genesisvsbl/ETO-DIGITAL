import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock3,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";

export default function PortalView({
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
          <h2>Centro de control ETO DIGITAL</h2>
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