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
        scope_type:
          payload.scope_type === "entity" ? "person" : payload.scope_type || "standard",
        capture_mode:
          payload.scope_type === "entity" || payload.scope_type === "person"
            ? "single"
            : payload.capture_mode,
        shifts:
          payload.scope_type === "entity" ||
          payload.scope_type === "person" ||
          payload.capture_mode === "single"
            ? []
            : payload.shifts || [],
      }),
    }),

  updateIndicator: (id, payload) =>
    request(`/indicators/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...payload,
        scope_type:
          payload.scope_type === "entity" ? "person" : payload.scope_type || "standard",
        capture_mode:
          payload.scope_type === "entity" || payload.scope_type === "person"
            ? "single"
            : payload.capture_mode,
        shifts:
          payload.scope_type === "entity" ||
          payload.scope_type === "person" ||
          payload.capture_mode === "single"
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

  getPersons: ({ active_only } = {}) => {
    const q = buildQuery({
      active_only: active_only ? "true" : undefined,
    });
    return request(`/persons${q ? `?${q}` : ""}`);
  },

  createPerson: (payload) =>
    request("/persons", {
      method: "POST",
      body: JSON.stringify({
        code: payload.code || "",
        full_name: payload.full_name || payload.name || "",
        is_active: payload.is_active ?? true,
      }),
    }),

  updatePerson: (id, payload) =>
    request(`/persons/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        code: payload.code || "",
        full_name: payload.full_name || payload.name || "",
        is_active: payload.is_active ?? true,
      }),
    }),

  deletePerson: (id) =>
    request(`/persons/${id}`, {
      method: "DELETE",
    }),

  getPersonTargets: ({ indicator_id, person_id, active_only } = {}) => {
    const q = buildQuery({
      indicator_id,
      person_id,
      active_only: active_only ? "true" : undefined,
    });
    return request(`/person-indicator-targets${q ? `?${q}` : ""}`);
  },

  createOrUpdatePersonTarget: (payload) =>
    request("/person-indicator-targets", {
      method: "POST",
      body: JSON.stringify({
        indicator_id: payload.indicator_id,
        person_id: payload.person_id ?? payload.entity_id,
        target_value: payload.target_value,
        is_active: payload.is_active ?? true,
      }),
    }),

  deletePersonTarget: (id) =>
    request(`/person-indicator-targets/${id}`, {
      method: "DELETE",
    }),

  getPersonCaptureGrid: ({ indicator_id, record_date }) => {
    const q = buildQuery({
      indicator_id,
      record_date,
    });
    return request(`/person-records/grid?${q}`);
  },

  savePersonGrid: ({ indicator_id, record_date, rows }) =>
    request("/person-records/bulk", {
      method: "POST",
      body: JSON.stringify({
        indicator_id,
        record_date,
        rows: (rows || []).map((row) => ({
          person_id: row.person_id ?? row.entity_id,
          value: row.value,
          observation: row.observation,
        })),
      }),
    }),

  getPersonRecords: ({ indicator_id, person_id, year, month } = {}) => {
    const q = buildQuery({
      indicator_id,
      person_id,
      year,
      month,
    });
    return request(`/person-records${q ? `?${q}` : ""}`);
  },

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

  getPersonDashboard: ({ indicator_id, year, month }) => {
    const q = buildQuery({
      indicator_id,
      year,
      month,
    });
    return request(`/dashboard/person?${q}`);
  },

  // Compatibilidad temporal para no romper frontend nuevo
  getEntities: ({ active_only } = {}) => API.getPersons({ active_only }),

  createEntity: (payload) =>
    API.createPerson({
      code: payload.code,
      full_name: payload.name || payload.full_name,
      is_active: payload.is_active,
    }),

  updateEntity: (id, payload) =>
    API.updatePerson(id, {
      code: payload.code,
      full_name: payload.name || payload.full_name,
      is_active: payload.is_active,
    }),

  deleteEntity: (id) => API.deletePerson(id),

  getEntityTargets: ({ indicator_id, entity_id, active_only } = {}) =>
    API.getPersonTargets({
      indicator_id,
      person_id: entity_id,
      active_only,
    }),

  createOrUpdateEntityTarget: (payload) =>
    API.createOrUpdatePersonTarget({
      indicator_id: payload.indicator_id,
      person_id: payload.entity_id ?? payload.person_id,
      target_value: payload.target_value,
      is_active: payload.is_active,
    }),

  deleteEntityTarget: (id) => API.deletePersonTarget(id),

  getEntityCaptureGrid: ({ indicator_id, record_date }) =>
    API.getPersonCaptureGrid({ indicator_id, record_date }),

  saveEntityGrid: ({ indicator_id, record_date, rows }) =>
    API.savePersonGrid({
      indicator_id,
      record_date,
      rows: (rows || []).map((row) => ({
        person_id: row.entity_id ?? row.person_id,
        value: row.value,
        observation: row.observation,
      })),
    }),

  getEntityRecords: ({ indicator_id, entity_id, year, month } = {}) =>
    API.getPersonRecords({
      indicator_id,
      person_id: entity_id,
      year,
      month,
    }),

  getEntityDashboard: ({ indicator_id, year, month }) =>
    API.getPersonDashboard({
      indicator_id,
      year,
      month,
    }),
};

export default API;