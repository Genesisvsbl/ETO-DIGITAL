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
  if (row.person_id && row.record_date) return `${row.person_id}-${row.record_date}`;
  return `row-${index}`;
}

function buildPersonHistorySummary(records) {
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
    records.reduce((acc, item) => acc + Number(item.general || 0), 0) /
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
    processMap[name]._sum += Number(item.general || 0);

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

export default function HistoryView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [historyResults, setHistoryResults] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);

  const [monthMatrixMeta, setMonthMatrixMeta] = useState(null);
  const [monthMatrixRows, setMonthMatrixRows] = useState([]);

  const [personMatrixMeta, setPersonMatrixMeta] = useState(null);
  const [personMatrixRows, setPersonMatrixRows] = useState([]);

  const [historyFilter, setHistoryFilter] = useState({
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    process_id: "",
    indicator_id: "",
  });

  const selectedHistoryIndicator = useMemo(() => {
    if (!historyFilter.indicator_id) return null;
    return indicators.find(
      (item) => String(item.id) === String(historyFilter.indicator_id)
    );
  }, [historyFilter.indicator_id, indicators]);

  const isPersonHistoryIndicator = selectedHistoryIndicator?.scope_type === "person";

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

  async function runHistorySearch(customFilters = null) {
    try {
      setLoading(true);
      const filters = {
        ...(customFilters || historyFilter),
        level: Number(accessLevel),
      };

      const selectedIndicator = filters.indicator_id
        ? indicators.find((item) => String(item.id) === String(filters.indicator_id))
        : null;

      if (selectedIndicator?.scope_type === "person") {
        const indicatorId = Number(filters.indicator_id);

        const [personRecords, personTargets] = await Promise.all([
          API.getPersonRecords({
            indicator_id: indicatorId,
            year: filters.year ? Number(filters.year) : undefined,
            month: filters.month ? Number(filters.month) : undefined,
          }),
          API.getPersonTargets({
            indicator_id: indicatorId,
            active_only: true,
          }),
        ]);

        const targetMap = new Map(
          (personTargets || []).map((targetItem) => [
            Number(targetItem.person_id),
            Number(targetItem.target_value || 0),
          ])
        );

        const mapped = (personRecords || [])
          .filter((item) => {
            if (filters.day) {
              return (
                Number(String(item.record_date).slice(8, 10)) === Number(filters.day)
              );
            }
            return true;
          })
          .map((item) => {
            const personId = Number(item.person_id);
            const target = Number(targetMap.get(personId) || 0);
            const value = Number(item.value || 0);

            let general = 0;

            if (target > 0) {
              general = Math.min((value / target) * 100, 100);
            } else {
              general = 0;
            }

            let status = "critical";
            if (general >= 100) status = "ok";
            else if (general > 0) status = "warning";

            return {
              id: `${item.person_id}-${item.record_date}`,
              indicator_id: Number(item.indicator_id),
              indicator_code: item.indicator_code,
              indicator_name: item.indicator_name,
              process_id: Number(selectedIndicator.process_id),
              process_name: selectedIndicator.process_name,
              meeting_level: selectedIndicator.meeting_level,
              person_id: personId,
              person_code: item.person_code,
              person_name: item.person_name,
              record_date: item.record_date,
              value,
              general,
              status,
              observation: item.observation || "",
              unit: "%",
              frequency: selectedIndicator.frequency,
              capture_mode: "single",
              shifts: "",
              scope_type: "person",
              target_value: target,
            };
          });

        setHistoryResults(mapped);
        setHistorySummary(buildPersonHistorySummary(mapped));
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
    if (item.scope_type === "person") {
      setMessage(
        "La eliminación de histórico por persona no está habilitada desde esta vista."
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

      if (selected?.scope_type === "person") {
        setMessage(
          "Para indicadores por persona usa 'Cargar por persona', no 'Cargar matriz'."
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
          single_value: row.single_value ?? "",
          shift_a: row.shift_a ?? "",
          shift_b: row.shift_b ?? "",
          shift_c: row.shift_c ?? "",
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
          single_value: row.single_value === "" ? null : Number(row.single_value),
          shift_a: row.shift_a === "" ? null : Number(row.shift_a),
          shift_b: row.shift_b === "" ? null : Number(row.shift_b),
          shift_c: row.shift_c === "" ? null : Number(row.shift_c),
          observation: row.observation || "",
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

  async function handleLoadPersonMatrix() {
    try {
      if (
        !historyFilter.year ||
        !historyFilter.month ||
        !historyFilter.indicator_id
      ) {
        setMessage(
          "Debes seleccionar año, mes e indicador para carga por persona."
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

      if (selected.scope_type !== "person") {
        setMessage("El indicador seleccionado no es de tipo persona.");
        return;
      }

      setLoading(true);

      const indicatorId = Number(historyFilter.indicator_id);
      const year = Number(historyFilter.year);
      const month = Number(historyFilter.month);

      const [targets, records] = await Promise.all([
        API.getPersonTargets({
          indicator_id: indicatorId,
          active_only: true,
        }),
        API.getPersonRecords({
          indicator_id: indicatorId,
          year,
          month,
        }),
      ]);

      const recordMap = new Map();
      for (const row of records || []) {
        const key = `${row.person_id}-${String(row.record_date).slice(0, 10)}`;
        recordMap.set(key, row);
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      const generatedRows = [];

      for (const target of targets || []) {
        for (let day = 1; day <= daysInMonth; day += 1) {
          const recordDate = `${year}-${String(month).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          const key = `${target.person_id}-${recordDate}`;
          const existing = recordMap.get(key);

          generatedRows.push({
            __rowId: `person-${target.person_id}-${recordDate}`,
            person_id: Number(target.person_id),
            person_code: target.person_code || "",
            person_name: target.person_name || "",
            target_value: Number(target.target_value || 0),
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

      setPersonMatrixMeta({
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

      setPersonMatrixRows(generatedRows);
      clearMessageSoon("Matriz por persona cargada correctamente");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePersonMatrix() {
    try {
      if (!historyFilter.indicator_id) {
        setMessage("Debes seleccionar un indicador.");
        return;
      }

      if (!personMatrixMeta) {
        setMessage("Primero debes cargar la matriz por persona.");
        return;
      }

      setLoading(true);

      const indicatorId = Number(historyFilter.indicator_id);
      const groupedByDate = {};

      for (const row of personMatrixRows) {
        const recordDate = String(row.record_date || "").slice(0, 10);
        const personId = Number(row.person_id);

        if (!recordDate || !personId) continue;

        if (!groupedByDate[recordDate]) {
          groupedByDate[recordDate] = [];
        }

        groupedByDate[recordDate].push({
          person_id: personId,
          value:
            row.value === "" || row.value === null || row.value === undefined
              ? 0
              : Number(row.value),
          observation: row.observation || "",
        });
      }

      const dates = Object.keys(groupedByDate);

      if (!dates.length) {
        setMessage("No hay filas válidas para guardar.");
        return;
      }

      await Promise.all(
        dates.map((record_date) =>
          API.savePersonGrid({
            indicator_id: indicatorId,
            record_date,
            rows: groupedByDate[record_date],
          })
        )
      );

      clearMessageSoon("Carga por persona guardada correctamente");
      await handleLoadPersonMatrix();
      await runHistorySearch();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updatePersonMatrix(index, field, value) {
    setPersonMatrixRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const personMatrixAccumulated = useMemo(() => {
    const grouped = personMatrixRows.reduce((acc, row) => {
      const personId = Number(row.person_id);
      const personName = String(row.person_name || "").trim();
      if (!personId || !personName) return acc;

      const numericValue =
        row.value === "" || row.value === null || row.value === undefined
          ? 0
          : Number(row.value);

      if (!acc[personId]) {
        acc[personId] = {
          person_id: personId,
          person: personName,
          accumulated: 0,
          records: 0,
          target_value: Number(row.target_value || 0),
        };
      }

      acc[personId].accumulated += Number.isNaN(numericValue) ? 0 : numericValue;
      acc[personId].records += 1;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) =>
      String(a.person).localeCompare(String(b.person))
    );
  }, [personMatrixRows]);

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
            onClick={handleLoadPersonMatrix}
            disabled={loading}
          >
            Cargar por persona
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleSavePersonMatrix}
            disabled={loading}
          >
            Guardar por persona
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

          {personMatrixMeta && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPersonMatrixMeta(null);
                setPersonMatrixRows([]);
              }}
            >
              Cerrar personas
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
                            value={row.shift_a}
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
                            value={row.shift_b}
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
                            value={row.shift_c}
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
                        value={row.observation}
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

      {personMatrixMeta && (
        <section className="panel-block">
          <div className="subsection-title">
            Matriz por persona - {personMatrixMeta.indicator_code} -{" "}
            {personMatrixMeta.indicator_name}
          </div>

          <div className="rule-preview compact" style={{ marginBottom: 14 }}>
            <div className="rule-item">
              <span>Proceso</span>
              <strong>{personMatrixMeta.process_name || "-"}</strong>
            </div>
            <div className="rule-item">
              <span>Unidad</span>
              <strong>{personMatrixMeta.unit || "-"}</strong>
            </div>
            <div className="rule-item">
              <span>Frecuencia</span>
              <strong>{formatFrequencyLabel(personMatrixMeta.frequency)}</strong>
            </div>
            <div className="rule-item">
              <span>Año</span>
              <strong>{personMatrixMeta.year}</strong>
            </div>
            <div className="rule-item">
              <span>Mes</span>
              <strong>{personMatrixMeta.month}</strong>
            </div>
            <div className="rule-item">
              <span>Personas</span>
              <strong>{personMatrixMeta.targets.length}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Día</th>
                  <th>Meta</th>
                  <th>Valor</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {personMatrixRows.map((row, index) => (
                  <tr key={getStableRowId(row, index)}>
                    <td>
                      <input value={row.person_name} disabled />
                    </td>
                    <td>
                      <input value={row.day} disabled />
                    </td>
                    <td>
                      <input value={row.target_value ?? 0} disabled />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.value}
                        onChange={(e) =>
                          updatePersonMatrix(index, "value", e.target.value)
                        }
                        placeholder="Valor"
                      />
                    </td>
                    <td>
                      <input
                        value={row.observation}
                        onChange={(e) =>
                          updatePersonMatrix(index, "observation", e.target.value)
                        }
                        placeholder="Observación"
                      />
                    </td>
                  </tr>
                ))}

                {!personMatrixRows.length && (
                  <tr>
                    <td colSpan="5" className="empty">
                      Sin filas para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ height: 18 }} />

          <div className="subsection-title">Acumulado por persona</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Registros</th>
                  <th>Meta</th>
                  <th>Acumulado del mes</th>
                </tr>
              </thead>
              <tbody>
                {personMatrixAccumulated.map((item) => (
                  <tr key={item.person_id}>
                    <td>{item.person}</td>
                    <td>{item.records}</td>
                    <td>{formatPlainNumber(item.target_value || 0)}</td>
                    <td>{formatPlainNumber(item.accumulated)}</td>
                  </tr>
                ))}

                {!personMatrixAccumulated.length && (
                  <tr>
                    <td colSpan="4" className="empty">
                      Aún no hay acumulados por persona
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
                {isPersonHistoryIndicator && <th>Persona</th>}
                <th>Valor</th>
                {!isPersonHistoryIndicator && <th>A</th>}
                {!isPersonHistoryIndicator && <th>B</th>}
                {!isPersonHistoryIndicator && <th>C</th>}
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
                  {isPersonHistoryIndicator && <td>{item.person_name || "-"}</td>}
                  <td>
                    {item.scope_type === "person"
                      ? formatPlainNumber(item.value ?? 0)
                      : item.capture_mode === "single"
                      ? item.single_value ?? "-"
                      : "-"}
                  </td>
                  {!isPersonHistoryIndicator && (
                    <td>{hasShift(item.shifts, "A") ? item.shift_a ?? "-" : "-"}</td>
                  )}
                  {!isPersonHistoryIndicator && (
                    <td>{hasShift(item.shifts, "B") ? item.shift_b ?? "-" : "-"}</td>
                  )}
                  {!isPersonHistoryIndicator && (
                    <td>{hasShift(item.shifts, "C") ? item.shift_c ?? "-" : "-"}</td>
                  )}
                  <td>
                    {item.scope_type === "person"
                      ? formatPercent(item.general)
                      : formatGeneral(item.general, item.unit)}
                  </td>
                  <td>
                    <span className={`status ${item.status}`}>{item.status}</span>
                  </td>
                  <td>{item.observation || "-"}</td>
                  <td>
                    <div className="row-actions">
                      {item.scope_type !== "person" ? (
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
                    colSpan={isPersonHistoryIndicator ? "9" : "12"}
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