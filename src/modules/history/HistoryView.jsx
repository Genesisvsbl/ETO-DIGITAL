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
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileDown,
  FileInput,
  Filter,
  Layers3,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud,
  UsersRound,
} from "lucide-react";

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

function statusLabel(status) {
  if (status === "ok") return "OK";
  if (status === "warning") return "Warning";
  if (status === "critical") return "Critical";
  return status || "-";
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
  const [historyQuickSearch, setHistoryQuickSearch] = useState("");

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

  const visibleHistoryResults = useMemo(() => {
    const query = String(historyQuickSearch || "").trim().toLowerCase();
    if (!query) return historyResults;

    return historyResults.filter((item) => {
      const values = [
        item.record_date,
        item.process_name,
        item.indicator_code,
        item.indicator_name,
        item.entity_type,
        item.entity_name,
        item.status,
        item.observation,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return values.includes(query);
    });
  }, [historyResults, historyQuickSearch]);

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
                general = value >= 0 ? 100 : 0;
              } else {
                general = Math.max(0, Math.min(100, (value / target) * 100));
              }
            } else {
              if (value <= target) {
                general = 100;
              } else if (target === 0) {
                general = 0;
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
                (selectedIndicator.critical_operator === ">" &&
                  general > criticalValue) ||
                (selectedIndicator.critical_operator === ">=" &&
                  general >= criticalValue) ||
                (selectedIndicator.critical_operator === "<" &&
                  general < criticalValue) ||
                (selectedIndicator.critical_operator === "<=" &&
                  general <= criticalValue) ||
                (selectedIndicator.critical_operator === "=" &&
                  general === criticalValue)
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
                (selectedIndicator.warning_operator === ">" &&
                  general > warningValue) ||
                (selectedIndicator.warning_operator === ">=" &&
                  general >= warningValue) ||
                (selectedIndicator.warning_operator === "<" &&
                  general < warningValue) ||
                (selectedIndicator.warning_operator === "<=" &&
                  general <= warningValue) ||
                (selectedIndicator.warning_operator === "=" &&
                  general === warningValue)
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
    <section className="history-page">
      <style>{historyCss}</style>

      <div className="history-bg-pattern" />

      <header className="history-header">
        <div>
          <div className="history-kicker">CONSULTA</div>
          <h2>Histórico y consolidado por proceso</h2>
          <p>
            Consulta detalle histórico, filtra por indicador y usa carga masiva por mes.
          </p>
        </div>

        {historySummary && (
          <div className="history-kpi-strip">
            <div className="history-mini-kpi">
              <ClipboardList size={24} />
              <div>
                <span>Registros</span>
                <strong>{historySummary.total_records}</strong>
              </div>
            </div>
            <div className="history-mini-kpi">
              <BarChart3 size={24} />
              <div>
                <span>Promedio general</span>
                <strong>{formatPercent(historySummary.average_general)}</strong>
              </div>
            </div>
            <div className="history-mini-kpi ok">
              <CheckCircle2 size={24} />
              <div>
                <span>OK</span>
                <strong>{historySummary.ok_count}</strong>
              </div>
            </div>
            <div className="history-mini-kpi warning">
              <AlertTriangle size={24} />
              <div>
                <span>Warning</span>
                <strong>{historySummary.warning_count}</strong>
              </div>
            </div>
            <div className="history-mini-kpi critical">
              <ShieldAlert size={24} />
              <div>
                <span>Critical</span>
                <strong>{historySummary.critical_count}</strong>
              </div>
            </div>
          </div>
        )}
      </header>

      {message && <div className="history-alert">{message}</div>}

      <form onSubmit={handleSearchHistory} className="history-filters-panel">
        <div className="filters-title-row">
          <div className="filters-title-icon">
            <Filter size={23} />
          </div>
          <div>
            <h3>Filtros de consulta</h3>
            <p>Selecciona período, proceso, indicador y entidad para consultar el histórico.</p>
          </div>
        </div>

        <div className="history-filters-grid">
          <div className="history-field">
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

          <div className="history-field">
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

          <div className="history-field">
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

          <div className="history-field">
            <label>Nivel</label>
            <input value={`Nivel ${accessLevel}`} disabled />
          </div>

          <div className="history-field">
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

          <div className="history-field indicator-field-wide">
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

          {isEntityHistoryIndicator && (
            <div className="history-field entity-filter-wide">
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
          )}
        </div>

        <div className="history-actions-bar">
          <button className="history-primary" disabled={loading}>
            <Search size={18} />
            Consultar histórico
          </button>

          <button
            type="button"
            className="history-secondary"
            onClick={handleLoadMonthMatrix}
            disabled={loading}
          >
            <UploadCloud size={18} />
            Cargar matriz
          </button>

          <button
            type="button"
            className="history-secondary"
            onClick={handleSaveMonthMatrix}
            disabled={loading}
          >
            <Save size={18} />
            Guardar matriz
          </button>

          <button
            type="button"
            className="history-secondary"
            onClick={handleLoadEntityMatrix}
            disabled={loading}
          >
            <UsersRound size={18} />
            Cargar por entidad
          </button>

          <button
            type="button"
            className="history-secondary"
            onClick={handleSaveEntityMatrix}
            disabled={loading}
          >
            <FileDown size={18} />
            Guardar por entidad
          </button>

          {monthMatrixMeta && (
            <button
              type="button"
              className="history-secondary danger-light"
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
              className="history-secondary danger-light"
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
        <section className="history-panel matrix-panel">
          <div className="history-panel-head">
            <div className="filters-title-row compact">
              <div className="filters-title-icon">
                <Database size={22} />
              </div>
              <div>
                <h3>
                  {getMassiveLoadTitle(monthMatrixMeta)} - {monthMatrixMeta.indicator_code}
                </h3>
                <p>{monthMatrixMeta.indicator_name}</p>
              </div>
            </div>
          </div>

          <HistoryRulePreview meta={monthMatrixMeta} />

          <div className="history-table-wrap compact-table">
            <table className="history-table">
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
                      className="history-empty"
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
        <section className="history-panel matrix-panel">
          <div className="history-panel-head">
            <div className="filters-title-row compact">
              <div className="filters-title-icon">
                <UsersRound size={22} />
              </div>
              <div>
                <h3>
                  Matriz por entidad - {entityMatrixMeta.indicator_code}
                </h3>
                <p>{entityMatrixMeta.indicator_name}</p>
              </div>
            </div>
          </div>

          <div className="rule-preview-grid">
            <InfoChip label="Proceso" value={entityMatrixMeta.process_name || "-"} />
            <InfoChip label="Unidad" value={entityMatrixMeta.unit || "-"} />
            <InfoChip label="Frecuencia" value={formatFrequencyLabel(entityMatrixMeta.frequency)} />
            <InfoChip label="Año" value={entityMatrixMeta.year} />
            <InfoChip label="Mes" value={entityMatrixMeta.month} />
            <InfoChip label="Entidades" value={entityMatrixMeta.targets.length} />
          </div>

          <div className="entity-matrix-toolbar">
            <div className="history-field entity-search-field">
              <label>Filtrar entidad</label>
              <input
                value={entityQuickFilter}
                onChange={(e) => setEntityQuickFilter(e.target.value)}
                placeholder="Buscar por nombre, código o tipo"
              />
            </div>
          </div>

          <div className="history-table-wrap compact-table">
            <table className="history-table">
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
                    <td colSpan="6" className="history-empty">
                      Sin filas para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="subtable-title">Acumulado por entidad</div>
          <div className="history-table-wrap compact-table short-table">
            <table className="history-table">
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
                    <td colSpan="5" className="history-empty">
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
        <section className="history-panel summary-process-panel">
          <div className="history-panel-head compact-head">
            <div className="filters-title-row compact">
              <div className="filters-title-icon">
                <Layers3 size={22} />
              </div>
              <div>
                <h3>Resumen por proceso</h3>
                <p>Consolidado del resultado según los filtros activos.</p>
              </div>
            </div>
          </div>

          <div className="history-table-wrap no-scroll-table">
            <table className="history-table summary-table">
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
                    <td>
                      <span className="process-pill">{item.process_name}</span>
                    </td>
                    <td>
                      <strong className="green-value">
                        {formatPercent(item.average_general)}
                      </strong>
                    </td>
                    <td>{item.total_records}</td>
                    <td>
                      <strong className="green-value">{item.ok_count}</strong>
                    </td>
                    <td>
                      <strong className="warning-value">{item.warning_count}</strong>
                    </td>
                    <td>
                      <strong className="critical-value">{item.critical_count}</strong>
                    </td>
                  </tr>
                ))}

                {!historySummary.processes.length && (
                  <tr>
                    <td colSpan="6" className="history-empty">
                      Sin resumen por proceso
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="history-panel detail-panel">
        <div className="history-panel-head detail-head">
          <div className="filters-title-row compact">
            <div className="filters-title-icon">
              <ClipboardList size={22} />
            </div>
            <div>
              <h3>Detalle histórico</h3>
              <p>Consulta el registro detallado de resultados capturados.</p>
            </div>
          </div>

          <div className="detail-actions">
            <div className="history-search-box">
              <Search size={18} />
              <input
                value={historyQuickSearch}
                onChange={(event) => setHistoryQuickSearch(event.target.value)}
                placeholder="Buscar en histórico..."
              />
            </div>
            <button type="button" className="history-export-btn">
              <Download size={18} />
              Exportar
            </button>
          </div>
        </div>

        <div className="history-table-wrap detail-table-wrap">
          <table className="history-table detail-table">
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
              {visibleHistoryResults.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.record_date}</strong>
                  </td>
                  <td>
                    <span className="process-pill">{item.process_name}</span>
                  </td>
                  <td>
                    <span className="indicator-name">
                      {item.indicator_code} - {item.indicator_name}
                    </span>
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
                    <strong className="general-value">
                      {item.scope_type === "entity"
                        ? formatPercent(item.general)
                        : formatGeneral(item.general, item.unit)}
                    </strong>
                  </td>
                  <td>
                    <span className={`history-status ${item.status}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <span className="observation-text">{item.observation || "-"}</span>
                  </td>
                  <td>
                    <div className="history-row-actions">
                      {item.scope_type !== "entity" ? (
                        <button
                          type="button"
                          className="history-table-btn delete"
                          onClick={() => handleDeleteHistory(item)}
                        >
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      ) : (
                        <span className="muted-text">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!visibleHistoryResults.length && (
                <tr>
                  <td
                    colSpan={isEntityHistoryIndicator ? "10" : "12"}
                    className="history-empty"
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="history-table-footer">
          <span>
            Mostrando {visibleHistoryResults.length} de {historyResults.length} registros
          </span>
          <div className="history-pagination">
            <button type="button">‹</button>
            <button type="button" className="active">1</button>
            <button type="button">2</button>
            <button type="button">3</button>
            <button type="button">›</button>
          </div>
        </footer>
      </section>
    </section>
  );
}

function InfoChip({ label, value }) {
  return (
    <div className="info-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryRulePreview({ meta }) {
  return (
    <div className="rule-preview-grid">
      <InfoChip label="Proceso" value={meta.process_name} />
      <InfoChip label="Unidad" value={meta.unit} />
      <InfoChip label="Frecuencia" value={formatFrequencyLabel(meta.frequency)} />
      <InfoChip label="Captura" value={formatCaptureModeLabel(meta.capture_mode)} />
      <InfoChip
        label="Meta"
        value={formatRule(meta.target_operator, meta.target_value, meta.unit)}
      />
      <InfoChip
        label="Turnos"
        value={
          meta.capture_mode === "single"
            ? "-"
            : normalizeShifts(meta.shifts).join(", ")
        }
      />
    </div>
  );
}

const historyCss = `
.history-page {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  padding: clamp(26px, 3vw, 46px);
  color: #0f172a;
  background:
    radial-gradient(circle at 92% 6%, rgba(34,197,94,.09), transparent 30%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,251,255,.94));
}

.history-bg-pattern {
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

.history-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 26px;
  margin-bottom: clamp(24px, 2.5vw, 34px);
}

.history-kicker {
  color: #059669;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.history-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: 950;
}

.history-header p {
  margin: 14px 0 0;
  color: #64748b;
  font-size: clamp(15px, 1vw, 18px);
  line-height: 1.5;
}

.history-kpi-strip {
  min-width: min(840px, 56%);
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.history-mini-kpi {
  min-height: 94px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(226,232,240,.88);
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.10), transparent 36%),
    rgba(255,255,255,.88);
  box-shadow: 0 16px 38px rgba(15,23,42,.07);
}

.history-mini-kpi svg {
  flex: 0 0 auto;
  color: #059669;
}

.history-mini-kpi.warning svg { color: #f59e0b; }
.history-mini-kpi.critical svg { color: #ef4444; }

.history-mini-kpi span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.history-mini-kpi strong {
  display: block;
  margin-top: 7px;
  color: #059669;
  font-size: 27px;
  line-height: 1;
  font-weight: 950;
}

.history-mini-kpi.warning strong { color: #f59e0b; }
.history-mini-kpi.critical strong { color: #ef4444; }

.history-alert {
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

.history-filters-panel,
.history-panel {
  position: relative;
  z-index: 1;
  border-radius: 22px;
  border: 1px solid rgba(226,232,240,.95);
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.88));
  box-shadow:
    0 20px 54px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92);
}

.history-filters-panel {
  padding: 26px;
  margin-bottom: 22px;
}

.filters-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.filters-title-row.compact {
  margin-bottom: 0;
}

.filters-title-icon {
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #059669;
  background:
    radial-gradient(circle at 30% 20%, rgba(34,197,94,.22), transparent 52%),
    rgba(34,197,94,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}

.filters-title-row h3,
.history-panel-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -.025em;
}

.filters-title-row p,
.history-panel-head p {
  margin: 8px 0 0;
  color: #8190a6;
  font-size: 13px;
  line-height: 1.35;
}

.history-filters-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.history-field {
  display: grid;
  gap: 8px;
}

.history-field label {
  color: #1f2937;
  font-size: 12px;
  font-weight: 900;
}

.history-field input,
.history-field select,
.history-search-box input,
.history-table input {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #0f172a;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.history-field input::placeholder,
.history-search-box input::placeholder,
.history-table input::placeholder {
  color: #94a3b8;
}

.history-field input:focus,
.history-field select:focus,
.history-search-box:focus-within,
.history-table input:focus {
  border-color: rgba(34,197,94,.62);
  box-shadow: 0 0 0 4px rgba(34,197,94,.13);
  background: #fff;
}

.history-field input:disabled,
.history-table input:disabled {
  color: #8da0b8;
  background: #f1f5f9;
  cursor: not-allowed;
}

.entity-filter-wide {
  grid-column: span 2;
}

.history-actions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 20px;
}

.history-primary,
.history-secondary,
.history-export-btn,
.history-table-btn,
.history-pagination button {
  border: 0;
  cursor: pointer;
  font-weight: 900;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}

.history-primary:hover,
.history-secondary:hover,
.history-export-btn:hover,
.history-table-btn:hover,
.history-pagination button:hover {
  transform: translateY(-1px);
}

.history-primary {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(135deg, #059669, #22c55e);
  box-shadow: 0 14px 30px rgba(34,197,94,.28);
}

.history-secondary {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-radius: 13px;
  color: #334155;
  border: 1px solid #dbe4ef;
  background: #fff;
}

.history-secondary.danger-light {
  color: #be123c;
  border-color: rgba(244,63,94,.18);
  background: rgba(244,63,94,.05);
}

.history-primary:disabled,
.history-secondary:disabled {
  opacity: .62;
  cursor: not-allowed;
  transform: none;
}

.matrix-panel,
.summary-process-panel,
.detail-panel {
  padding: 26px;
  margin-bottom: 22px;
}

.history-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 22px;
}

.compact-head {
  margin-bottom: 18px;
}

.rule-preview-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.info-chip {
  min-height: 62px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(16,185,129,.18);
  background: rgba(16,185,129,.07);
}

.info-chip span {
  display: block;
  margin-bottom: 6px;
  color: #047857;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.info-chip strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 950;
}

.entity-matrix-toolbar {
  margin-bottom: 16px;
}

.entity-search-field {
  max-width: 380px;
}

.subtable-title {
  margin: 22px 0 14px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 950;
}

.history-table-wrap {
  width: 100%;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.history-table-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.history-table-wrap::-webkit-scrollbar-track {
  background: rgba(226,232,240,.45);
  border-radius: 999px;
}

.history-table-wrap::-webkit-scrollbar-thumb {
  background: rgba(34,197,94,.42);
  border-radius: 999px;
}

.no-scroll-table {
  overflow: hidden;
}

.compact-table {
  max-height: 460px;
}

.short-table {
  max-height: 300px;
}

.detail-table-wrap {
  max-height: 560px;
}

.history-table {
  width: 100%;
  min-width: 1060px;
  border-collapse: collapse;
}

.summary-table {
  min-width: 760px;
}

.detail-table {
  min-width: 1280px;
}

.history-table th {
  height: 56px;
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

.history-table td {
  height: 58px;
  padding: 0 16px;
  color: #1f2937;
  font-size: 13px;
  border-bottom: 1px solid #e5eaf1;
  vertical-align: middle;
}

.history-table tbody tr {
  transition: background .18s ease;
}

.history-table tbody tr:hover {
  background: rgba(34,197,94,.035);
}

.history-table tbody tr:last-child td {
  border-bottom: 0;
}

.history-table input {
  min-height: 38px;
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

.indicator-name {
  display: block;
  max-width: 330px;
  color: #1e293b;
  font-weight: 800;
  line-height: 1.35;
}

.green-value,
.general-value {
  color: #059669;
  font-weight: 950;
}

.warning-value {
  color: #d97706;
  font-weight: 950;
}

.critical-value {
  color: #dc2626;
  font-weight: 950;
}

.history-status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
}

.history-status.ok {
  color: #047857;
  background: rgba(34,197,94,.12);
}

.history-status.warning {
  color: #b45309;
  background: rgba(245,158,11,.13);
}

.history-status.critical {
  color: #dc2626;
  background: rgba(239,68,68,.11);
}

.observation-text {
  display: block;
  max-width: 360px;
  line-height: 1.35;
}

.history-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-table-btn {
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

.history-table-btn.delete {
  color: #ef4444;
  border-color: rgba(239,68,68,.16);
}

.history-table-btn.delete:hover {
  background: rgba(239,68,68,.06);
  box-shadow: 0 8px 18px rgba(239,68,68,.09);
}

.history-empty {
  height: 140px !important;
  text-align: center;
  color: #94a3b8 !important;
  font-weight: 800;
}

.muted-text {
  color: #94a3b8;
  font-weight: 800;
}

.detail-head {
  align-items: center;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-search-box {
  width: min(330px, 42vw);
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

.history-search-box input {
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.history-export-btn {
  height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-radius: 12px;
  color: #059669;
  border: 1px solid rgba(34,197,94,.22);
  background: rgba(34,197,94,.06);
}

.history-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 2px 0;
  color: #8190a6;
  font-size: 13px;
}

.history-pagination {
  display: flex;
  align-items: center;
  gap: 9px;
}

.history-pagination button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid #dbe4ef;
  background: #fff;
  color: #64748b;
}

.history-pagination button.active {
  color: #059669;
  border-color: rgba(34,197,94,.42);
  background: rgba(34,197,94,.08);
}

@media (max-width: 1440px) {
  .history-kpi-strip {
    min-width: min(760px, 56%);
  }

  .history-filters-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .indicator-field-wide,
  .entity-filter-wide {
    grid-column: span 2;
  }
}

@media (max-width: 1180px) {
  .history-page {
    padding: 24px;
  }

  .history-header {
    flex-direction: column;
  }

  .history-kpi-strip {
    width: 100%;
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-panel-head,
  .detail-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-actions {
    width: 100%;
  }

  .history-search-box {
    width: 100%;
  }

  .rule-preview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .history-page {
    padding: 18px;
  }

  .history-header h2 {
    font-size: 32px;
  }

  .history-filters-panel,
  .history-panel {
    padding: 20px;
    border-radius: 18px;
  }

  .history-kpi-strip,
  .history-filters-grid,
  .rule-preview-grid {
    grid-template-columns: 1fr;
  }

  .indicator-field-wide,
  .entity-filter-wide {
    grid-column: auto;
  }

  .detail-actions,
  .history-actions-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .history-primary,
  .history-secondary,
  .history-export-btn {
    width: 100%;
    justify-content: center;
  }

  .history-table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;
