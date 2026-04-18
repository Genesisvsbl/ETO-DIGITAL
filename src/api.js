const API_URL =
  import.meta.env.VITE_API_URL || "https://eto-digital.onrender.com";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = "Error en la solicitud";
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      //
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(typeof value === "boolean" && value === false)
    ) {
      query.append(key, value);
    }
  });

  return query.toString();
}

const API = {
  // =========================
  // PROCESOS
  // =========================
  getProcesses: (level) =>
    request(`/processes${level ? `?level=${level}` : ""}`),

  createProcess: (payload) =>
    request("/processes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProcess: (id, payload) =>
    request(`/processes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteProcess: (id) =>
    request(`/processes/${id}`, {
      method: "DELETE",
    }),

  // =========================
  // INDICADORES
  // =========================
  getIndicators: (params = {}) => {
    const q = buildQuery({
      process_id: params.process_id,
      level: params.level,
      scope_type: params.scope_type,
    });
    return request(`/indicators${q ? `?${q}` : ""}`);
  },

  createIndicator: (payload) =>
    request("/indicators", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        scope_type: payload.scope_type || "standard",
        capture_mode:
          payload.scope_type === "entity" ? "single" : payload.capture_mode,
        shifts:
          payload.scope_type === "entity" || payload.capture_mode === "single"
            ? []
            : payload.shifts || [],
      }),
    }),

  updateIndicator: (id, payload) =>
    request(`/indicators/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...payload,
        scope_type: payload.scope_type || "standard",
        capture_mode:
          payload.scope_type === "entity" ? "single" : payload.capture_mode,
        shifts:
          payload.scope_type === "entity" || payload.capture_mode === "single"
            ? []
            : payload.shifts || [],
      }),
    }),

  deleteIndicator: (id) =>
    request(`/indicators/${id}`, {
      method: "DELETE",
    }),

  // =========================
  // CAPTURA DIARIA ESTÁNDAR
  // =========================
  saveDailyRecord: (payload) =>
    request("/daily-records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateDailyRecord: (id, payload) =>
    request(`/daily-records/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteDailyRecord: (id) =>
    request(`/daily-records/${id}`, {
      method: "DELETE",
    }),

  getDailyByDate: ({ record_date, process_id, level }) => {
    const q = buildQuery({
      record_date,
      process_id,
      level,
    });
    return request(`/daily-records/by-date?${q}`);
  },

  // =========================
  // MATRIZ / CARGA MASIVA ESTÁNDAR
  // =========================
  getMonthMatrix: ({ indicator_id, year, month }) => {
    const q = buildQuery({
      indicator_id,
      year,
      month,
    });
    return request(`/daily-records/month?${q}`);
  },

  saveMonthMatrix: ({ indicator_id, rows }) =>
    request("/daily-records/month", {
      method: "POST",
      body: JSON.stringify({
        indicator_id,
        rows,
      }),
    }),

  getPeriodMatrix: ({ indicator_id, year, month }) =>
    API.getMonthMatrix({ indicator_id, year, month }),

  savePeriodMatrix: ({ indicator_id, rows }) =>
    API.saveMonthMatrix({ indicator_id, rows }),

  // =========================
  // ENTIDADES
  // =========================
  getEntities: ({ active_only, entity_type } = {}) => {
    const q = buildQuery({
      active_only: active_only ? "true" : undefined,
      entity_type,
    });
    return request(`/entities${q ? `?${q}` : ""}`);
  },

  createEntity: (payload) =>
    request("/entities", {
      method: "POST",
      body: JSON.stringify({
        code: payload.code || "",
        name: payload.name || payload.full_name || "",
        entity_type: payload.entity_type || "persona",
        document: payload.document || null,
        position: payload.position || null,
        area: payload.area || null,
        is_active: payload.is_active ?? true,
      }),
    }),

  updateEntity: (id, payload) =>
    request(`/entities/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        code: payload.code || "",
        name: payload.name || payload.full_name || "",
        entity_type: payload.entity_type || "persona",
        document: payload.document || null,
        position: payload.position || null,
        area: payload.area || null,
        is_active: payload.is_active ?? true,
      }),
    }),

  deleteEntity: (id) =>
    request(`/entities/${id}`, {
      method: "DELETE",
    }),

  // =========================
  // METAS POR ENTIDAD
  // =========================
  getEntityTargets: ({ indicator_id, entity_id, active_only } = {}) => {
    const q = buildQuery({
      indicator_id,
      entity_id,
      active_only: active_only ? "true" : undefined,
    });
    return request(`/entity-indicator-targets${q ? `?${q}` : ""}`);
  },

  createOrUpdateEntityTarget: (payload) =>
    request("/entity-indicator-targets", {
      method: "POST",
      body: JSON.stringify({
        indicator_id: payload.indicator_id,
        entity_id: payload.entity_id,
        target_value: payload.target_value,
        is_active: payload.is_active ?? true,
      }),
    }),

  deleteEntityTarget: (id) =>
    request(`/entity-indicator-targets/${id}`, {
      method: "DELETE",
    }),

  // =========================
  // CAPTURA POR ENTIDAD
  // =========================
  getEntityCaptureGrid: ({ indicator_id, record_date }) => {
    const q = buildQuery({
      indicator_id,
      record_date,
    });
    return request(`/entity-records/grid?${q}`);
  },

  saveEntityGrid: ({ indicator_id, record_date, rows }) =>
    request("/entity-records/bulk", {
      method: "POST",
      body: JSON.stringify({
        indicator_id,
        record_date,
        rows: (rows || []).map((row) => ({
          entity_id: row.entity_id,
          value: row.value,
          observation: row.observation,
        })),
      }),
    }),

  getEntityRecords: ({ indicator_id, entity_id, year, month } = {}) => {
    const q = buildQuery({
      indicator_id,
      entity_id,
      year,
      month,
    });
    return request(`/entity-records${q ? `?${q}` : ""}`);
  },

  // =========================
  // HISTÓRICO ESTÁNDAR
  // =========================
  getHistory: ({ year, month, day, level, process_id, indicator_id }) => {
    const q = buildQuery({
      year,
      month,
      day,
      level,
      process_id,
      indicator_id,
    });
    return request(`/history${q ? `?${q}` : ""}`);
  },

  getHistorySummary: ({
    year,
    month,
    day,
    level,
    process_id,
    indicator_id,
  }) => {
    const q = buildQuery({
      year,
      month,
      day,
      level,
      process_id,
      indicator_id,
    });
    return request(`/history/summary${q ? `?${q}` : ""}`);
  },

  // =========================
  // DASHBOARD
  // =========================
  getDashboardOverview: ({ year, month, day, level }) => {
    const q = buildQuery({
      year,
      month,
      day,
      level,
    });
    return request(`/dashboard/overview${q ? `?${q}` : ""}`);
  },

  getProcessDashboard: ({
    process_id,
    indicator_id,
    year,
    month,
    day,
    level,
    period,
  }) => {
    const q = buildQuery({
      process_id,
      indicator_id,
      year,
      month,
      day,
      level,
      period,
    });
    return request(`/dashboard/process?${q}`);
  },

  getEntityDashboard: ({ indicator_id, year, month }) => {
    const q = buildQuery({
      indicator_id,
      year,
      month,
    });
    return request(`/dashboard/entity?${q}`);
  },

  // =========================
  // COMPATIBILIDAD CON FRONTEND VIEJO
  // =========================
  getPersons: ({ active_only } = {}) =>
    API.getEntities({ active_only, entity_type: "persona" }),

  createPerson: (payload) =>
    API.createEntity({
      code: payload.code,
      name: payload.full_name || payload.name,
      entity_type: "persona",
      is_active: payload.is_active,
    }),

  updatePerson: (id, payload) =>
    API.updateEntity(id, {
      code: payload.code,
      name: payload.full_name || payload.name,
      entity_type: "persona",
      is_active: payload.is_active,
    }),

  deletePerson: (id) => API.deleteEntity(id),

  getPersonTargets: ({ indicator_id, person_id, active_only } = {}) =>
    API.getEntityTargets({
      indicator_id,
      entity_id: person_id,
      active_only,
    }),

  createOrUpdatePersonTarget: (payload) =>
    API.createOrUpdateEntityTarget({
      indicator_id: payload.indicator_id,
      entity_id: payload.person_id ?? payload.entity_id,
      target_value: payload.target_value,
      is_active: payload.is_active,
    }),

  deletePersonTarget: (id) => API.deleteEntityTarget(id),

  getPersonCaptureGrid: ({ indicator_id, record_date }) =>
    API.getEntityCaptureGrid({ indicator_id, record_date }),

  savePersonGrid: ({ indicator_id, record_date, rows }) =>
    API.saveEntityGrid({
      indicator_id,
      record_date,
      rows: (rows || []).map((row) => ({
        entity_id: row.person_id ?? row.entity_id,
        value: row.value,
        observation: row.observation,
      })),
    }),

  getPersonRecords: ({ indicator_id, person_id, year, month } = {}) =>
    API.getEntityRecords({
      indicator_id,
      entity_id: person_id,
      year,
      month,
    }),

  getPersonDashboard: ({ indicator_id, year, month }) =>
    API.getEntityDashboard({
      indicator_id,
      year,
      month,
    }),
};

export default API;