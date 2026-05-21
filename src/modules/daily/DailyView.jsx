import { useEffect, useMemo, useState } from "react";
import API from "../../api";
import {
  formatCaptureModeLabel,
  formatFrequencyLabel,
  formatGeneral,
  formatPercent,
  formatPlainNumber,
  formatRule,
} from "../../utils/formatters";
import { formatRecordValue, normalizeShifts } from "../../utils/indicatorHelpers";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FilePlus2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

function formatDateInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function buildStableEntityRowId(row, index) {
  if (row.__rowId) return row.__rowId;
  if (row.entity_id) return `entity-${row.entity_id}`;
  return `row-${index}`;
}

function buildEntityCompliance(value, target) {
  const numericTarget = Number(target || 0);
  const numericValue =
    value === "" || value === null || value === undefined ? 0 : Number(value);

  let compliance = 0;

  if (numericTarget > 0) {
    compliance = Math.min((numericValue / numericTarget) * 100, 100);
  } else {
    compliance = numericValue === 0 ? 100 : 0;
  }

  let status = "critical";
  if (compliance >= 100) status = "ok";
  else if (compliance > 0) status = "warning";

  return {
    compliance,
    status,
  };
}

function statusLabel(status) {
  if (status === "ok") return "Cumple";
  if (status === "warning") return "Alerta";
  if (status === "critical") return "Crítico";
  return status || "-";
}

