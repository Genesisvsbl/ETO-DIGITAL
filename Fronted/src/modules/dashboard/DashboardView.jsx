import { useMemo, useState } from "react";
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
import API from "../../api";
import {
  formatCompactName,
  formatPercent,
  formatShortDate,
  formatFrequencyLabel,
  formatCaptureModeLabel,
  formatPlainNumber,
  formatRule,
} from "../../utils/formatters";

const CHART_COLORS = {
  navy: "#133a6b",
  blue: "#2459c3",
  blueSoft: "#9dbcf5",
  grid: "#d7e3f1",
  text: "#17324d",
  pending: "#dce7f8",
};

const PIE_COLORS = ["#133a6b", "#2459c3", "#6f97de"];

function PersonProgressLabel(props) {
  const { x, y, width, payload } = props;

  if (!payload) return null;

  const meta = Number(payload.meta || 0);
  const acumulado = Number(payload.acumulado || 0);
  const pendiente = Number(payload.pendiente || 0);

  const label = `Meta ${formatPlainNumber(meta)} | Hecho ${formatPlainNumber(
    acumulado
  )} | Pendiente ${formatPlainNumber(pendiente)}`;

  return (
    <text
      x={x + width + 10}
      y={y + 14}
      fill={CHART_COLORS.text}
      fontSize={12}
      fontWeight={700}
    >
      {label}
    </text>
  );
}

