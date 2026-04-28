import { useMemo, useState } from "react";
import API from "../../api";
import {
  formatCaptureModeLabel,
  formatFrequencyLabel,
  formatGeneral,
  formatPlainNumber,
  formatPercent,
  formatRule,
} from "../../utils/formatters";
import { hasShift } from "../../utils/indicatorHelpers";

function getMassiveLoadTitle(meta) {
  const frequency = meta?.frequency;
  if (frequency === "day") return "Carga masiva diaria";
  if (frequency === "week") return "Carga masiva semanal";
  if (frequency === "month") return "Carga masiva mensual";
  return "Carga masiva";
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

function getStableRowId(row, index) {
  if (row.__rowId) return row.__rowId;
  if (row.entity_id && row.record_date) return `${row.entity_id}-${row.record_date}`;
  return `row-${index}`;
}

function isBlank(value) {
  return value === "" || value === null || value === undefined;
}

function toNullableNumber(value) {
  if (isBlank(value)) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toSafeText(value) {
  return String(value ?? "").trim();
}

function compareRule(currentValue, operator, ruleValue) {
  if (operator === ">") return currentValue > ruleValue;
  if (operator === ">=") return currentValue >= ruleValue;
  if (operator === "<") return currentValue < ruleValue;
  if (operator === "<=") return currentValue <= ruleValue;
  if (operator === "=") return currentValue === ruleValue;
  return false;
}

function buildEntityHistorySummary(records) {
  if (!records.length) {
    return {
      total_records: 0,
      average_general: 0,
      ok_count: 0,
      warning_count: 0,
      critical_count: 0,
      processes: [],
    };
  }

  const total_records = records.length;
  const average_general =
    records.reduce((acc, item) => acc + Number(item.general ?? 0), 0) /
    total_records;

  const ok_count = records.filter((x) => x.status === "ok").length;
  const warning_count = records.filter((x) => x.status === "warning").length;
  const critical_count = records.filter((x) => x.status === "critical").length;

  const processMap = {};

  records.forEach((item) => {
    const name = item.process_name || "-";

    if (!processMap[name]) {
      processMap[name] = {
        process_name: name,
        total_records: 0,
        average_general: 0,
        ok_count: 0,
        warning_count: 0,
        critical_count: 0,
        _sum: 0,
      };
    }

    processMap[name].total_records += 1;
    processMap[name]._sum += Number(item.general ?? 0);

    if (item.status === "ok") processMap[name].ok_count += 1;
    else if (item.status === "warning") processMap[name].warning_count += 1;
    else processMap[name].critical_count += 1;
  });

  const processes = Object.values(processMap)
    .map((item) => ({
      process_name: item.process_name,
      total_records: item.total_records,
      average_general: item.total_records
        ? item._sum / item.total_records
        : 0,
      ok_count: item.ok_count,
      warning_count: item.warning_count,
      critical_count: item.critical_count,
    }))
    .sort((a, b) => String(a.process_name).localeCompare(String(b.process_name)));

  return {
    total_records,
    average_general,
    ok_count,
    warning_count,
    critical_count,
    processes,
  };
}

export default function HistoryView({
  accessLevel,
  processes,
  indicators,
  entities = [],
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [historyResults, setHistoryResults] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);

  const [monthMatrixMeta, setMonthMatrixMeta] = useState(null);
  const [monthMatrixRows, setMonthMatrixRows] = useState([]);

  const [entityMatrixMeta, setEntityMatrixMeta] = useState(null);
  const [entityMatrixRows, setEntityMatrixRows] = useState([]);
  const [entityQuickFilter, setEntityQuickFilter] = useState("");

  const [historyFilter, setHistoryFilter] = useState({
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    process_id: "",
    indicator_id: "",
    entity_id: "",
  });

  const selectedHistoryIndicator = useMemo(() => {
    if (!historyFilter.indicator_id) return null;
    return indicators.find(
      (item) => String(item.id) === String(historyFilter.indicator_id)
    );
  }, [historyFilter.indicator_id, indicators]);

  const isEntityHistoryIndicator =
    selectedHistoryIndicator?.scope_type === "entity";

  function clearMessageSoon(text) {
    setMessage(text);
    window.clearTimeout(window.__etoHistoryMsgTimeout);
    window.__etoHistoryMsgTimeout = window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  const filteredIndicatorsForHistory = useMemo(() => {
    if (!historyFilter.process_id) return indicators;
    return indicators.filter(
      (item) => String(item.process_id) === String(historyFilter.process_id)
    );
  }, [historyFilter.process_id, indicators]);

  const filteredEntityMatrixRows = useMemo(() => {
    const query = String(entityQuickFilter || "").trim().toLowerCase();
    if (!query) return entityMatrixRows;

    return entityMatrixRows.filter((row) => {
      const name = String(row.entity_name || "").toLowerCase();
      const code = String(row.entity_code || "").toLowerCase();
      const type = String(row.entity_type || "").toLowerCase();
      return name.includes(query) || code.includes(query) || type.includes(query);
    });
  }, [entityMatrixRows, entityQuickFilter]);

  async function runHistorySearch(customFilters = null) {
    try {
      setLoading(true);

      const filters = {
        ...(customFilters || historyFilter),
        level: Number(accessLevel),
      };

      const selectedIndicator = filters.indicator_id
        ? indicators.find(
            (item) => String(item.id) === String(filters.indicator_id)
          )
        : null;

      if (selectedIndicator?.scope_type === "entity") {
        const indicatorId = Number(filters.indicator_id);

        const [entityRecords, entityTargets] = await Promise.all([
          API.getEntityRecords({
            indicator_id: indicatorId,
            entity_id: filters.entity_id ? Number(filters.entity_id) : undefined,
            year: filters.year ? Number(filters.year) : undefined,
            month: filters.month ? Number(filters.month) : undefined,
          }),
          API.getEntityTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (entityTargets || []).map((targetItem) => [
            Number(targetItem.entity_id),
            Number(targetItem.target_value ?? 0),
          ])
        );

        const mapped = (entityRecords || [])
          .filter((item) => {
            if (filters.day) {
              return (
                Number(String(item.record_date).slice(8, 10)) ===
                Number(filters.day)
              );
            }
            return true;
          })
          .map((item) => {
            const entityId = Number(item.entity_id);
            const target = Number(targetMap.get(entityId) ?? 0);
            const value = Number(item.value ?? 0);

            let general = 0;

            if (selectedIndicator.target_operator === "=") {
              if (target === 0) {
                general = value === 0 ? 100 : 0;
              } else {
                const diffRatio = Math.abs(value - target) / Math.abs(target);
                general = Math.max(0, Math.min(100, 100 - diffRatio * 100));
              }
            } else if (
              selectedIndicator.target_operator === ">" ||
              selectedIndicator.target_operator === ">="
            ) {
              if (target === 0) {
                general = compareRule(value, selectedIndicator.target_operator, target)
                  ? 100
                  : 0;
              } else {
                general = Math.max(0, Math.min(100, (value / target) * 100));
              }
            } else {
              if (compareRule(value, selectedIndicator.target_operator, target)) {
                general = 100;
              } else if (target === 0) {
                general = 0;
              } else if (value === 0) {
                general = 100;
              } else {
                general = Math.max(0, Math.min(100, (target / value) * 100));
              }
            }

            let status = "ok";

            if (
              selectedIndicator.critical_operator &&
              selectedIndicator.critical_value !== null &&
              selectedIndicator.critical_value !== undefined
            ) {
              const criticalValue = Number(selectedIndicator.critical_value);

              if (
                compareRule(
                  value,
                  selectedIndicator.critical_operator,
                  criticalValue
                )
              ) {
                status = "critical";
              }
            }

            if (
              status === "ok" &&
              selectedIndicator.warning_operator &&
              selectedIndicator.warning_value !== null &&
              selectedIndicator.warning_value !== undefined
            ) {
              const warningValue = Number(selectedIndicator.warning_value);

              if (
                compareRule(
                  value,
                  selectedIndicator.warning_operator,
                  warningValue
                )
              ) {
                status = "warning";
              }
            }

            return {
              id: `${item.entity_id}-${item.record_date}`,
              indicator_id: Number(item.indicator_id),
              indicator_code: item.indicator_code,
              indicator_name: item.indicator_name,
              process_id: Number(selectedIndicator.process_id),
              process_name: selectedIndicator.process_name,
              meeting_level: selectedIndicator.meeting_level,
              entity_id: entityId,
              entity_code: item.entity_code,
              entity_name: item.entity_name,
              entity_type: item.entity_type || "",
              record_date: item.record_date,
              value,
              general,
              status,
              observation: item.observation || "",
              unit: selectedIndicator.unit || "%",
              frequency: selectedIndicator.frequency,
              capture_mode: "single",
              shifts: "",
              scope_type: "entity",
              target_value: target,
            };
          });

        setHistoryResults(mapped);
        setHistorySummary(buildEntityHistorySummary(mapped));
        return;
      }

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

  async function handleDeleteHistory(item) {
    if (item.scope_type === "entity") {
      setMessage(
        "La eliminación del histórico por entidad no está habilitada desde esta vista."
      );
      return;
    }

    const ok = window.confirm(
      `¿Deseas eliminar el registro del indicador "${item.indicator_code} - ${item.indicator_name}" del día ${item.record_date}?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await API.deleteDailyRecord(item.id);
      clearMessageSoon("Registro eliminado correctamente");
      await runHistorySearch();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMonthMatrix() {
    try {
      if (
        !historyFilter.year ||
        !historyFilter.month ||
        !historyFilter.indicator_id
      ) {
        setMessage("Debes seleccionar año, mes e indicador para carga masiva.");
        return;
      }

      const selected = indicators.find(
        (item) => String(item.id) === String(historyFilter.indicator_id)
      );

      if (selected?.scope_type === "entity") {
        setMessage(
          "Para indicadores por entidad usa 'Cargar por entidad', no 'Cargar matriz'."
        );
        return;
      }

      setLoading(true);

      const data = await API.getMonthMatrix({
        year: Number(historyFilter.year),
        month: Number(historyFilter.month),
        indicator_id: Number(historyFilter.indicator_id),
      });

      setMonthMatrixMeta({
        ...data,
        shifts: normalizeShifts(data.shifts),
      });

      setMonthMatrixRows(
        (data.rows || []).map((row, index) => ({
          ...row,
          __rowId: `month-${index}-${row.record_date}`,
          record_date: String(row.record_date).slice(0, 10),
          single_value:
            row.single_value === null || row.single_value === undefined
              ? ""
              : String(row.single_value),
          shift_a:
            row.shift_a === null || row.shift_a === undefined
              ? ""
              : String(row.shift_a),
          shift_b:
            row.shift_b === null || row.shift_b === undefined
              ? ""
              : String(row.shift_b),
          shift_c:
            row.shift_c === null || row.shift_c === undefined
              ? ""
              : String(row.shift_c),
          observation: row.observation || "",
        }))
      );

      clearMessageSoon("Matriz cargada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMonthMatrix() {
    try {
      if (!historyFilter.indicator_id || !monthMatrixRows.length) {
        setMessage("No hay matriz cargada para guardar.");
        return;
      }

      setLoading(true);

      await API.saveMonthMatrix({
        indicator_id: Number(historyFilter.indicator_id),
        rows: monthMatrixRows.map((row) => ({
          record_date: row.record_date,
          single_value: toNullableNumber(row.single_value),
          shift_a: toNullableNumber(row.shift_a),
          shift_b: toNullableNumber(row.shift_b),
          shift_c: toNullableNumber(row.shift_c),
          observation: toSafeText(row.observation),
        })),
      });

      clearMessageSoon("Carga masiva guardada correctamente");
      setMonthMatrixMeta(null);
      setMonthMatrixRows([]);
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

  async function handleLoadEntityMatrix() {
    try {
      if (
        !historyFilter.year ||
        !historyFilter.month ||
        !historyFilter.indicator_id
      ) {
        setMessage(
          "Debes seleccionar año, mes e indicador para carga por entidad."
        );
        return;
      }

      const selected = indicators.find(
        (item) => String(item.id) === String(historyFilter.indicator_id)
      );

      if (!selected) {
        setMessage("Indicador no encontrado.");
        return;
      }

      if (selected.scope_type !== "entity") {
        setMessage("El indicador seleccionado no es de tipo entidad.");
        return;
      }

      setLoading(true);

      const indicatorId = Number(historyFilter.indicator_id);
      const year = Number(historyFilter.year);
      const month = Number(historyFilter.month);

      const [targets, records] = await Promise.all([
        API.getEntityTargets({
          indicator_id: indicatorId,
          active_only: true,
        }),
        API.getEntityRecords({
          indicator_id: indicatorId,
          year,
          month,
        }),
      ]);

      const recordMap = new Map();
      for (const row of records || []) {
        const key = `${row.entity_id}-${String(row.record_date).slice(0, 10)}`;
        recordMap.set(key, row);
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      const generatedRows = [];

      for (const target of targets || []) {
        for (let day = 1; day <= daysInMonth; day += 1) {
          const recordDate = `${year}-${String(month).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          const key = `${target.entity_id}-${recordDate}`;
          const existing = recordMap.get(key);

          generatedRows.push({
            __rowId: `entity-${target.entity_id}-${recordDate}`,
            entity_id: Number(target.entity_id),
            entity_code: target.entity_code || "",
            entity_name: target.entity_name || "",
            entity_type: target.entity_type || "",
            target_value: Number(target.target_value ?? 0),
            record_date: recordDate,
            day,
            value:
              existing && existing.value !== null && existing.value !== undefined
                ? String(existing.value)
                : "",
            observation: existing?.observation || "",
          });
        }
      }

      setEntityMatrixMeta({
        indicator_id: indicatorId,
        indicator_code: selected.code,
        indicator_name: selected.name,
        process_name: selected.process_name,
        unit: selected.unit,
        frequency: selected.frequency,
        year,
        month,
        targets: targets || [],
      });

      setEntityMatrixRows(generatedRows);
      clearMessageSoon("Matriz por entidad cargada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEntityMatrix() {
    try {
      if (!historyFilter.indicator_id) {
        setMessage("Debes seleccionar un indicador.");
        return;
      }

      if (!entityMatrixMeta) {
        setMessage("Primero debes cargar la matriz por entidad.");
        return;
      }

      setLoading(true);

      const indicatorId = Number(historyFilter.indicator_id);
      const groupedByDate = {};

      for (const row of entityMatrixRows) {
        const recordDate = String(row.record_date || "").slice(0, 10);
        const entityId = Number(row.entity_id);
        const numericValue = toNullableNumber(row.value);
        const observation = toSafeText(row.observation);

        if (!recordDate || !entityId) continue;

        const hasExplicitValue = !isBlank(row.value);
        const hasObservation = !!observation;

        if (!hasExplicitValue && !hasObservation) {
          continue;
        }

        if (!groupedByDate[recordDate]) {
          groupedByDate[recordDate] = [];
        }

        groupedByDate[recordDate].push({
          entity_id: entityId,
          value: numericValue,
          observation,
        });
      }

      const dates = Object.keys(groupedByDate);

      if (!dates.length) {
        setMessage("No hay filas válidas para guardar.");
        return;
      }

      await Promise.all(
        dates.map((record_date) =>
          API.saveEntityGrid({
            indicator_id: indicatorId,
            record_date,
            rows: groupedByDate[record_date],
          })
        )
      );

      clearMessageSoon("Carga por entidad guardada correctamente");
      await handleLoadEntityMatrix();
      await runHistorySearch();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateEntityMatrix(index, field, value) {
    setEntityMatrixRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const entityMatrixAccumulated = useMemo(() => {
    const grouped = entityMatrixRows.reduce((acc, row) => {
      const entityId = Number(row.entity_id);
      const entityName = String(row.entity_name || "").trim();
      if (!entityId || !entityName) return acc;

      const numericValue = toNullableNumber(row.value) ?? 0;

      if (!acc[entityId]) {
        acc[entityId] = {
          entity_id: entityId,
          entity: entityName,
          entity_type: row.entity_type || "",
          accumulated: 0,
          records: 0,
          target_value: Number(row.target_value ?? 0),
        };
      }

      acc[entityId].accumulated += numericValue;
      acc[entityId].records += 1;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) =>
      String(a.entity).localeCompare(String(b.entity))
    );
  }, [entityMatrixRows]);

  return (
    <section className="content-card">
      <div className="card-header-block">
        <div>
          <div className="section-kicker">CONSULTA</div>
          <h3>Histórico y consolidado por proceso</h3>
          <p>
            Consulta detalle histórico, filtra por indicador y usa carga masiva
            por mes.
          </p>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

      <form onSubmit={handleSearchHistory} className="filters-card">
        <div
          className="inline-form-grid"
          style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
        >
          <div className="field">
            <label>Año</label>
            <input
              type="number"
              value={historyFilter.year}
              onChange={(e) =>
                setHistoryFilter({
                  ...historyFilter,
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
                  entity_id: "",
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
                  entity_id: "",
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

        {isEntityHistoryIndicator && (
          <div
            className="inline-form-grid"
            style={{
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 4fr)",
              marginTop: 14,
            }}
          >
            <div className="field">
              <label>Entidad</label>
              <select
                value={historyFilter.entity_id}
                onChange={(e) =>
                  setHistoryFilter({
                    ...historyFilter,
                    entity_id: e.target.value,
                  })
                }
              >
                <option value="">Todas</option>
                {entities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.code ? `(${item.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="actions top-space">
          <button className="primary" disabled={loading}>
            Consultar histórico
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleLoadMonthMatrix}
            disabled={loading}
          >
            Cargar matriz
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleSaveMonthMatrix}
            disabled={loading}
          >
            Guardar matriz
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleLoadEntityMatrix}
            disabled={loading}
          >
            Cargar por entidad
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleSaveEntityMatrix}
            disabled={loading}
          >
            Guardar por entidad
          </button>

          {monthMatrixMeta && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setMonthMatrixMeta(null);
                setMonthMatrixRows([]);
              }}
            >
              Cerrar carga
            </button>
          )}

          {entityMatrixMeta && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEntityMatrixMeta(null);
                setEntityMatrixRows([]);
                setEntityQuickFilter("");
              }}
            >
              Cerrar entidades
            </button>
          )}
        </div>
      </form>

      {monthMatrixMeta && (
        <section className="panel-block">
          <div className="subsection-title">
            {getMassiveLoadTitle(monthMatrixMeta)} - {monthMatrixMeta.indicator_code} -{" "}
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
              <span>Frecuencia</span>
              <strong>{formatFrequencyLabel(monthMatrixMeta.frequency)}</strong>
            </div>
            <div className="rule-item">
              <span>Captura</span>
              <strong>{formatCaptureModeLabel(monthMatrixMeta.capture_mode)}</strong>
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
              <strong>
                {monthMatrixMeta.capture_mode === "single"
                  ? "-"
                  : normalizeShifts(monthMatrixMeta.shifts).join(", ")}
              </strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  {monthMatrixMeta.capture_mode === "single" ? (
                    <th>Valor único</th>
                  ) : (
                    <>
                      <th>Turno A</th>
                      <th>Turno B</th>
                      <th>Turno C</th>
                    </>
                  )}
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {monthMatrixRows.map((row, index) => (
                  <tr key={row.__rowId || row.record_date}>
                    <td>{row.record_date}</td>

                    {monthMatrixMeta.capture_mode === "single" ? (
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={row.single_value ?? ""}
                          onChange={(e) =>
                            updateMonthMatrixRow(index, "single_value", e.target.value)
                          }
                        />
                      </td>
                    ) : (
                      <>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={row.shift_a ?? ""}
                            onChange={(e) =>
                              updateMonthMatrixRow(index, "shift_a", e.target.value)
                            }
                            disabled={!hasShift(monthMatrixMeta.shifts, "A")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={row.shift_b ?? ""}
                            onChange={(e) =>
                              updateMonthMatrixRow(index, "shift_b", e.target.value)
                            }
                            disabled={!hasShift(monthMatrixMeta.shifts, "B")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={row.shift_c ?? ""}
                            onChange={(e) =>
                              updateMonthMatrixRow(index, "shift_c", e.target.value)
                            }
                            disabled={!hasShift(monthMatrixMeta.shifts, "C")}
                          />
                        </td>
                      </>
                    )}

                    <td>
                      <input
                        value={row.observation ?? ""}
                        onChange={(e) =>
                          updateMonthMatrixRow(index, "observation", e.target.value)
                        }
                        placeholder="Observación"
                      />
                    </td>
                  </tr>
                ))}

                {!monthMatrixRows.length && (
                  <tr>
                    <td
                      colSpan={monthMatrixMeta.capture_mode === "single" ? 3 : 5}
                      className="empty"
                    >
                      Sin filas para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {entityMatrixMeta && (
        <section className="panel-block">
          <div className="subsection-title">
            Matriz por entidad - {entityMatrixMeta.indicator_code} -{" "}
            {entityMatrixMeta.indicator_name}
          </div>

          <div className="rule-preview compact" style={{ marginBottom: 14 }}>
            <div className="rule-item">
              <span>Proceso</span>
              <strong>{entityMatrixMeta.process_name || "-"}</strong>
            </div>
            <div className="rule-item">
              <span>Unidad</span>
              <strong>{entityMatrixMeta.unit || "-"}</strong>
            </div>
            <div className="rule-item">
              <span>Frecuencia</span>
              <strong>{formatFrequencyLabel(entityMatrixMeta.frequency)}</strong>
            </div>
            <div className="rule-item">
              <span>Año</span>
              <strong>{entityMatrixMeta.year}</strong>
            </div>
            <div className="rule-item">
              <span>Mes</span>
              <strong>{entityMatrixMeta.month}</strong>
            </div>
            <div className="rule-item">
              <span>Entidades</span>
              <strong>{entityMatrixMeta.targets.length}</strong>
            </div>
          </div>

          <div
            className="inline-form-grid"
            style={{
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 5fr)",
              marginBottom: 14,
            }}
          >
            <div className="field">
              <label>Filtrar entidad</label>
              <input
                value={entityQuickFilter}
                onChange={(e) => setEntityQuickFilter(e.target.value)}
                placeholder="Buscar por nombre, código o tipo"
              />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Entidad</th>
                  <th>Día</th>
                  <th>Meta</th>
                  <th>Valor</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntityMatrixRows.map((row, index) => (
                  <tr key={getStableRowId(row, index)}>
                    <td>
                      <input value={row.entity_type || "-"} disabled />
                    </td>
                    <td>
                      <input value={row.entity_name ?? ""} disabled />
                    </td>
                    <td>
                      <input value={row.day ?? ""} disabled />
                    </td>
                    <td>
                      <input value={row.target_value ?? 0} disabled />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.value ?? ""}
                        onChange={(e) =>
                          updateEntityMatrix(
                            entityMatrixRows.findIndex(
                              (item) => item.__rowId === row.__rowId
                            ),
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Valor"
                      />
                    </td>
                    <td>
                      <input
                        value={row.observation ?? ""}
                        onChange={(e) =>
                          updateEntityMatrix(
                            entityMatrixRows.findIndex(
                              (item) => item.__rowId === row.__rowId
                            ),
                            "observation",
                            e.target.value
                          )
                        }
                        placeholder="Observación"
                      />
                    </td>
                  </tr>
                ))}

                {!filteredEntityMatrixRows.length && (
                  <tr>
                    <td colSpan="6" className="empty">
                      Sin filas para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ height: 18 }} />

          <div className="subsection-title">Acumulado por entidad</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Entidad</th>
                  <th>Registros</th>
                  <th>Meta</th>
                  <th>Acumulado del mes</th>
                </tr>
              </thead>
              <tbody>
                {entityMatrixAccumulated.map((item) => (
                  <tr key={item.entity_id}>
                    <td>{item.entity_type || "-"}</td>
                    <td>{item.entity}</td>
                    <td>{item.records}</td>
                    <td>{formatPlainNumber(item.target_value ?? 0)}</td>
                    <td>{formatPlainNumber(item.accumulated)}</td>
                  </tr>
                ))}

                {!entityMatrixAccumulated.length && (
                  <tr>
                    <td colSpan="5" className="empty">
                      Aún no hay acumulados por entidad
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
              <strong>{formatPercent(historySummary.average_general)}</strong>
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
                {isEntityHistoryIndicator && <th>Tipo</th>}
                {isEntityHistoryIndicator && <th>Entidad</th>}
                <th>Valor</th>
                {!isEntityHistoryIndicator && <th>A</th>}
                {!isEntityHistoryIndicator && <th>B</th>}
                {!isEntityHistoryIndicator && <th>C</th>}
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
                  {isEntityHistoryIndicator && <td>{item.entity_type || "-"}</td>}
                  {isEntityHistoryIndicator && <td>{item.entity_name || "-"}</td>}
                  <td>
                    {item.scope_type === "entity"
                      ? formatPlainNumber(item.value ?? 0)
                      : item.capture_mode === "single"
                      ? item.single_value ?? 0
                      : "-"}
                  </td>
                  {!isEntityHistoryIndicator && (
                    <td>{hasShift(item.shifts, "A") ? item.shift_a ?? 0 : "-"}</td>
                  )}
                  {!isEntityHistoryIndicator && (
                    <td>{hasShift(item.shifts, "B") ? item.shift_b ?? 0 : "-"}</td>
                  )}
                  {!isEntityHistoryIndicator && (
                    <td>{hasShift(item.shifts, "C") ? item.shift_c ?? 0 : "-"}</td>
                  )}
                  <td>
                    {item.scope_type === "entity"
                      ? formatPercent(item.general)
                      : formatGeneral(item.general, item.unit)}
                  </td>
                  <td>
                    <span className={`status ${item.status}`}>{item.status}</span>
                  </td>
                  <td>{item.observation || "-"}</td>
                  <td>
                    <div className="row-actions">
                      {item.scope_type !== "entity" ? (
                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteHistory(item)}
                        >
                          Eliminar
                        </button>
                      ) : (
                        <span className="muted-text">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!historyResults.length && (
                <tr>
                  <td
                    colSpan={isEntityHistoryIndicator ? "10" : "12"}
                    className="empty"
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}