export default function DailyView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingDailyId, setEditingDailyId] = useState(null);
  const [dailySearch, setDailySearch] = useState("");

  const [dailyResults, setDailyResults] = useState([]);
  const [dailyEntityRows, setDailyEntityRows] = useState([]);

  const [dailyForm, setDailyForm] = useState({
    record_date: new Date().toISOString().slice(0, 10),
    process_id: "",
    indicator_id: "",
    single_value: "",
    shift_a: "",
    shift_b: "",
    shift_c: "",
    observation: "",
  });

  function clearMessageSoon(text) {
    setMessage(text);
    window.clearTimeout(window.__etoDailyMsgTimeout);
    window.__etoDailyMsgTimeout = window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  const filteredIndicatorsForDaily = useMemo(() => {
    if (!dailyForm.process_id) return [];
    return indicators.filter(
      (item) => String(item.process_id) === String(dailyForm.process_id)
    );
  }, [dailyForm.process_id, indicators]);

  const selectedIndicator = useMemo(() => {
    return indicators.find(
      (item) => String(item.id) === String(dailyForm.indicator_id)
    );
  }, [dailyForm.indicator_id, indicators]);

  const selectedIndicatorShifts = useMemo(() => {
    return normalizeShifts(selectedIndicator?.shifts);
  }, [selectedIndicator]);

  const isEntityDailyIndicator = useMemo(() => {
    return selectedIndicator?.scope_type === "entity";
  }, [selectedIndicator]);

  const visibleDailyResults = useMemo(() => {
    const query = String(dailySearch || "").trim().toLowerCase();

    if (!query) return dailyResults;

    return dailyResults.filter((item) => {
      const values = [
        item.record_date,
        item.indicator_code,
        item.indicator_name,
        item.process_name,
        item.entity_name,
        item.entity_code,
        item.status,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return values.includes(query);
    });
  }, [dailyResults, dailySearch]);

  useEffect(() => {
    async function loadDailyEntityRows() {
      if (
        !isEntityDailyIndicator ||
        !dailyForm.indicator_id ||
        !dailyForm.record_date
      ) {
        setDailyEntityRows([]);
        return;
      }

      try {
        const indicatorId = Number(dailyForm.indicator_id);

        const [grid, targets] = await Promise.all([
          API.getEntityCaptureGrid({
            indicator_id: indicatorId,
            record_date: dailyForm.record_date,
          }),
          API.getEntityTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (targets || []).map((item) => [
            Number(item.entity_id),
            Number(item.target_value || 0),
          ])
        );

        const rows = (grid.rows || []).map((row) => {
          const entityId = Number(row.entity_id);

          const targetValue = Number(
            targetMap.get(entityId) ??
              (row.target_value !== null && row.target_value !== undefined
                ? row.target_value
                : selectedIndicator?.target_value || 0)
          );

          const dayValue =
            row.day_value !== null && row.day_value !== undefined
              ? Number(row.day_value)
              : 0;

          const { compliance, status } = buildEntityCompliance(
            dayValue,
            targetValue
          );

          return {
            __rowId: `entity-${entityId}`,
            entity_id: entityId,
            entity_code: row.entity_code || "",
            entity_name: row.entity_name || "",
            entity_type: row.entity_type || "",
            target_value: targetValue,
            value:
              row.day_value !== null && row.day_value !== undefined
                ? String(row.day_value)
                : "",
            observation: row.observation || "",
            accumulated:
              row.accumulated !== null && row.accumulated !== undefined
                ? Number(row.accumulated)
                : 0,
            remaining: Math.max(targetValue - dayValue, 0),
            compliance,
            status,
          };
        });

        setDailyEntityRows(rows);
      } catch (err) {
        setMessage(err.message);
      }
    }

    loadDailyEntityRows();
  }, [
    isEntityDailyIndicator,
    dailyForm.indicator_id,
    dailyForm.record_date,
    selectedIndicator,
  ]);

  const entityDailySummary = useMemo(() => {
    if (!isEntityDailyIndicator) return null;

    const rows = dailyEntityRows || [];
    const totalEntities = rows.length;

    if (!totalEntities) {
      return {
        totalEntities: 0,
        averageCompliance: 0,
        okCount: 0,
        warningCount: 0,
        criticalCount: 0,
      };
    }

    let okCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalCompliance = 0;

    rows.forEach((row) => {
      const target = Number(row.target_value || 0);
      const value =
        row.value === "" || row.value === null || row.value === undefined
          ? 0
          : Number(row.value);

      const { compliance, status } = buildEntityCompliance(value, target);

      totalCompliance += compliance;

      if (status === "ok") okCount += 1;
      else if (status === "warning") warningCount += 1;
      else criticalCount += 1;
    });

    return {
      totalEntities,
      averageCompliance: totalCompliance / totalEntities,
      okCount,
      warningCount,
      criticalCount,
    };
  }, [dailyEntityRows, isEntityDailyIndicator]);

  function updateDailyEntityRow(index, field, value) {
    setDailyEntityRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const nextRow = {
          ...row,
          [field]: value,
        };

        const target = Number(
          nextRow.target_value || selectedIndicator?.target_value || 0
        );

        const dayValue =
          nextRow.value === "" ||
          nextRow.value === null ||
          nextRow.value === undefined
            ? 0
            : Number(nextRow.value);

        const { compliance, status } = buildEntityCompliance(dayValue, target);

        return {
          ...nextRow,
          remaining: Math.max(target - dayValue, 0),
          compliance,
          status,
        };
      })
    );
  }

  function resetDailyForm() {
    setEditingDailyId(null);
    setDailyEntityRows([]);
    setDailyForm({
      record_date: new Date().toISOString().slice(0, 10),
      process_id: "",
      indicator_id: "",
      single_value: "",
      shift_a: "",
      shift_b: "",
      shift_c: "",
      observation: "",
    });
  }

  async function handleSaveDaily(e) {
    e.preventDefault();

    try {
      setLoading(true);

      if (selectedIndicator?.scope_type === "entity") {
        const validRows = (dailyEntityRows || []).map((row) => ({
          entity_id: Number(row.entity_id),
          value:
            row.value === "" || row.value === null || row.value === undefined
              ? 0
              : Number(row.value),
          observation: row.observation || "",
        }));

        if (!validRows.length) {
          throw new Error("Este indicador no tiene entidades asociadas.");
        }

        await API.saveEntityGrid({
          indicator_id: Number(dailyForm.indicator_id),
          record_date: dailyForm.record_date,
          rows: validRows,
        });

        clearMessageSoon("Captura por entidad guardada correctamente");
        await handleSearchDaily();
        return;
      }

      const payload = {
        indicator_id: Number(dailyForm.indicator_id),
        record_date: dailyForm.record_date,
        single_value:
          dailyForm.single_value === "" ? null : Number(dailyForm.single_value),
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
        clearMessageSoon("Captura guardada correctamente");
      }

      await handleSearchDaily();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchDaily() {
    try {
      setLoading(true);

      if (selectedIndicator?.scope_type === "entity" && dailyForm.indicator_id) {
        const indicatorId = Number(dailyForm.indicator_id);

        const [grid, targets] = await Promise.all([
          API.getEntityCaptureGrid({
            indicator_id: indicatorId,
            record_date: dailyForm.record_date,
          }),
          API.getEntityTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (targets || []).map((item) => [
            Number(item.entity_id),
            Number(item.target_value || 0),
          ])
        );

        setDailyResults(
          (grid.rows || []).map((item) => {
            const entityId = Number(item.entity_id);

            const targetValue = Number(
              targetMap.get(entityId) ??
                (item.target_value !== null && item.target_value !== undefined
                  ? item.target_value
                  : selectedIndicator?.target_value || 0)
            );

            const dayValue =
              item.day_value !== null && item.day_value !== undefined
                ? Number(item.day_value)
                : 0;

            const { compliance, status } = buildEntityCompliance(
              dayValue,
              targetValue
            );

            return {
              id: `${item.entity_id}-${dailyForm.record_date}`,
              record_date: dailyForm.record_date,
              indicator_code: selectedIndicator.code,
              indicator_name: selectedIndicator.name,
              process_name: selectedIndicator.process_name,
              entity_name: item.entity_name,
              entity_code: item.entity_code,
              entity_type: item.entity_type,
              value: item.day_value,
              general: compliance,
              unit: "%",
              status,
              scope_type: "entity",
            };
          })
        );

        return;
      }

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

  function handleEditFromResults(item) {
    setEditingDailyId(item.id);
    setDailyForm({
      record_date: formatDateInput(item.record_date),
      process_id: String(item.process_id || ""),
      indicator_id: String(item.indicator_id || ""),
      single_value: item.single_value ?? "",
      shift_a: item.shift_a ?? "",
      shift_b: item.shift_b ?? "",
      shift_c: item.shift_c ?? "",
      observation: item.observation || "",
    });
    clearMessageSoon("Registro cargado para edición");
  }

  async function handleDeleteFromResults(item) {
    const ok = window.confirm(
      `¿Deseas eliminar el registro del indicador "${item.indicator_code} - ${item.indicator_name}" del día ${item.record_date}?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteDailyRecord(item.id);
      clearMessageSoon("Registro eliminado correctamente");
      await handleSearchDaily();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="daily-page">
      <style>{dailyCss}</style>

      <div className="daily-bg-pattern" />

      <header className="daily-header">
        <div>
          <div className="daily-kicker">OPERACIÓN</div>
          <h2>{editingDailyId ? "Editar captura diaria" : "Captura diaria"}</h2>
          <p>Registra por fecha y turno los resultados operativos por indicador.</p>
        </div>

        <div className="daily-header-kpis">
          <div className="daily-mini-kpi">
            <CalendarDays size={22} />
            <div>
              <span>Fecha seleccionada</span>
              <strong>{dailyForm.record_date}</strong>
            </div>
          </div>

          <div className="daily-mini-kpi">
            <ClipboardCheck size={22} />
            <div>
              <span>Procesos</span>
              <strong>{processes.length}</strong>
            </div>
          </div>

          <div className="daily-mini-kpi">
            <BarChart3 size={22} />
            <div>
              <span>Indicadores</span>
              <strong>{indicators.length}</strong>
            </div>
          </div>

          <div className="daily-mini-kpi">
            <CheckCircle2 size={22} />
            <div>
              <span>Capturas registradas</span>
              <strong>{dailyResults.length}</strong>
            </div>
          </div>
        </div>
      </header>

      {message && <div className="daily-alert">{message}</div>}

      <div className="daily-grid">
        <article className="daily-panel form-panel">
          <div className="daily-panel-title">
            <div className="daily-panel-icon">
              <CalendarDays size={24} />
            </div>

            <div>
              <h3>Registrar captura</h3>
              <p>Completa los datos para registrar los resultados del día.</p>
            </div>
          </div>

          <form onSubmit={handleSaveDaily} className="daily-form">
            <div className="daily-form-two">
              <div className="daily-field">
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

              <div className="daily-field">
                <label>Proceso</label>
                <select
                  value={dailyForm.process_id}
                  onChange={(e) => {
                    setDailyForm({
                      ...dailyForm,
                      process_id: e.target.value,
                      indicator_id: "",
                      single_value: "",
                      shift_a: "",
                      shift_b: "",
                      shift_c: "",
                      observation: "",
                    });
                    setDailyEntityRows([]);
                  }}
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

            <div className="daily-field">
              <label>Indicador</label>
              <select
                value={dailyForm.indicator_id}
                onChange={(e) => {
                  const newIndicatorId = e.target.value;

                  setDailyForm({
                    ...dailyForm,
                    indicator_id: newIndicatorId,
                    single_value: "",
                    shift_a: "",
                    shift_b: "",
                    shift_c: "",
                    observation: "",
                  });
                  setDailyEntityRows([]);
                }}
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
              <div className="daily-rule-preview">
                <div className="daily-rule-item">
                  <span>Unidad</span>
                  <strong>{selectedIndicator.unit}</strong>
                </div>
                <div className="daily-rule-item">
                  <span>Frecuencia</span>
                  <strong>{formatFrequencyLabel(selectedIndicator.frequency)}</strong>
                </div>
                <div className="daily-rule-item">
                  <span>Captura</span>
                  <strong>
                    {selectedIndicator.scope_type === "entity"
                      ? "Por entidad"
                      : formatCaptureModeLabel(selectedIndicator.capture_mode)}
                  </strong>
                </div>
                <div className="daily-rule-item">
                  <span>Meta</span>
                  <strong>
                    {formatRule(
                      selectedIndicator.target_operator,
                      selectedIndicator.target_value,
                      selectedIndicator.unit
                    )}
                  </strong>
                </div>
                <div className="daily-rule-item warning">
                  <span>Warning</span>
                  <strong>
                    {formatRule(
                      selectedIndicator.warning_operator,
                      selectedIndicator.warning_value,
                      selectedIndicator.unit
                    )}
                  </strong>
                </div>
                <div className="daily-rule-item critical">
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

            {isEntityDailyIndicator ? (
              <>
                {entityDailySummary && (
                  <section className="entity-summary-row">
                    <div className="entity-kpi">
                      <span>Entidades</span>
                      <strong>{entityDailySummary.totalEntities}</strong>
                    </div>
                    <div className="entity-kpi">
                      <span>Promedio</span>
                      <strong>{formatPercent(entityDailySummary.averageCompliance)}</strong>
                    </div>
                    <div className="entity-kpi ok">
                      <span>OK</span>
                      <strong>{entityDailySummary.okCount}</strong>
                    </div>
                    <div className="entity-kpi warning">
                      <span>Warning</span>
                      <strong>{entityDailySummary.warningCount}</strong>
                    </div>
                    <div className="entity-kpi critical">
                      <span>Critical</span>
                      <strong>{entityDailySummary.criticalCount}</strong>
                    </div>
                  </section>
                )}

                <div className="entity-capture-table-wrap">
                  <table className="entity-capture-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Entidad</th>
                        <th>Tipo</th>
                        <th>Meta</th>
                        <th>Valor día</th>
                        <th>Cumplimiento</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyEntityRows.map((row, index) => (
                        <tr key={buildStableEntityRowId(row, index)}>
                          <td>{row.entity_code || "-"}</td>
                          <td>{row.entity_name || "-"}</td>
                          <td>{row.entity_type || "-"}</td>
                          <td>{formatPlainNumber(row.target_value || 0)}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.value}
                              onChange={(e) =>
                                updateDailyEntityRow(index, "value", e.target.value)
                              }
                              placeholder="Valor"
                            />
                          </td>
                          <td>
                            <span className={`daily-status ${row.status || "critical"}`}>
                              {formatPercent(row.compliance || 0)}
                            </span>
                          </td>
                          <td>
                            <input
                              value={row.observation}
                              onChange={(e) =>
                                updateDailyEntityRow(
                                  index,
                                  "observation",
                                  e.target.value
                                )
                              }
                              placeholder="Observación"
                            />
                          </td>
                        </tr>
                      ))}

                      {!dailyEntityRows.length && (
                        <tr>
                          <td colSpan="7" className="daily-empty">
                            Este indicador no tiene entidades asociadas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : selectedIndicator?.capture_mode === "single" ? (
              <div className="daily-field">
                <label>Valor único</label>
                <input
                  type="number"
                  step="0.01"
                  value={dailyForm.single_value}
                  onChange={(e) =>
                    setDailyForm({
                      ...dailyForm,
                      single_value: e.target.value,
                    })
                  }
                />
              </div>
            ) : (
              <div className="daily-form-three">
                <div className="daily-field">
                  <label>Turno A</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dailyForm.shift_a}
                    onChange={(e) =>
                      setDailyForm({
                        ...dailyForm,
                        shift_a: e.target.value,
                      })
                    }
                    disabled={!selectedIndicatorShifts.includes("A")}
                    placeholder="Opcional"
                  />
                </div>

                <div className="daily-field">
                  <label>Turno B</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dailyForm.shift_b}
                    onChange={(e) =>
                      setDailyForm({
                        ...dailyForm,
                        shift_b: e.target.value,
                      })
                    }
                    disabled={!selectedIndicatorShifts.includes("B")}
                    placeholder="Opcional"
                  />
                </div>

                <div className="daily-field">
                  <label>Turno C</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dailyForm.shift_c}
                    onChange={(e) =>
                      setDailyForm({
                        ...dailyForm,
                        shift_c: e.target.value,
                      })
                    }
                    disabled={!selectedIndicatorShifts.includes("C")}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            {!isEntityDailyIndicator && (
              <div className="daily-field">
                <label>Observación</label>
                <textarea
                  rows="5"
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
            )}

            <div className="daily-actions">
              <button className="daily-primary" disabled={loading}>
                <ClipboardCheck size={18} />
                {editingDailyId ? "Actualizar captura" : "Guardar captura"}
              </button>

              <button
                type="button"
                className="daily-secondary"
                onClick={handleSearchDaily}
                disabled={loading}
              >
                <Eye size={18} />
                Consultar día
              </button>

              {editingDailyId && (
                <button
                  type="button"
                  className="daily-secondary"
                  onClick={resetDailyForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="daily-panel results-panel">
          <div className="results-head">
            <div className="daily-panel-title compact">
              <div className="daily-panel-icon">
                <BarChart3 size={24} />
              </div>

              <div>
                <h3>Resultados del día</h3>
                <p>Consulta los resultados registrados para la fecha seleccionada.</p>
              </div>
            </div>

            <div className="daily-search">
              <Search size={18} />
              <input
                value={dailySearch}
                onChange={(event) => setDailySearch(event.target.value)}
                placeholder="Buscar en resultados..."
              />
            </div>
          </div>

          <div className="daily-table-wrap">
            <table className="daily-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Indicador</th>
                  <th>Proceso</th>
                  {isEntityDailyIndicator && <th>Entidad</th>}
                  <th>Valor</th>
                  <th>General</th>
                  <th>Estado</th>
                  {!isEntityDailyIndicator && <th className="actions-col">Acciones</th>}
                </tr>
              </thead>

              <tbody>
                {visibleDailyResults.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.record_date}</strong>
                    </td>
                    <td>
                      <span className="daily-indicator-name">
                        {item.indicator_code} - {item.indicator_name}
                      </span>
                    </td>
                    <td>
                      <span className="process-pill">{item.process_name}</span>
                    </td>
                    {isEntityDailyIndicator && <td>{item.entity_name || "-"}</td>}
                    <td>{formatRecordValue(item)}</td>
                    <td>{formatGeneral(item.general, item.unit)}</td>
                    <td>
                      <span className={`daily-status ${item.status}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    {!isEntityDailyIndicator && (
                      <td>
                        <div className="daily-row-actions">
                          <button
                            type="button"
                            className="daily-table-btn edit"
                            onClick={() => handleEditFromResults(item)}
                          >
                            <Pencil size={15} />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="daily-table-btn delete"
                            onClick={() => handleDeleteFromResults(item)}
                          >
                            <Trash2 size={15} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {!visibleDailyResults.length && (
                  <tr>
                    <td colSpan={isEntityDailyIndicator ? "7" : "8"} className="daily-empty">
                      Sin registros para esa fecha
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="daily-table-footer">
            <span>
              Mostrando {visibleDailyResults.length} de {dailyResults.length} resultados
            </span>

            <div className="daily-pagination">
              <button type="button">‹</button>
              <button type="button" className="active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">›</button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}

const dailyCss = `
.daily-page {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  padding: clamp(26px, 3vw, 46px);
  color: #0f172a;
  background:
    radial-gradient(circle at 92% 6%, rgba(34,197,94,.09), transparent 30%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,251,255,.94));
}

.daily-bg-pattern {
  position: absolute;
  top: -185px;
  right: -120px;
  width: 670px;
  height: 670px;
  pointer-events: none;
  opacity: .52;
  background:
    radial-gradient(circle at 60% 42%, rgba(34,197,94,.12) 0 2px, transparent 3px),
    radial-gradient(circle at 74% 22%, rgba(34,197,94,.16) 0 3px, transparent 4px),
    radial-gradient(circle at 52% 72%, rgba(34,197,94,.10) 0 5px, transparent 6px),
    repeating-radial-gradient(circle at 78% 58%, transparent 0 46px, rgba(34,197,94,.13) 47px, transparent 48px);
  mask-image: radial-gradient(circle, black, transparent 72%);
}

.daily-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 26px;
  margin-bottom: clamp(24px, 2.5vw, 34px);
}

.daily-kicker {
  color: #059669;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.daily-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(36px, 3.4vw, 58px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: 950;
}

.daily-header p {
  margin: 14px 0 0;
  color: #64748b;
  font-size: clamp(15px, 1vw, 18px);
  line-height: 1.5;
}

.daily-header-kpis {
  min-width: min(760px, 52%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(226,232,240,.90);
  background: rgba(255,255,255,.86);
  box-shadow: 0 18px 42px rgba(15,23,42,.07);
}

.daily-mini-kpi {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.daily-mini-kpi svg {
  flex: 0 0 auto;
  color: #059669;
}

.daily-mini-kpi span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.daily-mini-kpi strong {
  display: block;
  margin-top: 5px;
  color: #059669;
  font-size: 25px;
  line-height: 1;
  font-weight: 950;
}

.daily-alert {
  position: relative;
  z-index: 1;
  margin-bottom: 18px;
  padding: 13px 16px;
  border-radius: 15px;
  color: #166534;
  background: rgba(34,197,94,.08);
  border: 1px solid rgba(34,197,94,.20);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
}

.daily-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(430px, 640px) minmax(0, 1fr);
  gap: clamp(20px, 2vw, 28px);
  align-items: stretch;
}

.daily-panel {
  border-radius: 22px;
  border: 1px solid rgba(226,232,240,.95);
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.88));
  box-shadow:
    0 20px 54px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92);
}

.form-panel {
  min-height: 650px;
  padding: 28px;
}

.results-panel {
  min-height: 650px;
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
}

.daily-panel-title {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 28px;
}

.daily-panel-title.compact {
  min-width: 310px;
  margin-bottom: 0;
}

.daily-panel-icon {
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: #059669;
  background:
    radial-gradient(circle at 30% 20%, rgba(34,197,94,.22), transparent 52%),
    rgba(34,197,94,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}

.daily-panel-title h3 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -.025em;
}

.daily-panel-title p {
  margin: 8px 0 0;
  color: #8190a6;
  font-size: 13px;
  line-height: 1.35;
}

.daily-form {
  display: grid;
  gap: 20px;
}

.daily-form-two,
.daily-form-three {
  display: grid;
  gap: 16px;
}

.daily-form-two {
  grid-template-columns: 1fr 1fr;
}

.daily-form-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.daily-field {
  display: grid;
  gap: 9px;
}

.daily-field label {
  color: #1f2937;
  font-size: 13px;
  font-weight: 850;
}

.daily-field input,
.daily-field select,
.daily-field textarea,
.entity-capture-table input,
.daily-search input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #0f172a;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.daily-field textarea {
  padding: 14px;
  resize: vertical;
}

.daily-field input::placeholder,
.daily-field textarea::placeholder,
.daily-search input::placeholder {
  color: #94a3b8;
}

.daily-field input:focus,
.daily-field select:focus,
.daily-field textarea:focus,
.entity-capture-table input:focus,
.daily-search:focus-within {
  border-color: rgba(34,197,94,.62);
  box-shadow: 0 0 0 4px rgba(34,197,94,.13);
  background: #fff;
}

.daily-field input:disabled,
.daily-field select:disabled {
  color: #8da0b8;
  background: #f1f5f9;
  cursor: not-allowed;
}

.daily-rule-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(34,197,94,.14);
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.10), transparent 34%),
    rgba(248,252,250,.82);
}

.daily-rule-item {
  min-height: 58px;
  padding: 12px;
  border-radius: 13px;
  border: 1px solid rgba(16,185,129,.18);
  background: rgba(16,185,129,.07);
}

.daily-rule-item.warning {
  border-color: rgba(245,158,11,.20);
  background: rgba(245,158,11,.07);
}

.daily-rule-item.critical {
  border-color: rgba(239,68,68,.18);
  background: rgba(239,68,68,.06);
}

.daily-rule-item span {
  display: block;
  margin-bottom: 6px;
  color: #047857;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.daily-rule-item.warning span,
.daily-rule-item.warning strong {
  color: #b45309;
}

.daily-rule-item.critical span,
.daily-rule-item.critical strong {
  color: #dc2626;
}

.daily-rule-item strong {
  color: #047857;
  font-size: 13px;
  font-weight: 950;
}

.entity-summary-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.entity-kpi {
  min-height: 70px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(16,185,129,.18);
  background: rgba(16,185,129,.07);
}

.entity-kpi.warning {
  border-color: rgba(245,158,11,.20);
  background: rgba(245,158,11,.07);
}

.entity-kpi.critical {
  border-color: rgba(239,68,68,.18);
  background: rgba(239,68,68,.06);
}

.entity-kpi span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
}

.entity-kpi strong {
  display: block;
  margin-top: 7px;
  color: #059669;
  font-size: 22px;
  line-height: 1;
  font-weight: 950;
}

.entity-kpi.warning strong { color: #b45309; }
.entity-kpi.critical strong { color: #dc2626; }

.entity-capture-table-wrap {
  max-height: 420px;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.entity-capture-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.entity-capture-table th,
.entity-capture-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #e5eaf1;
  font-size: 13px;
}

.entity-capture-table th {
  color: #059669;
  text-align: left;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .055em;
  text-transform: uppercase;
  background: rgba(248,250,252,.95);
  position: sticky;
  top: 0;
  z-index: 2;
}

.entity-capture-table input {
  min-height: 38px;
}

.daily-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.daily-primary,
.daily-secondary,
.daily-table-btn,
.daily-pagination button {
  border: 0;
  cursor: pointer;
  font-weight: 900;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}

.daily-primary:hover,
.daily-secondary:hover,
.daily-table-btn:hover,
.daily-pagination button:hover {
  transform: translateY(-1px);
}

.daily-primary {
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(135deg, #059669, #22c55e);
  box-shadow: 0 14px 30px rgba(34,197,94,.28);
}

.daily-primary:disabled,
.daily-secondary:disabled {
  opacity: .62;
  cursor: not-allowed;
  transform: none;
}

.daily-secondary {
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 22px;
  border-radius: 13px;
  color: #334155;
  border: 1px solid #dbe4ef;
  background: #fff;
}

.results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 26px;
}

.daily-search {
  width: min(320px, 40%);
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 15px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #64748b;
}

.daily-search input {
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.daily-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.daily-table-wrap::-webkit-scrollbar,
.entity-capture-table-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.daily-table-wrap::-webkit-scrollbar-track,
.entity-capture-table-wrap::-webkit-scrollbar-track {
  background: rgba(226,232,240,.45);
  border-radius: 999px;
}

.daily-table-wrap::-webkit-scrollbar-thumb,
.entity-capture-table-wrap::-webkit-scrollbar-thumb {
  background: rgba(34,197,94,.42);
  border-radius: 999px;
}

.daily-table {
  width: 100%;
  min-width: 940px;
  border-collapse: collapse;
}

.daily-table th {
  height: 58px;
  padding: 0 16px;
  text-align: left;
  color: #059669;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .055em;
  font-weight: 950;
  background: rgba(248,250,252,.95);
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 2;
}

.daily-table td {
  height: 72px;
  padding: 0 16px;
  color: #1f2937;
  font-size: 14px;
  border-bottom: 1px solid #e5eaf1;
  vertical-align: middle;
}

.daily-table tbody tr {
  transition: background .18s ease;
}

.daily-table tbody tr:hover {
  background: rgba(34,197,94,.035);
}

.daily-table tbody tr:last-child td {
  border-bottom: 0;
}

.daily-indicator-name {
  display: block;
  max-width: 280px;
  color: #1e293b;
  font-weight: 850;
  line-height: 1.35;
}

.process-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 9px;
  color: #047857;
  background: rgba(34,197,94,.12);
  font-size: 12px;
  font-weight: 950;
}

.daily-status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 950;
}

.daily-status.ok,
.daily-status.cumple {
  color: #047857;
  background: rgba(34,197,94,.12);
}

.daily-status.warning {
  color: #b45309;
  background: rgba(245,158,11,.12);
}

.daily-status.critical {
  color: #dc2626;
  background: rgba(239,68,68,.10);
}

.daily-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.daily-table-btn {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #fff;
  font-size: 12px;
}

.daily-table-btn.edit {
  color: #059669;
  border-color: rgba(5,150,105,.18);
}

.daily-table-btn.edit:hover {
  background: rgba(34,197,94,.08);
  box-shadow: 0 8px 18px rgba(34,197,94,.12);
}

.daily-table-btn.delete {
  color: #ef4444;
  border-color: rgba(239,68,68,.16);
}

.daily-table-btn.delete:hover {
  background: rgba(239,68,68,.06);
  box-shadow: 0 8px 18px rgba(239,68,68,.09);
}

.daily-empty {
  height: 140px !important;
  text-align: center;
  color: #94a3b8 !important;
  font-weight: 800;
}

.daily-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 2px 0;
  color: #8190a6;
  font-size: 13px;
}

.daily-pagination {
  display: flex;
  align-items: center;
  gap: 9px;
}

.daily-pagination button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid #dbe4ef;
  background: #fff;
  color: #64748b;
}

.daily-pagination button.active {
  color: #059669;
  border-color: rgba(34,197,94,.42);
  background: rgba(34,197,94,.08);
}

@media (max-width: 1440px) {
  .daily-grid {
    grid-template-columns: minmax(400px, 560px) minmax(0, 1fr);
  }

  .daily-header-kpis {
    min-width: min(680px, 52%);
  }
}

@media (max-width: 1180px) {
  .daily-page {
    padding: 24px;
  }

  .daily-header {
    flex-direction: column;
  }

  .daily-header-kpis {
    width: 100%;
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .daily-grid {
    grid-template-columns: 1fr;
  }

  .form-panel,
  .results-panel {
    min-height: auto;
  }

  .results-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .daily-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .daily-page {
    padding: 18px;
  }

  .daily-header h2 {
    font-size: 34px;
  }

  .daily-header-kpis,
  .daily-form-two,
  .daily-form-three,
  .daily-rule-preview,
  .entity-summary-row {
    grid-template-columns: 1fr;
  }

  .form-panel,
  .results-panel {
    padding: 20px;
    border-radius: 18px;
  }

  .daily-table-wrap {
    overflow-x: auto;
  }

  .daily-table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;
