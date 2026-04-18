import { useMemo, useState } from "react";

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
  if (value === "" || value === null || value === undefined) return "-";
  return `${op} ${value}${unit === "número" ? "" : ` ${unit}`}`;
}

function buildEntityOptionLabel(entity) {
  const parts = [entity.name || "-"];
  if (entity.code) parts.push(`(${entity.code})`);
  if (entity.entity_type) parts.push(`- ${entity.entity_type}`);
  return parts.join(" ");
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
    entity_type: "persona",
    is_active: true,
  },
  setEntityForm = () => {},
  handleCreateEntity = () => {},
}) {
  const [entityFilter, setEntityFilter] = useState("");

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

  const isEntityIndicatorForm = indicatorForm.scope_type === "entity";

  return (
    <section className="content-card">
      <div className="card-header-block">
        <div>
          <div className="section-kicker">DATOS MAESTROS</div>
          <h3>Administración de indicadores</h3>
          <p>Solo se muestran indicadores del nivel {accessLevel}.</p>
        </div>
      </div>

      <div className="split-grid indicators-professional-layout">
        <div className="panel-block">
          <div className="subsection-title">
            {editingIndicatorId ? "Editar indicador" : "Crear indicador"}
          </div>

          <form onSubmit={handleCreateIndicator} className="form">
            <div className="field">
              <label>Nombre</label>
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

            <div className="inline-form-grid two-cols">
              <div className="field">
                <label>Proceso</label>
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

              <div className="field">
                <label>Nivel de reunión</label>
                <input value={`Nivel ${accessLevel}`} disabled />
              </div>
            </div>

            <div className="field">
              <label>Unidad</label>
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

            <div className="field">
              <label>Tipo de alcance</label>
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

            <div className="inline-form-grid two-cols">
              <div className="field">
                <label>Frecuencia de medición</label>
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

              <div className="field">
                <label>Modo de captura</label>
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

            <div className="threshold-grid">
              <div className="threshold-box">
                <label>Meta</label>
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

              <div className="threshold-box">
                <label>Warning</label>
                <div className="threshold-row">
                  <select
                    value={indicatorForm.warning_operator}
                    onChange={(e) =>
                      setIndicatorForm({
                        ...indicatorForm,
                        warning_operator: e.target.value,
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
                    value={indicatorForm.warning_value}
                    onChange={(e) =>
                      setIndicatorForm({
                        ...indicatorForm,
                        warning_value: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="threshold-box">
                <label>Critical</label>
                <div className="threshold-row">
                  <select
                    value={indicatorForm.critical_operator}
                    onChange={(e) =>
                      setIndicatorForm({
                        ...indicatorForm,
                        critical_operator: e.target.value,
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
                    value={indicatorForm.critical_value}
                    onChange={(e) =>
                      setIndicatorForm({
                        ...indicatorForm,
                        critical_value: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rule-preview">
              <div className="rule-item">
                <span>Meta</span>
                <strong>
                  {formatRule(
                    indicatorForm.target_operator,
                    indicatorForm.target_value,
                    indicatorForm.unit
                  )}
                </strong>
              </div>

              <div className="rule-item">
                <span>Warning</span>
                <strong>
                  {formatRule(
                    indicatorForm.warning_operator,
                    indicatorForm.warning_value,
                    indicatorForm.unit
                  )}
                </strong>
              </div>

              <div className="rule-item">
                <span>Critical</span>
                <strong>
                  {formatRule(
                    indicatorForm.critical_operator,
                    indicatorForm.critical_value,
                    indicatorForm.unit
                  )}
                </strong>
              </div>
            </div>

            {indicatorForm.scope_type === "entity" && (
              <div className="alert" style={{ marginBottom: 14 }}>
                Este indicador será capturado por entidad. Te servirá para
                evaluar personas, máquinas, líneas u otro recurso que definas.
              </div>
            )}

            {indicatorForm.scope_type !== "entity" &&
              indicatorForm.capture_mode === "shifts" && (
                <div className="field">
                  <label>Turnos habilitados</label>
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

            <div className="actions">
              <button className="primary">
                {editingIndicatorId ? "Actualizar indicador" : "Crear indicador"}
              </button>

              {editingIndicatorId && (
                <button
                  type="button"
                  className="secondary"
                  onClick={resetIndicatorForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel-block">
          <div className="subsection-title">Listado de indicadores</div>

          <div className="table-wrap indicators-table-wrap">
            <table>
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
                {indicators.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.process_name}</td>
                    <td>{formatFrequencyLabel(item.frequency)}</td>
                    <td>{formatCaptureModeLabel(item.capture_mode)}</td>
                    <td>{item.unit}</td>
                    <td>
                      {formatRule(
                        item.target_operator,
                        item.target_value,
                        item.unit
                      )}
                    </td>
                    <td>
                      {formatRule(
                        item.warning_operator,
                        item.warning_value,
                        item.unit
                      )}
                    </td>
                    <td>
                      {formatRule(
                        item.critical_operator,
                        item.critical_value,
                        item.unit
                      )}
                    </td>
                    <td>
                      {item.scope_type === "entity" ? "Por entidad" : "Estándar"}
                    </td>
                    <td>
                      {item.capture_mode === "single"
                        ? "-"
                        : normalizeShifts(item.shifts).join(", ")}
                    </td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditIndicator(item)}
                        >
                          Editar
                        </button>

                        {item.scope_type === "entity" && (
                          <button
                            type="button"
                            className="table-btn"
                            onClick={() => handleLoadIndicatorEntityTargets(item)}
                          >
                            Entidades
                          </button>
                        )}

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteIndicator(item)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!indicators.length && (
                  <tr>
                    <td colSpan="12" className="empty">
                      Sin indicadores
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedIndicatorForEntities && (
        <section className="panel-block" style={{ marginTop: 18 }}>
          <div className="subsection-title">
            Entidades asociadas - {selectedIndicatorForEntities.code} -{" "}
            {selectedIndicatorForEntities.name}
          </div>

          <div className="rule-preview compact" style={{ marginBottom: 14 }}>
            <div className="rule-item">
              <span>Proceso</span>
              <strong>{selectedIndicatorForEntities.process_name}</strong>
            </div>
            <div className="rule-item">
              <span>Unidad</span>
              <strong>{selectedIndicatorForEntities.unit}</strong>
            </div>
            <div className="rule-item">
              <span>Frecuencia</span>
              <strong>
                {formatFrequencyLabel(selectedIndicatorForEntities.frequency)}
              </strong>
            </div>
            <div className="rule-item">
              <span>Alcance</span>
              <strong>Por entidad</strong>
            </div>
          </div>

          <div
            className="split-grid"
            style={{
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1.85fr)",
              gap: 18,
              marginBottom: 18,
            }}
          >
            <div className="panel-block" style={{ margin: 0 }}>
              <div className="subsection-title">Crear entidad nueva</div>

              <div className="form">
                <div className="field">
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

                <div className="field">
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

                <div className="field">
                  <label>Tipo de entidad</label>
                  <input
                    value={entityForm.entity_type}
                    onChange={(e) =>
                      setEntityForm({
                        ...entityForm,
                        entity_type: e.target.value,
                      })
                    }
                    placeholder="Ej. persona, máquina, línea"
                  />
                </div>

                <div className="field">
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

                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleCreateEntity}
                  >
                    Guardar entidad
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-block" style={{ margin: 0 }}>
              <div className="subsection-title">
                Asociar entidad al indicador
              </div>

              <div
                className="inline-form-grid"
                style={{
                  gridTemplateColumns:
                    "minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(160px, 0.8fr)",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <div className="field">
                  <label>Buscar entidad</label>
                  <input
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    placeholder="Buscar por nombre, código o tipo"
                  />
                </div>

                <div className="field">
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

                <div className="field">
                  <label>Meta individual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedEntityTargetValue}
                    onChange={(e) => setSelectedEntityTargetValue(e.target.value)}
                    placeholder={
                      selectedIndicatorForEntities?.target_value !== undefined &&
                      selectedIndicatorForEntities?.target_value !== null
                        ? `Base: ${selectedIndicatorForEntities.target_value}`
                        : "Opcional"
                    }
                  />
                </div>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={handleCreateOrUpdateEntityTarget}
                >
                  Agregar entidad
                </button>
              </div>

              {!visibleEntities.length && (
                <div className="alert" style={{ marginTop: 14 }}>
                  No hay entidades disponibles para asociar con el filtro actual
                  o todas ya fueron asociadas.
                </div>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table>
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