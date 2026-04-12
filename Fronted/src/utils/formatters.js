export function formatCompactName(text = "", max = 22) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function formatPercent(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

export function formatPlainNumber(value) {
  return Number(value || 0).toFixed(2);
}

export function formatDateInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function formatShortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatFrequencyLabel(value) {
  if (value === "day") return "Diaria";
  if (value === "week") return "Semanal";
  if (value === "month") return "Mensual";
  return value || "-";
}

export function formatCaptureModeLabel(value) {
  if (value === "single") return "Único";
  if (value === "shifts") return "Turnos";
  return value || "-";
}

export function formatRule(op, value, unit) {
  if (value === "" || value === null || value === undefined) return "-";
  return `${op} ${value}${unit === "número" ? "" : ` ${unit}`}`;
}

export function formatGeneral(value, unit = "%") {
  return `${Number(value || 0).toFixed(2)}${unit === "número" ? "" : ` ${unit}`}`;
}