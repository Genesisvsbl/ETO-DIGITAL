import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Gauge,
  Pencil,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  UsersRound,
} from "lucide-react";

const OPERATORS = [">", ">=", "<", "<=", "="];
const UNITS = ["%", "días", "horas", "unidades", "casos", "número"];

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

function formatFrequencyLabel(value) {
  if (value === "day") return "Diaria";
  if (value === "week") return "Semanal";
  if (value === "month") return "Mensual";
  return value || "-";
}

function formatCaptureModeLabel(value) {
  if (value === "single") return "Único";
  if (value === "shifts") return "Turnos";
  return value || "-";
}

function formatRule(op, value, unit) {
  if (!op || value === "" || value === null || value === undefined) return "-";
  return `${op} ${value}${unit === "número" ? "" : ` ${unit}`}`;
}

function buildEntityOptionLabel(entity) {
  const parts = [entity.name || "-"];
  if (entity.code) parts.push(`(${entity.code})`);
  if (entity.entity_type) parts.push(`- ${entity.entity_type}`);
  return parts.join(" ");
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalOperator(value) {
  if (value === "" || value === null || value === undefined) return null;

  const clean = String(value).trim();
  if (["", "-", "opcional", "none", "null", "undefined"].includes(clean.toLowerCase())) {
    return null;
  }

  return clean;
}

function hasRuleValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function withThresholdFlags(item) {
  return {
    ...item,
    use_warning: !!item.warning_operator && hasRuleValue(item.warning_value),
    use_critical: !!item.critical_operator && hasRuleValue(item.critical_value),
  };
}

export default function IndicatorsView({
  accessLevel,
  processes,
  indicators,
  indicatorForm,
  setIndicatorForm,
  editingIndicatorId,
  handleCreateIndicator,
  handleEditIndicator,
  handleDeleteIndicator,
  resetIndicatorForm,
  toggleShift,

  entities = [],
  selectedIndicatorForEntities = null,
  selectedIndicatorEntityTargets = [],
  selectedEntityId = "",
  selectedEntityTargetValue = "",
  setSelectedEntityId = () => {},
  setSelectedEntityTargetValue = () => {},
  handleLoadIndicatorEntityTargets = () => {},
  handleCreateOrUpdateEntityTarget = () => {},
  handleDeleteEntityTarget = () => {},

  entityForm = {
    code: "",
    name: "",
    entity_type: "",
    is_active: true,
  },
  setEntityForm = () => {},
  handleCreateEntity = () => {},
  handleEditEntity = () => {},
  handleDeleteEntity = () => {},
  editingEntityId = null,
  resetEntityForm = () => {},
}) {
  const [entityFilter, setEntityFilter] = useState("");
  const [indicatorFilter, setIndicatorFilter] = useState("");

  const visibleEntities = useMemo(() => {
    const query = String(entityFilter || "").trim().toLowerCase();

    const usedIds = new Set(
      (selectedIndicatorEntityTargets || [])
        .map((item) => Number(item.entity_id))
        .filter((value) => !Number.isNaN(value))
    );

    return (entities || []).filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const code = String(item.code || "").toLowerCase();
      const entityType = String(item.entity_type || "").toLowerCase();
      const matches =
        !query ||
        name.includes(query) ||
        code.includes(query) ||
        entityType.includes(query);

      const entityId = Number(item.id);
      return matches && !usedIds.has(entityId);
    });
  }, [entityFilter, entities, selectedIndicatorEntityTargets]);

  const visibleIndicators = useMemo(() => {
    const query = String(indicatorFilter || "").trim().toLowerCase();

    if (!query) return indicators || [];

    return (indicators || []).filter((item) => {
      const values = [
        item.code,
        item.name,
        item.process_name,
        item.frequency,
        item.capture_mode,
        item.unit,
        item.scope_type,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return values.includes(query);
    });
  }, [indicatorFilter, indicators]);

  const isEntityIndicatorForm = indicatorForm.scope_type === "entity";
  const useWarning = !!indicatorForm.use_warning;
  const useCritical = !!indicatorForm.use_critical;

  const totalEntityIndicators = useMemo(
    () => (indicators || []).filter((item) => item.scope_type === "entity").length,
    [indicators]
  );

  function submitIndicatorForm(event) {
    event.preventDefault();

    const warningOperator = useWarning
      ? optionalOperator(indicatorForm.warning_operator)
      : null;
    const warningValue = useWarning
      ? optionalNumber(indicatorForm.warning_value)
      : null;

    const criticalOperator = useCritical
      ? optionalOperator(indicatorForm.critical_operator)
      : null;
    const criticalValue = useCritical
      ? optionalNumber(indicatorForm.critical_value)
      : null;

    const hasWarning = Boolean(warningOperator) && warningValue !== null;
    const hasCritical = Boolean(criticalOperator) && criticalValue !== null;

    const cleanForm = {
      ...indicatorForm,
      use_warning: hasWarning,
      use_critical: hasCritical,
      process_id: Number(indicatorForm.process_id),
      meeting_level: Number(accessLevel),
      target_value: Number(indicatorForm.target_value),

      warning_operator: hasWarning ? warningOperator : null,
      warning_value: hasWarning ? warningValue : null,

      critical_operator: hasCritical ? criticalOperator : null,
      critical_value: hasCritical ? criticalValue : null,
    };

    handleCreateIndicator(event, cleanForm);
  }

  return (
    <section className="indicators-page">
      <style>{indicatorsCss}</style>

      <div className="indicators-bg-pattern" />

      <header className="indicators-header">
        <div>
          <div className="indicators-kicker">DATOS MAESTROS</div>
          <h2>Administración de indicadores</h2>
          <p>Solo se muestran indicadores del nivel {accessLevel}.</p>
        </div>

        <div className="header-kpis">
          <div className="mini-kpi">
            <span>Total</span>
            <strong>{indicators.length}</strong>
          </div>
          <div className="mini-kpi">
            <span>Procesos</span>
            <strong>{processes.length}</strong>
          </div>
          <div className="mini-kpi">
            <span>Por entidad</span>
            <strong>{totalEntityIndicators}</strong>
          </div>
        </div>
      </header>

      <div className="indicators-grid">
        <article className="indicator-panel create-panel">
          <div className="panel-title-row">
            <div className="panel-icon">
              <SlidersHorizontal size={23} />
            </div>

            <div>
              <h3>{editingIndicatorId ? "Editar indicador" : "Crear indicador"}</h3>
              <p>
                {editingIndicatorId
                  ? "Actualiza la configuración del indicador seleccionado."
                  : `Define un nuevo indicador de nivel ${accessLevel}.`}
              </p>
            </div>
          </div>

          <div className="panel-divider" />

          <form onSubmit={submitIndicatorForm} className="indicator-form">
            <div className="indicator-field full-field">
              <label>
                <Target size={15} />
                Nombre
              </label>
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

            <div className="form-two-cols">
              <div className="indicator-field">
                <label>
                  <WorkflowIcon />
                  Proceso
                </label>
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

              <div className="indicator-field">
                <label>
                  <Gauge size={15} />
                  Nivel de reunión
                </label>
                <input value={`Nivel ${accessLevel}`} disabled />
              </div>
            </div>

            <div className="indicator-field full-field">
              <label>
                <BarChart3 size={15} />
                Unidad
              </label>
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

            <div className="indicator-field full-field">
              <label>
                <UsersRound size={15} />
                Tipo de alcance
              </label>
              <select
                value={indicatorForm.scope_type}
                onChange={(e) =>
                  setIndicatorForm({
                    ...indicatorForm,
                    scope_type: e.target.value,
                    capture_mode:
                      e.target.value === "entity" ? "single" : "shifts",
                    shifts: e.target.value === "entity" ? [] : ["A", "B", "C"],
                  })
                }
              >
                <option value="standard">Indicador estándar</option>
                <option value="entity">Indicador por entidad</option>
              </select>
            </div>

            <div className="form-two-cols">
              <div className="indicator-field">
                <label>
                  <ClipboardList size={15} />
                  Frecuencia de medición
                </label>
                <select
                  value={indicatorForm.frequency}
                  onChange={(e) =>
                    setIndicatorForm({
                      ...indicatorForm,
                      frequency: e.target.value,
                    })
                  }
                >
                  <option value="day">Diaria</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensual</option>
                </select>
              </div>

              <div className="indicator-field">
                <label>
                  <CheckCircle2 size={15} />
                  Modo de captura
                </label>
                <select
                  value={
                    isEntityIndicatorForm ? "single" : indicatorForm.capture_mode
                  }
                  onChange={(e) =>
                    setIndicatorForm({
                      ...indicatorForm,
                      capture_mode: e.target.value,
                      shifts: e.target.value === "single" ? [] : ["A", "B", "C"],
                    })
                  }
                  disabled={isEntityIndicatorForm}
                >
                  <option value="shifts">Por turnos</option>
                  <option value="single">Valor único</option>
                </select>
              </div>
            </div>

            <div className="threshold-card">
              <div className="threshold-card-head">
                <div>
                  <strong>Umbrales de desempeño</strong>
                  <small>Define meta, alerta y punto crítico del indicador.</small>
                </div>
              </div>

              <div className="threshold-grid">
                <div className="threshold-box meta-box">
                  <label>
                    <span className="dot green" />
                    Meta
                  </label>
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

                <div className="threshold-box warning-box">
                  <label>
                    <span className="label-left">
                      <span className="dot yellow" />
                      Warning
                    </span>
                    <input
                      type="checkbox"
                      checked={useWarning}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          use_warning: e.target.checked,
                          warning_operator: e.target.checked
                            ? indicatorForm.warning_operator || ">="
                            : null,
                          warning_value: e.target.checked
                            ? indicatorForm.warning_value ?? ""
                            : null,
                        })
                      }
                    />
                  </label>

                  <div className="threshold-row">
                    <select
                      value={indicatorForm.warning_operator || ""}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          warning_operator: e.target.value,
                        })
                      }
                      disabled={!useWarning}
                    >
                      <option value="">-</option>
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      value={
                        indicatorForm.warning_value === null ||
                        indicatorForm.warning_value === undefined
                          ? ""
                          : indicatorForm.warning_value
                      }
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          warning_value: e.target.value,
                        })
                      }
                      disabled={!useWarning}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="threshold-box critical-box">
                  <label>
                    <span className="label-left">
                      <span className="dot red" />
                      Critical
                    </span>
                    <input
                      type="checkbox"
                      checked={useCritical}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          use_critical: e.target.checked,
                          critical_operator: e.target.checked
                            ? indicatorForm.critical_operator || "<="
                            : null,
                          critical_value: e.target.checked
                            ? indicatorForm.critical_value ?? ""
                            : null,
                        })
                      }
                    />
                  </label>

                  <div className="threshold-row">
                    <select
                      value={indicatorForm.critical_operator || ""}
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          critical_operator: e.target.value,
                        })
                      }
                      disabled={!useCritical}
                    >
                      <option value="">-</option>
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      value={
                        indicatorForm.critical_value === null ||
                        indicatorForm.critical_value === undefined
                          ? ""
                          : indicatorForm.critical_value
                      }
                      onChange={(e) =>
                        setIndicatorForm({
                          ...indicatorForm,
                          critical_value: e.target.value,
                        })
                      }
                      disabled={!useCritical}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="rule-preview">
                <div className="rule-item meta-preview">
                  <span>Meta</span>
                  <strong>
                    {formatRule(
                      indicatorForm.target_operator,
                      indicatorForm.target_value,
                      indicatorForm.unit
                    )}
                  </strong>
                </div>

                <div className="rule-item warning-preview">
                  <span>Warning</span>
                  <strong>
                    {useWarning
                      ? formatRule(
                          indicatorForm.warning_operator,
                          indicatorForm.warning_value,
                          indicatorForm.unit
                        )
                      : "-"}
                  </strong>
                </div>

                <div className="rule-item critical-preview">
                  <span>Critical</span>
                  <strong>
                    {useCritical
                      ? formatRule(
                          indicatorForm.critical_operator,
                          indicatorForm.critical_value,
                          indicatorForm.unit
                        )
                      : "-"}
                  </strong>
                </div>
              </div>
            </div>

            {indicatorForm.scope_type === "entity" && (
              <div className="indicator-alert">
                Este indicador será capturado por entidad. Te servirá para evaluar
                personas, máquinas, líneas u otro recurso que definas.
              </div>
            )}

            {indicatorForm.scope_type !== "entity" &&
              indicatorForm.capture_mode === "shifts" && (
                <div className="indicator-field full-field">
                  <label>
                    <CheckCircle2 size={15} />
                    Turnos habilitados
                  </label>
                  <div className="checks">
                    {["A", "B", "C"].map((shift) => (
                      <label key={shift} className="check">
                        <input
                          type="checkbox"
                          checked={normalizeShifts(indicatorForm.shifts).includes(
                            shift
                          )}
                          onChange={() => toggleShift(shift)}
                        />
                        {shift}
                      </label>
                    ))}
                  </div>
                </div>
              )}

            <div className="form-actions">
              <button className="indicator-primary" type="submit">
                <FilePlus2 size={18} />
                {editingIndicatorId ? "Actualizar indicador" : "Crear indicador"}
              </button>

              {editingIndicatorId && (
                <button
                  type="button"
                  className="indicator-secondary"
                  onClick={resetIndicatorForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="indicator-panel list-panel">
          <div className="list-panel-head">
            <div className="panel-title-row compact">
              <div className="panel-icon">
                <ClipboardList size={23} />
              </div>

              <div>
                <h3>Listado de indicadores</h3>
                <p>Consulta y administra los indicadores existentes.</p>
              </div>
            </div>

            <div className="indicator-search">
              <Search size={18} />
              <input
                value={indicatorFilter}
                onChange={(event) => setIndicatorFilter(event.target.value)}
                placeholder="Buscar indicadores..."
              />
            </div>
          </div>

          <div className="indicators-table-wrap">
            <table className="indicators-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Proceso</th>
                  <th>Frecuencia</th>
                  <th>Captura</th>
                  <th>Unidad</th>
                  <th>Meta</th>
                  <th>Warning</th>
                  <th>Critical</th>
                  <th>Alcance</th>
                  <th>Turnos</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {visibleIndicators.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="code-pill">{item.code}</strong>
                    </td>
                    <td>
                      <strong className="indicator-name">{item.name}</strong>
                    </td>
                    <td>
                      <span className="process-badge">{item.process_name}</span>
                    </td>
                    <td>{formatFrequencyLabel(item.frequency)}</td>
                    <td>{formatCaptureModeLabel(item.capture_mode)}</td>
                    <td>{item.unit}</td>
                    <td>{formatRule(item.target_operator, item.target_value, item.unit)}</td>
                    <td>{formatRule(item.warning_operator, item.warning_value, item.unit)}</td>
                    <td>{formatRule(item.critical_operator, item.critical_value, item.unit)}</td>
                    <td>{item.scope_type === "entity" ? "Por entidad" : "Estándar"}</td>
                    <td>
                      {item.capture_mode === "single"
                        ? "-"
                        : normalizeShifts(item.shifts).join(", ")}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditIndicator(withThresholdFlags(item))}
                        >
                          <Pencil size={15} />
                          Editar
                        </button>

                        {item.scope_type === "entity" && (
                          <button
                            type="button"
                            className="table-btn entity"
                            onClick={() => handleLoadIndicatorEntityTargets(item)}
                          >
                            <UsersRound size={15} />
                            Entidades
                          </button>
                        )}

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteIndicator(item)}
                        >
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!visibleIndicators.length && (
                  <tr>
                    <td colSpan="12" className="empty">
                      Sin indicadores
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="table-footer">
            <span>
              Mostrando {visibleIndicators.length} de {indicators.length} indicadores
            </span>

            <div className="pagination">
              <button type="button">‹</button>
              <button type="button" className="active">1</button>
              <button type="button">›</button>
              <select defaultValue="10">
                <option value="10">10 / página</option>
                <option value="20">20 / página</option>
                <option value="50">50 / página</option>
              </select>
            </div>
          </footer>
        </article>
      </div>

      {selectedIndicatorForEntities && (
        <section className="entity-section">
          <div className="entity-section-head">
            <div>
              <div className="indicators-kicker">ENTIDADES ASOCIADAS</div>
              <h3>
                {selectedIndicatorForEntities.code} - {selectedIndicatorForEntities.name}
              </h3>
            </div>
          </div>

          <div className="entity-summary-grid">
            <div className="rule-item meta-preview">
              <span>Proceso</span>
              <strong>{selectedIndicatorForEntities.process_name}</strong>
            </div>
            <div className="rule-item meta-preview">
              <span>Unidad</span>
              <strong>{selectedIndicatorForEntities.unit}</strong>
            </div>
            <div className="rule-item meta-preview">
              <span>Frecuencia</span>
              <strong>{formatFrequencyLabel(selectedIndicatorForEntities.frequency)}</strong>
            </div>
            <div className="rule-item meta-preview">
              <span>Alcance</span>
              <strong>Por entidad</strong>
            </div>
          </div>

          <div className="entity-grid">
            <article className="indicator-panel entity-panel">
              <div className="panel-title-row compact">
                <div className="panel-icon">
                  <FilePlus2 size={22} />
                </div>
                <div>
                  <h3>{editingEntityId ? "Editar entidad" : "Crear entidad nueva"}</h3>
                  <p>Administra recursos asociados al indicador.</p>
                </div>
              </div>

              <div className="entity-form-grid">
                <div className="indicator-field">
                  <label>Código</label>
                  <input
                    value={entityForm.code}
                    onChange={(e) =>
                      setEntityForm({
                        ...entityForm,
                        code: e.target.value,
                      })
                    }
                    placeholder="Opcional"
                  />
                </div>

                <div className="indicator-field">
                  <label>Nombre</label>
                  <input
                    value={entityForm.name}
                    onChange={(e) =>
                      setEntityForm({
                        ...entityForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="Ej. Máquina Selladora 01"
                  />
                </div>

                <div className="indicator-field">
                  <label>Tipo de entidad</label>
                  <input
                    value={entityForm.entity_type}
                    onChange={(e) =>
                      setEntityForm({
                        ...entityForm,
                        entity_type: e.target.value,
                      })
                    }
                    placeholder="Ej. persona, máquina, línea, vehículo"
                  />
                </div>

                <div className="indicator-field">
                  <label>Estado</label>
                  <select
                    value={entityForm.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setEntityForm({
                        ...entityForm,
                        is_active: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="indicator-secondary"
                  onClick={handleCreateEntity}
                >
                  {editingEntityId ? "Actualizar entidad" : "Guardar entidad"}
                </button>

                {editingEntityId && (
                  <button
                    type="button"
                    className="indicator-secondary"
                    onClick={resetEntityForm}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </article>

            <article className="indicator-panel entity-panel">
              <div className="panel-title-row compact">
                <div className="panel-icon">
                  <UsersRound size={22} />
                </div>
                <div>
                  <h3>Asociar entidad al indicador</h3>
                  <p>Vincula entidades disponibles y define meta individual.</p>
                </div>
              </div>

              <div className="associate-grid">
                <div className="indicator-field">
                  <label>Buscar entidad</label>
                  <input
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    placeholder="Buscar por nombre, código o tipo"
                  />
                </div>

                <div className="indicator-field">
                  <label>Entidad</label>
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                  >
                    <option value="">Seleccione</option>
                    {visibleEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {buildEntityOptionLabel(entity)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="indicator-field">
                  <label>Meta individual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedEntityTargetValue}
                    onChange={(e) => setSelectedEntityTargetValue(e.target.value)}
                    placeholder="Ej. 0, 10, 25"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="indicator-primary"
                  onClick={handleCreateOrUpdateEntityTarget}
                >
                  Agregar entidad
                </button>
              </div>

              {!visibleEntities.length && (
                <div className="indicator-alert">
                  No hay entidades disponibles para asociar con el filtro actual o todas ya fueron asociadas.
                </div>
              )}
            </article>
          </div>

          <div className="indicators-table-wrap entity-table-wrap">
            <table className="indicators-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Entidad</th>
                  <th>Tipo</th>
                  <th>Meta individual</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {selectedIndicatorEntityTargets.map((item, index) => (
                  <tr key={item.id || `${item.entity_id}-${index}`}>
                    <td>{item.entity_code}</td>
                    <td>{item.entity_name}</td>
                    <td>{item.entity_type}</td>
                    <td>{item.target_value ?? 0}</td>
                    <td>{item.is_active ? "Activa" : "Inactiva"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditEntity(item)}
                        >
                          Editar entidad
                        </button>

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteEntity(item)}
                        >
                          Eliminar entidad
                        </button>

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteEntityTarget(item)}
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!selectedIndicatorEntityTargets.length && (
                  <tr>
                    <td colSpan="6" className="empty">
                      Este indicador aún no tiene entidades asociadas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

function WorkflowIcon() {
  return <span className="mini-svg-dot" />;
}

const indicatorsCss = `
.indicators-page {
  position: relative;
  min-height: calc(100% / .90);
  width: calc(100% / .90);
  overflow: hidden;
  padding: clamp(22px, 2.4vw, 34px);
  transform: scale(.90);
  transform-origin: top left;
  color: #0f172a;
  background:
    radial-gradient(circle at 92% 6%, rgba(34,197,94,.09), transparent 30%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,251,255,.94));
}

.indicators-bg-pattern {
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

.indicators-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: clamp(24px, 2.5vw, 34px);
}

.indicators-kicker {
  color: #059669;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.indicators-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: 950;
}

.indicators-header p {
  margin: 14px 0 0;
  color: #64748b;
  font-size: clamp(15px, 1vw, 18px);
  line-height: 1.5;
}

.header-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(96px, 1fr));
  gap: 12px;
  min-width: 340px;
}

.mini-kpi {
  min-height: 76px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(34,197,94,.16);
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.14), transparent 34%),
    rgba(255,255,255,.86);
  box-shadow: 0 14px 32px rgba(15,23,42,.06);
}

.mini-kpi span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.mini-kpi strong {
  display: block;
  margin-top: 8px;
  color: #059669;
  font-size: 26px;
  line-height: 1;
  font-weight: 950;
}

.indicators-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(580px, 680px) minmax(0, 1fr);
  gap: clamp(20px, 2vw, 28px);
  align-items: stretch;
}

.indicator-panel {
  border-radius: 22px;
  border: 1px solid rgba(226,232,240,.95);
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.88));
  box-shadow:
    0 20px 54px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92);
}

.create-panel {
  min-height: 680px;
  padding: 26px;
}

.list-panel {
  min-height: 680px;
  padding: 26px 26px 22px;
  display: flex;
  flex-direction: column;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.panel-title-row.compact {
  min-width: 280px;
}

.panel-icon {
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

.panel-title-row h3 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -.025em;
}

.panel-title-row p {
  margin: 8px 0 0;
  color: #8190a6;
  font-size: 13px;
  line-height: 1.35;
}

.panel-divider {
  height: 1px;
  width: 100%;
  margin: 24px 0 24px;
  background: linear-gradient(90deg, rgba(148,163,184,.30), transparent);
}

.indicator-form {
  display: grid;
  gap: 15px;
}

.form-two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.indicator-field {
  display: grid;
  gap: 9px;
}

.indicator-field label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 850;
}

.indicator-field label svg,
.mini-svg-dot {
  color: #059669;
}

.mini-svg-dot {
  width: 15px;
  height: 15px;
  display: inline-block;
  border-radius: 5px;
  background: rgba(5,150,105,.14);
  border: 1px solid rgba(5,150,105,.28);
}

.indicator-field input,
.indicator-field select,
.threshold-row input,
.threshold-row select,
.indicator-search input,
.pagination select {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #0f172a;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.indicator-field input::placeholder,
.indicator-search input::placeholder,
.threshold-row input::placeholder {
  color: #94a3b8;
}

.indicator-field input:focus,
.indicator-field select:focus,
.threshold-row input:focus,
.threshold-row select:focus,
.indicator-search:focus-within,
.pagination select:focus {
  border-color: rgba(34,197,94,.62);
  box-shadow: 0 0 0 4px rgba(34,197,94,.13);
  background: #fff;
}

.indicator-field input:disabled,
.indicator-field select:disabled,
.threshold-row input:disabled,
.threshold-row select:disabled {
  color: #8da0b8;
  background: #f1f5f9;
  cursor: not-allowed;
}

.threshold-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(34,197,94,.14);
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.10), transparent 34%),
    rgba(248,252,250,.82);
}

.threshold-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.threshold-card-head strong {
  display: block;
  color: #065f46;
  font-size: 14px;
  font-weight: 950;
}

.threshold-card-head small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.threshold-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.threshold-box {
  display: grid;
  gap: 9px;
}

.threshold-box label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 900;
  color: #334155;
}

.label-left {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.dot {
  width: 10px;
  height: 10px;
  display: inline-block;
  border-radius: 999px;
}

.dot.green { background: #10b981; }
.dot.yellow { background: #f59e0b; }
.dot.red { background: #ef4444; }

.threshold-row {
  display: grid;
  grid-template-columns: 78px 1fr;
  gap: 8px;
}

.rule-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.rule-item {
  min-height: 54px;
  padding: 11px;
  border-radius: 13px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.86);
}

.rule-item span {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.rule-item strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 950;
}

.meta-preview {
  background: rgba(16,185,129,.07);
  border-color: rgba(16,185,129,.18);
}
.meta-preview span,
.meta-preview strong { color: #047857; }

.warning-preview {
  background: rgba(245,158,11,.07);
  border-color: rgba(245,158,11,.20);
}
.warning-preview span,
.warning-preview strong { color: #b45309; }

.critical-preview {
  background: rgba(239,68,68,.06);
  border-color: rgba(239,68,68,.18);
}
.critical-preview span,
.critical-preview strong { color: #dc2626; }

.indicator-alert {
  padding: 12px 14px;
  border-radius: 14px;
  color: #166534;
  background: rgba(34,197,94,.08);
  border: 1px solid rgba(34,197,94,.20);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 750;
}

.checks {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.check {
  height: 36px;
  min-width: 70px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px !important;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(34,197,94,.22);
  background: rgba(34,197,94,.06);
  color: #047857 !important;
  font-weight: 900 !important;
}

.check input {
  accent-color: #059669;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.indicator-primary,
.indicator-secondary,
.table-btn,
.pagination button {
  border: 0;
  cursor: pointer;
  font-weight: 900;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}

.indicator-primary:hover,
.indicator-secondary:hover,
.table-btn:hover,
.pagination button:hover {
  transform: translateY(-1px);
}

.indicator-primary {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 0 22px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #059669, #22c55e);
  box-shadow: 0 14px 30px rgba(34,197,94,.28);
}

.indicator-secondary {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  color: #334155;
  border: 1px solid #dbe4ef;
  background: #fff;
}

.list-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 26px;
}

.indicator-search {
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

.indicator-search input {
  height: 100%;
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.indicators-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.indicators-table-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.indicators-table-wrap::-webkit-scrollbar-track {
  background: rgba(226,232,240,.45);
  border-radius: 999px;
}

.indicators-table-wrap::-webkit-scrollbar-thumb {
  background: rgba(34,197,94,.42);
  border-radius: 999px;
}

.indicators-table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
}

.indicators-table th {
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

.indicators-table td {
  height: 62px;
  padding: 0 16px;
  color: #1f2937;
  font-size: 13px;
  border-bottom: 1px solid #e5eaf1;
  vertical-align: middle;
}

.indicators-table tbody tr {
  transition: background .18s ease;
}

.indicators-table tbody tr:hover {
  background: rgba(34,197,94,.035);
}

.indicators-table tbody tr:last-child td {
  border-bottom: 0;
}

.code-pill {
  display: inline-block;
  color: #0f172a;
  font-weight: 950;
  line-height: 1.1;
}

.indicator-name {
  display: block;
  color: #1e293b;
  font-weight: 850;
  max-width: 210px;
  line-height: 1.25;
}

.process-badge {
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

.actions-col {
  min-width: 190px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.table-btn {
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

.table-btn.edit {
  color: #059669;
  border-color: rgba(5,150,105,.18);
}

.table-btn.edit:hover,
.table-btn.entity:hover {
  background: rgba(34,197,94,.08);
  box-shadow: 0 8px 18px rgba(34,197,94,.12);
}

.table-btn.entity {
  color: #0f766e;
  border-color: rgba(20,184,166,.18);
}

.table-btn.delete {
  color: #ef4444;
  border-color: rgba(239,68,68,.16);
}

.table-btn.delete:hover {
  background: rgba(239,68,68,.06);
  box-shadow: 0 8px 18px rgba(239,68,68,.09);
}

.empty {
  height: 140px !important;
  text-align: center;
  color: #94a3b8 !important;
  font-weight: 800;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 2px 0;
  color: #8190a6;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pagination button,
.pagination select {
  height: 34px;
  border-radius: 10px;
  border: 1px solid #dbe4ef;
  background: #fff;
  color: #64748b;
}

.pagination button {
  width: 34px;
  display: grid;
  place-items: center;
}

.pagination button.active {
  color: #059669;
  border-color: rgba(34,197,94,.42);
  background: rgba(34,197,94,.08);
}

.pagination select {
  width: 118px;
  padding: 0 10px;
}

.entity-section {
  position: relative;
  z-index: 1;
  margin-top: 28px;
  padding: 26px;
  border-radius: 24px;
  border: 1px solid rgba(226,232,240,.95);
  background: rgba(255,255,255,.88);
  box-shadow: 0 20px 54px rgba(15,23,42,.08);
}

.entity-section-head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.entity-section-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -.03em;
}

.entity-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.entity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
  gap: 18px;
  margin-bottom: 18px;
}

.entity-panel {
  padding: 24px;
}

.entity-form-grid,
.associate-grid {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.associate-grid {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.2fr) minmax(140px, .75fr);
}

.entity-table-wrap {
  max-height: 420px;
}

@media (max-width: 1440px) {
  .indicators-grid {
    grid-template-columns: minmax(520px, 620px) minmax(0, 1fr);
  }

  .create-panel,
  .list-panel {
    min-height: 650px;
  }
}

@media (max-width: 1180px) {
  .indicators-page {
    padding: 24px;
  }

  .indicators-header {
    flex-direction: column;
  }

  .header-kpis {
    width: 100%;
    min-width: 0;
  }

  .indicators-grid,
  .entity-grid {
    grid-template-columns: 1fr;
  }

  .create-panel,
  .list-panel {
    min-height: auto;
  }

  .list-panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .indicator-search {
    width: 100%;
  }

  .entity-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .associate-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .indicators-page {
    padding: 18px;
  }

  .indicators-header h2 {
    font-size: 32px;
  }

  .header-kpis {
    grid-template-columns: 1fr;
  }

  .create-panel,
  .list-panel,
  .entity-section,
  .entity-panel {
    padding: 20px;
    border-radius: 18px;
  }

  .form-two-cols,
  .threshold-grid,
  .rule-preview,
  .entity-summary-grid {
    grid-template-columns: 1fr;
  }

  .indicators-table-wrap {
    overflow-x: auto;
  }

  .table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;
