const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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
    const query = new URLSearchParams();
    if (params.process_id) query.append("process_id", params.process_id);
    if (params.level) query.append("level", params.level);
    const q = query.toString();
    return request(`/indicators${q ? `?${q}` : ""}`);
  },

  createIndicator: (payload) =>
    request("/indicators", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        frequency: payload.frequency,
        capture_mode: payload.capture_mode,
        shifts:
          payload.capture_mode === "single" ? [] : payload.shifts || [],
      }),
    }),

  updateIndicator: (id, payload) =>
    request(`/indicators/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...payload,
        frequency: payload.frequency,
        capture_mode: payload.capture_mode,
        shifts:
          payload.capture_mode === "single" ? [] : payload.shifts || [],
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
    const query = new URLSearchParams();
    query.append("record_date", record_date);
    if (process_id) query.append("process_id", process_id);
    if (level) query.append("level", level);
    return request(`/daily-records/by-date?${query.toString()}`);
  },

  getMonthMatrix: ({ indicator_id, year, month }) => {
    const query = new URLSearchParams();
    query.append("indicator_id", indicator_id);
    query.append("year", year);
    query.append("month", month);
    return request(`/matrix/month?${query.toString()}`);
  },

  saveMonthMatrix: ({ indicator_id, rows }) =>
    request("/matrix/month", {
      method: "POST",
      body: JSON.stringify({ indicator_id, rows }),
    }),

  getMatrixByPerson: ({ indicator_id, year, month }) => {
    const query = new URLSearchParams();
    query.append("indicator_id", indicator_id);
    query.append("year", year);
    query.append("month", month);
    return request(`/matrix/person?${query.toString()}`);
  },

  saveMatrixByPerson: ({ indicator_id, year, month, rows }) =>
    request("/matrix/person", {
      method: "POST",
      body: JSON.stringify({ indicator_id, year, month, rows }),
    }),

  getHistorySummary: ({ year, month, day, level, process_id, indicator_id }) => {
    const query = new URLSearchParams();
    if (year) query.append("year", year);
    if (month) query.append("month", month);
    if (day) query.append("day", day);
    if (level) query.append("level", level);
    if (process_id) query.append("process_id", process_id);
    if (indicator_id) query.append("indicator_id", indicator_id);
    return request(`/history/summary?${query.toString()}`);
  },

  getHistory: ({ year, month, day, level, process_id, indicator_id }) => {
    const query = new URLSearchParams();
    if (year) query.append("year", year);
    if (month) query.append("month", month);
    if (day) query.append("day", day);
    if (level) query.append("level", level);
    if (process_id) query.append("process_id", process_id);
    if (indicator_id) query.append("indicator_id", indicator_id);
    return request(`/history?${query.toString()}`);
  },

  getDashboardOverview: ({ year, month, day, level, period }) => {
    const query = new URLSearchParams();
    if (year) query.append("year", year);
    if (month) query.append("month", month);
    if (day) query.append("day", day);
    if (level) query.append("level", level);
    if (period) query.append("period", period);
    return request(`/dashboard/overview?${query.toString()}`);
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
    const query = new URLSearchParams();
    query.append("process_id", process_id);
    if (indicator_id) query.append("indicator_id", indicator_id);
    if (year) query.append("year", year);
    if (month) query.append("month", month);
    if (day) query.append("day", day);
    if (level) query.append("level", level);
    if (period) query.append("period", period);
    return request(`/dashboard/process?${query.toString()}`);
  },
};

export default API;