export default function DashboardView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const [dashboardFilter, setDashboardFilter] = useState({
    process_id: "",
    indicator_id: "",
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    period: "month",
  });

  const filteredIndicatorsForDashboard = useMemo(() => {
    if (!dashboardFilter.process_id) return [];
    return indicators.filter(
      (item) => String(item.process_id) === String(dashboardFilter.process_id)
    );
  }, [dashboardFilter.process_id, indicators]);

  async function handleLoadDashboard(e) {
    if (e) e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const filters = {
        ...dashboardFilter,
        level: Number(accessLevel),
      };

      if (filters.indicator_id) {
        const selectedDashboardIndicator = indicators.find(
          (item) => String(item.id) === String(filters.indicator_id)
        );

        if (selectedDashboardIndicator?.scope_type === "person") {
          if (!filters.year || !filters.month) {
            throw new Error(
              "Para dashboard por persona debes seleccionar año y mes."
            );
          }

          const data = await API.getPersonDashboard({
            indicator_id: Number(filters.indicator_id),
            year: Number(filters.year),
            month: Number(filters.month),
          });

          setDashboardData({
            ...data,
            is_person_dashboard: true,
          });
          setDashboardOverview(null);
          return;
        }
      }

      if (filters.process_id) {
        const data = await API.getProcessDashboard(filters);
        setDashboardData({
          ...data,
          is_person_dashboard: false,
        });
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
      name: formatCompactName(item.code, 16),
      fullName: `${item.code} - ${item.name}`,
      general: item.general,
    }));
  }, [dashboardData]);

  const globalRankingData = useMemo(() => {
    return (dashboardOverview?.process_ranking || []).map((item) => ({
      ...item,
      label: `${Number(item.value).toFixed(2)}%`,
    }));
  }, [dashboardOverview]);

  const personDashboardBarData = useMemo(() => {
    if (!dashboardData?.is_person_dashboard || !dashboardData?.ranking?.length) {
      return [];
    }

    return dashboardData.ranking.map((item) => ({
      name: formatCompactName(item.person_name, 20),
      fullName: item.person_name,
      meta: Number(item.target_value || 0),
      acumulado: Number(item.accumulated || 0),
      pendiente: Math.max(Number(item.remaining || 0), 0),
      cumplimiento: Number(item.compliance || 0),
      estado: item.status,
      personCode: item.person_code,
    }));
  }, [dashboardData]);

  return (
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

      {message && <div className="alert">{message}</div>}

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
                  indicator_id: "",
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
            <label>Indicador</label>
            <select
              value={dashboardFilter.indicator_id}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  indicator_id: e.target.value,
                })
              }
              disabled={!dashboardFilter.process_id}
            >
              <option value="">Todos los indicadores</option>
              {filteredIndicatorsForDashboard.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
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
            <button className="primary" disabled={loading}>
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
                    <XAxis type="number" tickFormatter={(value) => `${value}%`} />
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
              <div className="subsection-title">Distribución de estados</div>
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
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
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
            <div className="subsection-title">Vista ejecutiva por proceso</div>
            <div className="process-overview-grid compact-process-grid">
              {dashboardOverview.process_cards.map((item, index) => (
                <div
                  key={item.process_name}
                  className="process-card executive-process-card clean-process-card"
                >
                  <div className="process-rank-chip">#{index + 1}</div>
                  <div className="process-card-title">{item.process_name}</div>
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
          {dashboardData?.is_person_dashboard ? (
            <>
              <section className="process-focus-banner">
                <div>
                  <div className="section-kicker">INDICADOR POR PERSONA</div>
                  <h2>
                    {dashboardData.indicator_code} - {dashboardData.indicator_name}
                  </h2>
                  <p>Ranking mensual por cumplimiento individual.</p>
                </div>
                <div className="focus-banner-side">
                  <span className="status-pill dark">
                    {dashboardData.period_label}
                  </span>
                </div>
              </section>

              <section className="executive-kpi-grid clean-kpis">
                <div className="executive-kpi blue-main">
                  <span>Promedio cumplimiento</span>
                  <strong>
                    {formatPercent(dashboardData.summary.average_compliance)}
                  </strong>
                  <small>Promedio del indicador por persona</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Total personas</span>
                  <strong>{dashboardData.summary.total_persons}</strong>
                  <small>Personas evaluadas</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>OK</span>
                  <strong>{dashboardData.summary.ok_count}</strong>
                  <small>Cumplen meta</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Warning</span>
                  <strong>{dashboardData.summary.warning_count}</strong>
                  <small>En seguimiento</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Critical</span>
                  <strong>{dashboardData.summary.critical_count}</strong>
                  <small>Prioridad alta</small>
                </div>
              </section>

              <section className="chart-card premium-chart-card full-span">
                <div className="subsection-title">
                  Avance por persona frente a la meta
                </div>
                <div className="chart-container large-executive-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={personDashboardBarData}
                      layout="vertical"
                      margin={{ top: 18, right: 220, left: 18, bottom: 18 }}
                      barCategoryGap={20}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART_COLORS.grid}
                      />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === "Acumulado") {
                            return formatPlainNumber(value);
                          }
                          if (name === "Pendiente") {
                            return formatPlainNumber(value);
                          }
                          return value;
                        }}
                        labelFormatter={(label, payload) =>
                          payload?.[0]?.payload?.fullName || label
                        }
                      />
                      <Bar
                        dataKey="acumulado"
                        name="Acumulado"
                        stackId="a"
                        fill={CHART_COLORS.blue}
                        radius={[8, 0, 0, 8]}
                      >
                        <LabelList
                          dataKey="acumulado"
                          position="insideLeft"
                          formatter={(value) => formatPlainNumber(value)}
                          style={{
                            fill: "#ffffff",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        />
                      </Bar>
                      <Bar
                        dataKey="pendiente"
                        name="Pendiente"
                        stackId="a"
                        fill={CHART_COLORS.pending}
                        radius={[0, 8, 8, 0]}
                      >
                        <LabelList
                          dataKey="pendiente"
                          position="insideRight"
                          formatter={(value) => formatPlainNumber(value)}
                          style={{
                            fill: CHART_COLORS.text,
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        />
                        <LabelList content={<PersonProgressLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel-block">
                <div className="subsection-title">Ranking por persona</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Persona</th>
                        <th>Meta</th>
                        <th>Acumulado</th>
                        <th>Faltante</th>
                        <th>Cumplimiento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboardData.ranking || []).map((item) => (
                        <tr key={item.person_id}>
                          <td>{item.person_code}</td>
                          <td>{item.person_name}</td>
                          <td>{formatPlainNumber(item.target_value)}</td>
                          <td>{formatPlainNumber(item.accumulated)}</td>
                          <td>{formatPlainNumber(item.remaining)}</td>
                          <td>{formatPercent(item.compliance)}</td>
                          <td>
                            <span className={`status ${item.status}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {!dashboardData.ranking?.length && (
                        <tr>
                          <td colSpan="7" className="empty">
                            Sin resultados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="process-focus-banner">
                <div>
                  <div className="section-kicker">PROCESO SELECCIONADO</div>
                  <h2>{dashboardData.process.name}</h2>
                  <p>
                    Lectura ejecutiva del proceso con tendencia, comparativos y
                    foco de impacto.
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
                  <strong>{formatPercent(dashboardData.summary.average_general)}</strong>
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
                        data={dashboardData.trend.map((item) => ({
                          ...item,
                          shortLabel: formatShortDate(item.label),
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 70 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis
                          dataKey="shortLabel"
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip
                          formatter={(value) => formatPercent(value)}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.label || label
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Promedio"
                          stroke={CHART_COLORS.navy}
                          strokeWidth={3}
                          dot={{ r: 4, fill: CHART_COLORS.navy }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="chart-card premium-chart-card donut-card">
                  <div className="subsection-title">Distribución del proceso</div>
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
                  <div className="subsection-title">Comparativo de indicadores</div>
                  <div className="chart-container large-executive-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardBarData}
                        margin={{ top: 18, right: 18, left: 10, bottom: 50 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip
                          formatter={(value) => formatPercent(value)}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.fullName || label
                          }
                        />
                        <Bar
                          dataKey="general"
                          name="Resultado"
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
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="chart-card premium-chart-card full-span">
                  <div className="subsection-title">Pareto de impacto</div>
                  <div className="chart-container large-executive-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={dashboardData.pareto.map((item) => ({
                          ...item,
                          shortName: formatCompactName(item.name, 24),
                        }))}
                        margin={{ top: 18, right: 18, left: 10, bottom: 50 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis
                          dataKey="shortName"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === "% Acumulado") {
                              return `${Number(value).toFixed(1)}%`;
                            }
                            return formatPlainNumber(value);
                          }}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.name || label
                          }
                        />
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
                            formatter={(value) => `${Number(value).toFixed(1)}%`}
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
                          Frecuencia:{" "}
                          <strong>{formatFrequencyLabel(item.frequency)}</strong>
                        </div>
                        <div>
                          Captura:{" "}
                          <strong>{formatCaptureModeLabel(item.capture_mode)}</strong>
                        </div>
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
                <div className="subsection-title">Micro tendencias por indicador</div>
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
                            <Tooltip formatter={(value) => formatPercent(value)} />
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
        </>
      )}
    </section>
  );
}