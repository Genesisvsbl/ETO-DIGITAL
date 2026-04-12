export default function PortalView({
  processes,
  indicators,
  accessLevel,
  setTab,
}) {
  return (
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
  );
}