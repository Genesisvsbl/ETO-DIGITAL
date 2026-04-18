const API_URL = import.meta.env.VITE_API_URL;

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

  // -------------------------
  // ENTIDADES
  // -------------------------
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
      body: JSON.stringify(payload),
    }),

  updateEntity: (id, payload) =>
    request(`/entities/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteEntity: (id) =>
    request(`/entities/${id}`, {
      method: "DELETE",
    }),

  // -------------------------
  // METAS POR ENTIDAD
  // -------------------------
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
      body: JSON.stringify(payload),
    }),

  deleteEntityTarget: (id) =>
    request(`/entity-indicator-targets/${id}`, {
      method: "DELETE",
    }),

  // -------------------------
  // CAPTURA POR ENTIDAD
  // -------------------------
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
        rows,
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

  // -------------------------
  // HISTÓRICO
  // -------------------------
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

  getEntityHistory: ({
    year,
    month,
    day,
    level,
    process_id,
    indicator_id,
    entity_id,
  }) => {
    const q = buildQuery({
      year,
      month,
      day,
      level,
      process_id,
      indicator_id,
      entity_id,
    });
    return request(`/history/entity${q ? `?${q}` : ""}`);
  },

  getEntityHistorySummary: ({
    year,
    month,
    day,
    level,
    process_id,
    indicator_id,
    entity_id,
  }) => {
    const q = buildQuery({
      year,
      month,
      day,
      level,
      process_id,
      indicator_id,
      entity_id,
    });
    return request(`/history/entity/summary${q ? `?${q}` : ""}`);
  },

  // -------------------------
  // DASHBOARD
  // -------------------------
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
};

export default API;