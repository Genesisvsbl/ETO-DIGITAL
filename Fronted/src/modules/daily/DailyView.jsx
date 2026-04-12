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

function formatDateInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function buildStablePersonRowId(row, index) {
  if (row.__rowId) return row.__rowId;
  if (row.person_id) return `person-${row.person_id}`;
  return `row-${index}`;
}

function buildPersonCompliance(value, target) {
  const numericTarget = Number(target || 0);
  const numericValue =
    value === "" || value === null || value === undefined ? 0 : Number(value);

  let compliance = 0;

  if (numericTarget > 0) {
    compliance = Math.min((numericValue / numericTarget) * 100, 100);
  } else {
    compliance = 0;
  }

  let status = "critical";
  if (compliance >= 100) status = "ok";
  else if (compliance > 0) status = "warning";

  return {
    compliance,
    status,
  };
}

export default function DailyView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingDailyId, setEditingDailyId] = useState(null);

  const [dailyResults, setDailyResults] = useState([]);
  const [dailyPersonRows, setDailyPersonRows] = useState([]);

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

  const isPersonDailyIndicator = useMemo(() => {
    return selectedIndicator?.scope_type === "person";
  }, [selectedIndicator]);

  useEffect(() => {
    async function loadDailyPersonRows() {
      if (!isPersonDailyIndicator || !dailyForm.indicator_id || !dailyForm.record_date) {
        setDailyPersonRows([]);
        return;
      }

      try {
        const indicatorId = Number(dailyForm.indicator_id);

        const [grid, targets] = await Promise.all([
          API.getPersonCaptureGrid({
            indicator_id: indicatorId,
            record_date: dailyForm.record_date,
          }),
          API.getPersonTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (targets || []).map((item) => [
            Number(item.person_id),
            Number(item.target_value || 0),
          ])
        );

        const rows = (grid.rows || []).map((row) => {
          const personId = Number(row.person_id);
          const targetValue = Number(
            targetMap.get(personId) ??
              (row.target_value !== null && row.target_value !== undefined
                ? row.target_value
                : selectedIndicator?.target_value || 0)
          );

          const dayValue =
            row.day_value !== null && row.day_value !== undefined
              ? Number(row.day_value)
              : 0;

          const { compliance, status } = buildPersonCompliance(dayValue, targetValue);

          return {
            __rowId: `person-${personId}`,
            person_id: personId,
            person_code: row.person_code || "",
            person_name: row.person_name || "",
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

        setDailyPersonRows(rows);
      } catch (err) {
        setMessage(err.message);
      }
    }

    loadDailyPersonRows();
  }, [
    isPersonDailyIndicator,
    dailyForm.indicator_id,
    dailyForm.record_date,
    selectedIndicator,
  ]);

  const personDailySummary = useMemo(() => {
    if (!isPersonDailyIndicator) return null;

    const rows = dailyPersonRows || [];
    const totalPersons = rows.length;

    if (!totalPersons) {
      return {
        totalPersons: 0,
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

      const { compliance, status } = buildPersonCompliance(value, target);

      totalCompliance += compliance;

      if (status === "ok") okCount += 1;
      else if (status === "warning") warningCount += 1;
      else criticalCount += 1;
    });

    return {
      totalPersons,
      averageCompliance: totalCompliance / totalPersons,
      okCount,
      warningCount,
      criticalCount,
    };
  }, [dailyPersonRows, isPersonDailyIndicator]);

  function updateDailyPersonRow(index, field, value) {
    setDailyPersonRows((prev) =>
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
          nextRow.value === "" || nextRow.value === null || nextRow.value === undefined
            ? 0
            : Number(nextRow.value);

        const { compliance, status } = buildPersonCompliance(dayValue, target);

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
    setDailyPersonRows([]);
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

      if (selectedIndicator?.scope_type === "person") {
        const validRows = (dailyPersonRows || []).map((row) => ({
          person_id: Number(row.person_id),
          value:
            row.value === "" || row.value === null || row.value === undefined
              ? 0
              : Number(row.value),
          observation: row.observation || "",
        }));

        if (!validRows.length) {
          throw new Error("Este indicador no tiene personas asociadas.");
        }

        await API.savePersonGrid({
          indicator_id: Number(dailyForm.indicator_id),
          record_date: dailyForm.record_date,
          rows: validRows,
        });

        clearMessageSoon("Captura por persona guardada correctamente");
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

      if (selectedIndicator?.scope_type === "person" && dailyForm.indicator_id) {
        const indicatorId = Number(dailyForm.indicator_id);

        const [grid, targets] = await Promise.all([
          API.getPersonCaptureGrid({
            indicator_id: indicatorId,
            record_date: dailyForm.record_date,
          }),
          API.getPersonTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (targets || []).map((item) => [
            Number(item.person_id),
            Number(item.target_value || 0),
          ])
        );

        setDailyResults(
          (grid.rows || []).map((item) => {
            const personId = Number(item.person_id);
            const targetValue = Number(
              targetMap.get(personId) ??
                (item.target_value !== null && item.target_value !== undefined
                  ? item.target_value
                  : selectedIndicator?.target_value || 0)
            );

            const dayValue =
              item.day_value !== null && item.day_value !== undefined
                ? Number(item.day_value)
                : 0;

            const { compliance, status } = buildPersonCompliance(dayValue, targetValue);

            return {
              id: `${item.person_id}-${dailyForm.record_date}`,
              record_date: dailyForm.record_date,
              indicator_code: selectedIndicator.code,
              indicator_name: selectedIndicator.name,
              process_name: selectedIndicator.process_name,
              person_name: item.person_name,
              person_code: item.person_code,
              value: item.day_value,
              general: compliance,
              unit: "%",
              status,
              scope_type: "person",
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
    <section className="content-card">
      <div className="card-header-block">
        <div>
          <div className="section-kicker">OPERACIÓN</div>
          <h3>{editingDailyId ? "Editar captura diaria" : "Captura diaria"}</h3>
          <p>
            Registra por fecha y turno los resultados operativos por indicador.
          </p>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

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
                    setDailyPersonRows([]);
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

            <div className="field">
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
                  setDailyPersonRows([]);
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
              <div className="rule-preview compact">
                <div className="rule-item">
                  <span>Unidad</span>
                  <strong>{selectedIndicator.unit}</strong>
                </div>
                <div className="rule-item">
                  <span>Frecuencia</span>
                  <strong>{formatFrequencyLabel(selectedIndicator.frequency)}</strong>
                </div>
                <div className="rule-item">
                  <span>Captura</span>
                  <strong>
                    {selectedIndicator.scope_type === "person"
                      ? "Por persona"
                      : formatCaptureModeLabel(selectedIndicator.capture_mode)}
                  </strong>
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

            {isPersonDailyIndicator ? (
              <>
                {personDailySummary && (
                  <section className="stats-row summary-row">
                    <div className="kpi-card elevated">
                      <span>Personas</span>
                      <strong>{personDailySummary.totalPersons}</strong>
                    </div>
                    <div className="kpi-card elevated">
                      <span>Promedio cumplimiento</span>
                      <strong>
                        {formatPercent(personDailySummary.averageCompliance)}
                      </strong>
                    </div>
                    <div className="kpi-card elevated">
                      <span>OK</span>
                      <strong>{personDailySummary.okCount}</strong>
                    </div>
                    <div className="kpi-card elevated">
                      <span>Warning</span>
                      <strong>{personDailySummary.warningCount}</strong>
                    </div>
                    <div className="kpi-card elevated">
                      <span>Critical</span>
                      <strong>{personDailySummary.criticalCount}</strong>
                    </div>
                  </section>
                )}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Persona</th>
                        <th>Meta</th>
                        <th>Valor día</th>
                        <th>Cumplimiento</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPersonRows.map((row, index) => (
                        <tr key={buildStablePersonRowId(row, index)}>
                          <td>{row.person_code || "-"}</td>
                          <td>{row.person_name || "-"}</td>
                          <td>{formatPlainNumber(row.target_value || 0)}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.value}
                              onChange={(e) =>
                                updateDailyPersonRow(index, "value", e.target.value)
                              }
                              placeholder="Valor"
                            />
                          </td>
                          <td>
                            <span className={`status ${row.status || "critical"}`}>
                              {formatPercent(row.compliance || 0)}
                            </span>
                          </td>
                          <td>
                            <input
                              value={row.observation}
                              onChange={(e) =>
                                updateDailyPersonRow(index, "observation", e.target.value)
                              }
                              placeholder="Observación"
                            />
                          </td>
                        </tr>
                      ))}

                      {!dailyPersonRows.length && (
                        <tr>
                          <td colSpan="6" className="empty">
                            Este indicador no tiene personas asociadas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : selectedIndicator?.capture_mode === "single" ? (
              <div className="field">
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
              <div className="inline-form-grid three-cols">
                <div className="field">
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
                  />
                </div>

                <div className="field">
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
                  />
                </div>

                <div className="field">
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
                  />
                </div>
              </div>
            )}

            {!isPersonDailyIndicator && (
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
            )}

            <div className="actions">
              <button className="primary" disabled={loading}>
                {editingDailyId ? "Actualizar captura" : "Guardar captura"}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={handleSearchDaily}
                disabled={loading}
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
                  {isPersonDailyIndicator && <th>Persona</th>}
                  <th>Valor</th>
                  <th>General</th>
                  <th>Estado</th>
                  {!isPersonDailyIndicator && <th className="actions-col">Acciones</th>}
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
                    {isPersonDailyIndicator && <td>{item.person_name || "-"}</td>}
                    <td>{formatRecordValue(item)}</td>
                    <td>{formatGeneral(item.general, item.unit)}</td>
                    <td>
                      <span className={`status ${item.status}`}>{item.status}</span>
                    </td>
                    {!isPersonDailyIndicator && (
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="table-btn edit"
                            onClick={() => handleEditFromResults(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="table-btn delete"
                            onClick={() => handleDeleteFromResults(item)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {!dailyResults.length && (
                  <tr>
                    <td colSpan={isPersonDailyIndicator ? "7" : "8"} className="empty">
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
  );
}