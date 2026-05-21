import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  LabelList,
  Scatter,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import API from "../../api";
import {
  formatCompactName,
  formatPercent,
  formatFrequencyLabel,
  formatCaptureModeLabel,
  formatPlainNumber,
  formatRule,
} from "../../utils/formatters";

const CHART_COLORS = {
  navy: "#064e3b",
  blue: "#059669",
  blueSoft: "#86efac",
  blueLight: "#ecfdf5",
  grid: "#d9eee4",
  text: "#0f172a",
  textSoft: "#64748b",
  pending: "#d9f2e3",
  white: "#ffffff",
  ok: "#39a96b",
  okSoft: "rgba(57, 169, 107, 0.12)",
  warning: "#f4c430",
  warningSoft: "rgba(244, 196, 48, 0.14)",
  critical: "#e24b4b",
  criticalSoft: "rgba(226, 75, 75, 0.13)",
  observation: "#6d4cff",
  target: "#047857",
  targetSoft: "rgba(5, 150, 105, 0.10)",
  warningArea: "rgba(244, 196, 48, 0.16)",
  criticalArea: "rgba(226, 75, 75, 0.14)",
  cardBorder: "#dceee6",
  cardShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
  cardShadowSoft: "0 16px 40px rgba(15, 23, 42, 0.06)",
};

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function normalizeGeneralToPercent(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 1) return numeric * 100;
  if (numeric > 100) return 100;
  return numeric;
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (
    normalized === "critical" ||
    normalized === "critico" ||
    normalized === "crítico" ||
    normalized === "red" ||
    normalized === "rojo"
  ) {
    return "critical";
  }

  if (
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "amarillo" ||
    normalized === "yellow"
  ) {
    return "warning";
  }

  return "ok";
}

function getSafeNumericValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getBarColorByStatus(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "critical") return CHART_COLORS.critical;
  if (normalized === "warning") return CHART_COLORS.warning;
  return CHART_COLORS.ok;
}

function getStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "critical") return "CRITICAL";
  if (normalized === "warning") return "WARNING";
  return "OK";
}

function getStatusPillStyles(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "critical") {
    return {
      color: CHART_COLORS.critical,
      background: CHART_COLORS.criticalSoft,
      border: `1px solid rgba(226,75,75,0.20)`,
    };
  }

  if (normalized === "warning") {
    return {
      color: "#9a6b00",
      background: CHART_COLORS.warningSoft,
      border: `1px solid rgba(244,196,48,0.25)`,
    };
  }

  return {
    color: CHART_COLORS.ok,
    background: CHART_COLORS.okSoft,
    border: `1px solid rgba(57,169,107,0.18)`,
  };
}

function isMatchingStatusFilter(status, filterValue) {
  const currentFilter = String(filterValue || "all").toLowerCase();
  if (!currentFilter || currentFilter === "all") return true;
  return normalizeStatus(status) === currentFilter;
}

function safeDisplay(value, formatter = null) {
  if (value === null || value === undefined || value === "") return "N/D";
  if (typeof value === "number" && !Number.isFinite(value)) return "N/D";
  return formatter ? formatter(value) : value;
}

function normalizeObservationText(value) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();

  if (!text) return "";

  if (
    normalized === "n/d" ||
    normalized === "nd" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "sin observación" ||
    normalized === "sin observacion" ||
    normalized === "ninguna" ||
    normalized === "none" ||
    normalized === "null" ||
    normalized === "-"
  ) {
    return "";
  }

  return text;
}

function formatDelta(delta, suffix = "") {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return "N/D";
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}${suffix}`;
}

function formatChartNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  if (Number.isInteger(numeric)) return `${numeric}`;
  if (Math.abs(numeric) >= 100) return numeric.toFixed(1);
  if (Math.abs(numeric) >= 10) return numeric.toFixed(2);
  return numeric.toFixed(2);
}

function getSafeIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.slice(0, 10);
}

function formatDayMonth(value) {
  const iso = getSafeIsoDate(value);
  if (!iso) return "N/D";

  const [, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS_ES[monthIndex] || month;
  return `${Number(day)} ${monthName.slice(0, 3)}`;
}

function formatFullDateEs(value) {
  const iso = getSafeIsoDate(value);
  if (!iso) return "N/D";

  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS_ES[monthIndex] || month;
  return `${Number(day)} de ${monthName} de ${year}`;
}

function sortByIsoDateAsc(list) {
  return [...(Array.isArray(list) ? list : [])].sort(
    (a, b) =>
      new Date(getSafeIsoDate(a?.rawDate || a?.date || a?.record_date)) -
      new Date(getSafeIsoDate(b?.rawDate || b?.date || b?.record_date))
  );
}

function getIndicatorTargetLineValue(indicator) {
  if (!indicator) return null;
  return getSafeNumericValue(indicator.target_value);
}

function getRuleDirection(operator) {
  const op = String(operator || "").trim();
  if (op === "<" || op === "<=") return "down";
  if (op === ">" || op === ">=") return "up";
  return "equal";
}

function clampBetween(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createBandSegment({ key, from, to, color, priority }) {
  const y1 = Number(from);
  const y2 = Number(to);

  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  if (y1 === y2) return null;

  return {
    key,
    y1: Math.min(y1, y2),
    y2: Math.max(y1, y2),
    color,
    priority,
  };
}

function resolveChartDomainMax(processDailySeries, selectedDashboardIndicator) {
  const seriesMax = (Array.isArray(processDailySeries) ? processDailySeries : [])
    .map((item) => Number(item?.value || 0))
    .filter((value) => Number.isFinite(value));

  const ruleValues = [
    selectedDashboardIndicator?.target_value,
    selectedDashboardIndicator?.warning_value,
    selectedDashboardIndicator?.critical_value,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  const rawMax = Math.max(0, ...seriesMax, ...ruleValues);

  if (rawMax <= 0) return 10;
  if (rawMax <= 10) return Math.ceil(rawMax + 2);
  if (rawMax <= 100) return Math.ceil(rawMax * 1.12);
  return Math.ceil(rawMax * 1.1);
}

function buildIndicatorBackgroundBands(indicator, yDomainMax) {
  if (!indicator || !Number.isFinite(Number(yDomainMax)) || Number(yDomainMax) <= 0) {
    return [];
  }

  const max = Number(yDomainMax);
  const min = 0;

  const criticalValue = getSafeNumericValue(indicator.critical_value);
  const criticalDirection = getRuleDirection(indicator.critical_operator);

  const warningValue = getSafeNumericValue(indicator.warning_value);
  const warningDirection = getRuleDirection(indicator.warning_operator);

  const segments = [];

  if (criticalValue !== null && criticalDirection !== "equal") {
    if (criticalDirection === "down") {
      segments.push(
        createBandSegment({
          key: "critical-down",
          from: min,
          to: clampBetween(criticalValue, min, max),
          color: CHART_COLORS.criticalArea,
          priority: 1,
        })
      );
    }

    if (criticalDirection === "up") {
      segments.push(
        createBandSegment({
          key: "critical-up",
          from: clampBetween(criticalValue, min, max),
          to: max,
          color: CHART_COLORS.criticalArea,
          priority: 1,
        })
      );
    }
  }

  if (warningValue !== null && warningDirection !== "equal") {
    if (warningDirection === "down") {
      const lowerBound =
        criticalDirection === "down" && criticalValue !== null
          ? clampBetween(criticalValue, min, max)
          : min;

      const upperBound = clampBetween(warningValue, min, max);

      if (upperBound > lowerBound) {
        segments.push(
          createBandSegment({
            key: "warning-down",
            from: lowerBound,
            to: upperBound,
            color: CHART_COLORS.warningArea,
            priority: 2,
          })
        );
      }
    }

    if (warningDirection === "up") {
      const upperCriticalStart =
        criticalDirection === "up" && criticalValue !== null
          ? clampBetween(criticalValue, min, max)
          : max;

      const warningStart = clampBetween(warningValue, min, max);

      if (upperCriticalStart > warningStart) {
        segments.push(
          createBandSegment({
            key: "warning-up",
            from: warningStart,
            to: upperCriticalStart,
            color: CHART_COLORS.warningArea,
            priority: 2,
          })
        );
      } else if (
        criticalDirection !== "up" ||
        criticalValue === null ||
        warningStart < max
      ) {
        segments.push(
          createBandSegment({
            key: "warning-up-full",
            from: warningStart,
            to: max,
            color: CHART_COLORS.warningArea,
            priority: 2,
          })
        );
      }
    }
  }

  return segments.filter(Boolean).sort((a, b) => a.priority - b.priority);
}

/**
 * CORRECCIÓN CLAVE:
 * 1) row.value
 * 2) row.single_value
 * 3) promedio shifts
 */
function getMeasuredValueFromHistoryRow(row) {
  if (!row) return null;

  const directValue = Number(row.value);
  if (Number.isFinite(directValue)) {
    return directValue;
  }

  const singleValue = Number(row.single_value);
  if (Number.isFinite(singleValue)) {
    return singleValue;
  }

  const values = [];

  if (row.shift_a !== null && row.shift_a !== undefined && row.shift_a !== "") {
    const a = Number(row.shift_a);
    if (Number.isFinite(a)) values.push(a);
  }

  if (row.shift_b !== null && row.shift_b !== undefined && row.shift_b !== "") {
    const b = Number(row.shift_b);
    if (Number.isFinite(b)) values.push(b);
  }

  if (row.shift_c !== null && row.shift_c !== undefined && row.shift_c !== "") {
    const c = Number(row.shift_c);
    if (Number.isFinite(c)) values.push(c);
  }

  if (!values.length) return null;

  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

function getDaysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function getWeekRangeOptions(year, month) {
  const totalDays = getDaysInMonth(year, month);

  const baseWeeks = [
    {
      value: "1",
      label: `Semana 1 (1-${Math.min(7, totalDays)})`,
      start: 1,
      end: Math.min(7, totalDays),
    },
    {
      value: "2",
      label: `Semana 2 (8-${Math.min(14, totalDays)})`,
      start: 8,
      end: Math.min(14, totalDays),
    },
    {
      value: "3",
      label: `Semana 3 (15-${Math.min(21, totalDays)})`,
      start: 15,
      end: Math.min(21, totalDays),
    },
    {
      value: "4",
      label: `Semana 4 (22-${Math.min(28, totalDays)})`,
      start: 22,
      end: Math.min(28, totalDays),
    },
    {
      value: "5",
      label: `Semana 5 (29-${totalDays})`,
      start: 29,
      end: totalDays,
    },
  ].filter((item) => item.start <= totalDays);

  const combos = [
    {
      value: "1-2",
      label: `Semanas 1-2 (1-${Math.min(14, totalDays)})`,
      start: 1,
      end: Math.min(14, totalDays),
    },
    {
      value: "2-3",
      label: `Semanas 2-3 (8-${Math.min(21, totalDays)})`,
      start: 8,
      end: Math.min(21, totalDays),
    },
    {
      value: "3-4",
      label: `Semanas 3-4 (15-${Math.min(28, totalDays)})`,
      start: 15,
      end: Math.min(28, totalDays),
    },
    {
      value: "4-5",
      label: `Semanas 4-5 (22-${totalDays})`,
      start: 22,
      end: totalDays,
    },
  ].filter((item) => item.start <= totalDays && item.start <= item.end);

  return [...baseWeeks, ...combos];
}

function getWeekRangeFromValue(value, year, month) {
  const options = getWeekRangeOptions(year, month);
  return options.find((item) => item.value === value) || null;
}

function filterHistoryRowsByPeriod(historyRows, filter) {
  const rows = Array.isArray(historyRows) ? historyRows : [];
  const period = String(filter?.period || "month");

  const sorted = [...rows].sort(
    (a, b) =>
      new Date(getSafeIsoDate(a.record_date)) -
      new Date(getSafeIsoDate(b.record_date))
  );

  if (period === "day") {
    const selectedDay = Number(filter?.day);
    if (!selectedDay) return sorted;

    return sorted.filter((row) => {
      const iso = getSafeIsoDate(row.record_date);
      if (!iso) return false;
      return Number(iso.slice(8, 10)) === selectedDay;
    });
  }

  if (period === "week") {
    const range = getWeekRangeFromValue(
      filter?.week_segment,
      filter?.year,
      filter?.month
    );

    if (!range) return sorted;

    return sorted.filter((row) => {
      const iso = getSafeIsoDate(row.record_date);
      if (!iso) return false;
      const day = Number(iso.slice(8, 10));
      return day >= range.start && day <= range.end;
    });
  }

  return sorted;
}

function readHistoryRows(historyData) {
  if (Array.isArray(historyData)) return historyData;
  if (Array.isArray(historyData?.rows)) return historyData.rows;
  if (Array.isArray(historyData?.detail)) return historyData.detail;
  if (Array.isArray(historyData?.data)) return historyData.data;
  if (Array.isArray(historyData?.records)) return historyData.records;
  return [];
}

function readHistorySummary(historyData) {
  if (!historyData || Array.isArray(historyData)) return null;

  return (
    historyData.summary ||
    historyData.totals ||
    historyData.resume ||
    historyData.resumen ||
    historyData.kpis ||
    null
  );
}

function getSummaryValue(summary, keys, fallback = 0) {
  if (!summary) return fallback;

  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null) {
      return Number(summary[key] || 0);
    }
  }

  return fallback;
}

function buildDailySeriesFromHistory(historyRows, filter) {
  const filteredRows = filterHistoryRowsByPeriod(historyRows, filter);

  return sortByIsoDateAsc(
    filteredRows.map((item, index) => {
      const recordDate = getSafeIsoDate(item.record_date);
      const realValue = getMeasuredValueFromHistoryRow(item);
      const general = normalizeGeneralToPercent(item.general || 0);
      const status = normalizeStatus(item.status);
      const observation = normalizeObservationText(item.observation);

      return {
        chartIndex: index,
        rawDate: recordDate,
        date: recordDate,
        record_date: recordDate,
        xLabel: formatDayMonth(recordDate),
        fullDateLabel: formatFullDateEs(recordDate),
        shortLabel: formatDayMonth(recordDate),

        value: Number.isFinite(realValue) ? realValue : 0,
        originalValue: Number.isFinite(realValue) ? realValue : null,
        trendValue: Number.isFinite(realValue) ? realValue : 0,

        general,
        unit: item.unit || "",
        status,
        fill: getBarColorByStatus(status),

        source_value: item.value,
        single_value: item.single_value,
        shift_a: item.shift_a,
        shift_b: item.shift_b,
        shift_c: item.shift_c,

        observation,
        hasObservation: !!observation,
        observationMarkerY: Number.isFinite(realValue) ? realValue : 0,

        target_value: item.target_value,
        warning_value: item.warning_value,
        critical_value: item.critical_value,
      };
    })
  ).map((item, sortedIndex) => ({
    ...item,
    chartIndex: sortedIndex,
  }));
}

function PersonProgressLabel(props) {
  const { x, y, width, payload } = props;

  if (!payload) return null;

  const meta = Number(payload.meta || 0);
  const acumulado = Number(payload.acumulado || 0);
  const pendiente = Number(payload.pendiente || 0);

  const label = `Meta ${formatPlainNumber(meta)} | Hecho ${formatPlainNumber(
    acumulado
  )} | Pendiente ${formatPlainNumber(pendiente)}`;

  return (
    <text
      x={x + width + 10}
      y={y + 14}
      fill={CHART_COLORS.text}
      fontSize={12}
      fontWeight={700}
    >
      {label}
    </text>
  );
}

function ObservationMarkerLabel(props) {
  const { x, y, width, payload } = props;
  if (!payload?.hasObservation) return null;

  return (
    <text
      x={x + Number(width || 0) / 2}
      y={y - 20}
      textAnchor="middle"
      fill={CHART_COLORS.observation}
      fontSize={16}
      fontWeight={900}
    >
      *
    </text>
  );
}

function ObservationScatterShape(props) {
  const { cx, cy, payload } = props;
  if (!payload?.hasObservation) return null;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={CHART_COLORS.white}
        stroke={CHART_COLORS.observation}
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={900}
        fill={CHART_COLORS.observation}
      >
        !
      </text>
    </g>
  );
}

function DailyValueTopLabel(props) {
  const { x, y, width, payload } = props;
  if (!payload) return null;

  const value = Number(payload.value || 0);
  const text = formatPlainNumber(value);
  const safeWidth = Number(width || 0);

  return (
    <text
      x={x + safeWidth / 2}
      y={y - 6}
      textAnchor="middle"
      fill={CHART_COLORS.text}
      fontSize={11}
      fontWeight={800}
    >
      {text}
    </text>
  );
}

function TrendLegend({
  selectedDashboardIndicator,
  observationsCount,
  processValueAxisLabel,
  compact = false,
  processName,
  weekRangeLabel,
  showRange = false,
}) {
  const targetValue = getIndicatorTargetLineValue(selectedDashboardIndicator);

  return (
    <div
      style={{
        marginTop: compact ? 10 : 0,
        display: "flex",
        gap: compact ? 14 : 18,
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: compact ? 12 : 13,
        color: CHART_COLORS.text,
      }}
    >
      {processName ? (
        <span>
          <strong>Proceso:</strong> {processName}
        </span>
      ) : null}

      <span>
        <strong>Unidad:</strong> {processValueAxisLabel}
      </span>

      <span>
        <strong>Barras:</strong> valor real por fecha histórica
      </span>

      <span>
        <strong>Línea:</strong> % cumplimiento
      </span>

      <span>
        <strong>Línea punteada/meta:</strong>{" "}
        {targetValue !== null
          ? `meta objetivo (${formatPlainNumber(targetValue)} ${processValueAxisLabel})`
          : "sin meta configurada"}
      </span>

      <span>
        <strong>Fondo amarillo:</strong> warning
      </span>

      <span>
        <strong>Fondo rojo:</strong> critical
      </span>

      <span>
        <strong>* / !</strong> observación
      </span>

      <span>
        <strong>Total observaciones:</strong> {observationsCount}
      </span>

      {showRange && weekRangeLabel ? (
        <span>
          <strong>Rango:</strong> {weekRangeLabel}
        </span>
      ) : null}
    </div>
  );
}

function getVariationRuleOperator(indicator) {
  if (!indicator) return "";

  return String(
    indicator.target_operator ||
      indicator.warning_operator ||
      indicator.critical_operator ||
      ""
  ).trim();
}

function getDirectionalVariation(currentValue, previousValue, indicator) {
  const current = Number(currentValue);
  const previous = Number(previousValue);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  const rawDelta = current - previous;
  const operator = getVariationRuleOperator(indicator);

  if (operator === "<" || operator === "<=") {
    return previous - current;
  }

  return rawDelta;
}

function getVariationColor(delta) {
  if (delta === null || delta === undefined || !Number.isFinite(Number(delta))) {
    return CHART_COLORS.text;
  }

  if (Number(delta) > 0) return CHART_COLORS.ok;
  if (Number(delta) < 0) return CHART_COLORS.critical;
  return CHART_COLORS.text;
}

function ExecutiveIndicatorCard({
  selectedDashboardIndicator,
  selectedPoint,
  processDailySeries,
  processValueAxisLabel,
}) {
  if (!selectedDashboardIndicator) return null;

  const sortedSeries = sortByIsoDateAsc(processDailySeries);
  if (!sortedSeries.length) return null;

  const activePoint = selectedPoint || sortedSeries[sortedSeries.length - 1];

  const activeIndex = sortedSeries.findIndex(
    (item) => Number(item.chartIndex) === Number(activePoint.chartIndex)
  );

  const previousPoint = activeIndex > 0 ? sortedSeries[activeIndex - 1] : null;

  const currentMeasuredValue =
    activePoint?.originalValue !== null && activePoint?.originalValue !== undefined
      ? Number(activePoint.originalValue)
      : null;

  const previousMeasuredValue =
    previousPoint?.originalValue !== null && previousPoint?.originalValue !== undefined
      ? Number(previousPoint.originalValue)
      : null;

  const complianceValue =
    activePoint && Number.isFinite(Number(activePoint.general))
      ? Number(activePoint.general)
      : null;

  const targetValue = getSafeNumericValue(selectedDashboardIndicator.target_value);

  const currentStatus = activePoint
    ? normalizeStatus(activePoint.status)
    : normalizeStatus(selectedDashboardIndicator.status);

  const variationValue = getDirectionalVariation(
    currentMeasuredValue,
    previousMeasuredValue,
    selectedDashboardIndicator
  );

  const currentObservation = normalizeObservationText(activePoint?.observation);
  const statusStyles = getStatusPillStyles(currentStatus);

  const observationTone =
    currentStatus === "critical"
      ? {
          background: "#fff6f6",
          border: "1px solid rgba(226,75,75,0.22)",
          color: CHART_COLORS.critical,
        }
      : currentStatus === "warning"
      ? {
          background: "#fffaf0",
          border: "1px solid rgba(244,196,48,0.28)",
          color: "#946400",
        }
      : {
          background: "#f5fbf8",
          border: "1px solid rgba(57,169,107,0.20)",
          color: CHART_COLORS.ok,
        };

  return (
    <section
      className="chart-card premium-chart-card full-span"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: 24,
        border: `1px solid ${CHART_COLORS.cardBorder}`,
        boxShadow: CHART_COLORS.cardShadow,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          padding: "22px 22px 16px",
          borderBottom: "1px solid #eef3fa",
          background:
            "linear-gradient(180deg, rgba(238,244,255,0.55) 0%, rgba(255,255,255,1) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: CHART_COLORS.textSoft,
                marginBottom: 6,
              }}
            >
              Indicador seleccionado
            </div>

            <h3
              style={{
                margin: 0,
                color: CHART_COLORS.text,
                fontSize: 24,
                lineHeight: 1.12,
              }}
            >
              {selectedDashboardIndicator.code} - {selectedDashboardIndicator.name}
            </h3>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                color: CHART_COLORS.textSoft,
                fontSize: 13,
              }}
            >
              <span>
                Frecuencia:{" "}
                <strong style={{ color: CHART_COLORS.text }}>
                  {safeDisplay(
                    selectedDashboardIndicator.frequency
                      ? formatFrequencyLabel(selectedDashboardIndicator.frequency)
                      : null
                  )}
                </strong>
              </span>
              <span>
                Captura:{" "}
                <strong style={{ color: CHART_COLORS.text }}>
                  {safeDisplay(
                    selectedDashboardIndicator.capture_mode
                      ? formatCaptureModeLabel(
                          selectedDashboardIndicator.capture_mode
                        )
                      : null
                  )}
                </strong>
              </span>
            </div>
          </div>

          <span
            style={{
              ...statusStyles,
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              alignSelf: "flex-start",
            }}
          >
            {safeDisplay(getStatusLabel(currentStatus))}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: 22,
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.55fr) minmax(280px, 1fr)",
          gap: 18,
        }}
      >
        <div
          style={{
            border: "1px solid #edf2f8",
            borderRadius: 22,
            padding: 18,
            background: "#ffffff",
            boxShadow: CHART_COLORS.cardShadowSoft,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: CHART_COLORS.textSoft,
              marginBottom: 14,
            }}
          >
            Bloque izquierda · info principal
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: CHART_COLORS.textSoft,
                  marginBottom: 6,
                }}
              >
                Fecha seleccionada
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: CHART_COLORS.text,
                }}
              >
                {safeDisplay(activePoint?.rawDate, formatDayMonth)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: CHART_COLORS.textSoft,
                  marginBottom: 6,
                }}
              >
                Meta
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: CHART_COLORS.text,
                }}
              >
                {targetValue !== null
                  ? `${formatPlainNumber(targetValue)} ${processValueAxisLabel}`
                  : "N/D"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: CHART_COLORS.textSoft,
                  marginBottom: 6,
                }}
              >
                Valor real
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: CHART_COLORS.text,
                }}
              >
                {currentMeasuredValue !== null
                  ? `${formatPlainNumber(currentMeasuredValue)} ${processValueAxisLabel}`
                  : "N/D"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: CHART_COLORS.textSoft,
                  marginBottom: 6,
                }}
              >
                Variación vs anterior
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: getVariationColor(variationValue),
                }}
              >
                {variationValue !== null
                  ? `${formatDelta(variationValue)} ${processValueAxisLabel}`
                  : "N/D"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #edf2f8",
            borderRadius: 22,
            padding: 18,
            background: "#fbfdff",
            boxShadow: CHART_COLORS.cardShadowSoft,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: CHART_COLORS.textSoft,
              marginBottom: 14,
            }}
          >
            Bloque derecha · KPIs
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#eef4ff",
                color: CHART_COLORS.navy,
                border: "1px solid rgba(36,89,195,0.15)",
                borderRadius: 18,
                padding: "14px 16px",
                minHeight: 84,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(17,42,74,0.04)",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: CHART_COLORS.textSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                % cumplimiento
              </span>
              <strong
                style={{
                  fontSize: 24,
                  lineHeight: 1.1,
                  color: CHART_COLORS.navy,
                }}
              >
                {complianceValue !== null ? formatPercent(complianceValue) : "N/D"}
              </strong>
            </div>

            <div
              style={{
                background: "#ffffff",
                color: CHART_COLORS.text,
                border: `1px solid ${CHART_COLORS.cardBorder}`,
                borderRadius: 18,
                padding: "14px 16px",
                minHeight: 84,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(17,42,74,0.04)",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: CHART_COLORS.textSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Estado
              </span>
              <strong
                style={{
                  fontSize: 24,
                  lineHeight: 1.1,
                  color:
                    currentStatus === "critical"
                      ? CHART_COLORS.critical
                      : currentStatus === "warning"
                      ? "#a16d00"
                      : CHART_COLORS.ok,
                }}
              >
                {safeDisplay(getStatusLabel(currentStatus))}
              </strong>
            </div>

            <div
              style={{
                background: "#ffffff",
                color: CHART_COLORS.text,
                border: `1px solid ${CHART_COLORS.cardBorder}`,
                borderRadius: 18,
                padding: "14px 16px",
                minHeight: 84,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(17,42,74,0.04)",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: CHART_COLORS.textSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Warning rule
              </span>
              <strong
                style={{
                  fontSize: 18,
                  lineHeight: 1.2,
                  color: CHART_COLORS.text,
                }}
              >
                {safeDisplay(
                  formatRule(
                    selectedDashboardIndicator.warning_operator,
                    selectedDashboardIndicator.warning_value,
                    selectedDashboardIndicator.unit || processValueAxisLabel
                  )
                )}
              </strong>
            </div>

            <div
              style={{
                background: "#ffffff",
                color: CHART_COLORS.text,
                border: `1px solid ${CHART_COLORS.cardBorder}`,
                borderRadius: 18,
                padding: "14px 16px",
                minHeight: 84,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(17,42,74,0.04)",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: CHART_COLORS.textSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Critical rule
              </span>
              <strong
                style={{
                  fontSize: 18,
                  lineHeight: 1.2,
                  color: CHART_COLORS.text,
                }}
              >
                {safeDisplay(
                  formatRule(
                    selectedDashboardIndicator.critical_operator,
                    selectedDashboardIndicator.critical_value,
                    selectedDashboardIndicator.unit || processValueAxisLabel
                  )
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {currentObservation && (
        <div
          style={{
            padding: "0 22px 22px",
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: "16px 18px",
              ...observationTone,
              boxShadow: "0 10px 26px rgba(17,42,74,0.05)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
                opacity: 0.9,
              }}
            >
              Bloque abajo · observación
            </div>

            <div
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                fontWeight: 600,
              }}
            >
              {currentObservation}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function StandardTrendTooltip({
  active,
  payload,
  selectedPoint,
  selectedDashboardIndicator,
  processDailySeries,
  processValueAxisLabel,
}) {
  if (!active || !payload?.length) return null;

  // IMPORTANTE:
  // El mensaje debe replicar la misma información del bloque superior.
  // Por eso NO tomamos la barra del hover, sino la barra seleccionada por click.
  const activePoint = selectedPoint || null;
  if (!activePoint) return null;

  const sortedSeries = sortByIsoDateAsc(processDailySeries);
  const activeIndex = sortedSeries.findIndex(
    (item) => Number(item.chartIndex) === Number(activePoint.chartIndex)
  );

  const previousPoint = activeIndex > 0 ? sortedSeries[activeIndex - 1] : null;

  const currentMeasuredValue =
    activePoint?.originalValue !== null && activePoint?.originalValue !== undefined
      ? Number(activePoint.originalValue)
      : null;

  const previousMeasuredValue =
    previousPoint?.originalValue !== null && previousPoint?.originalValue !== undefined
      ? Number(previousPoint.originalValue)
      : null;

  const targetValue =
    getSafeNumericValue(activePoint?.target_value) ??
    getSafeNumericValue(selectedDashboardIndicator?.target_value);

  const variationValue = getDirectionalVariation(
    currentMeasuredValue,
    previousMeasuredValue,
    selectedDashboardIndicator
  );

  const currentObservation = normalizeObservationText(activePoint?.observation);

  const observationTone =
    normalizeStatus(activePoint?.status) === "critical"
      ? {
          background: "#fff6f6",
          border: "1px solid rgba(226,75,75,0.22)",
          color: CHART_COLORS.critical,
        }
      : normalizeStatus(activePoint?.status) === "warning"
      ? {
          background: "#fffaf0",
          border: "1px solid rgba(244,196,48,0.28)",
          color: "#946400",
        }
      : {
          background: "#f5fbf8",
          border: "1px solid rgba(57,169,107,0.20)",
          color: CHART_COLORS.ok,
        };

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${CHART_COLORS.cardBorder}`,
        borderRadius: 20,
        boxShadow: "0 22px 48px rgba(17,42,74,0.18)",
        minWidth: 360,
        maxWidth: 420,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 18px 14px",
          background:
            "linear-gradient(180deg, rgba(238,244,255,0.70) 0%, rgba(255,255,255,1) 100%)",
          borderBottom: "1px solid #eef3fa",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: CHART_COLORS.textSoft,
            marginBottom: 12,
          }}
        >
          Bloque izquierda · info principal
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(135px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: CHART_COLORS.textSoft,
                marginBottom: 5,
              }}
            >
              Fecha seleccionada
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: CHART_COLORS.text,
              }}
            >
              {safeDisplay(activePoint?.rawDate, formatDayMonth)}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                color: CHART_COLORS.textSoft,
                marginBottom: 5,
              }}
            >
              Meta
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: CHART_COLORS.text,
              }}
            >
              {targetValue !== null
                ? `${formatPlainNumber(targetValue)} ${processValueAxisLabel}`
                : "N/D"}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                color: CHART_COLORS.textSoft,
                marginBottom: 5,
              }}
            >
              Valor real
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: CHART_COLORS.text,
              }}
            >
              {currentMeasuredValue !== null
                ? `${formatPlainNumber(currentMeasuredValue)} ${processValueAxisLabel}`
                : "N/D"}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                color: CHART_COLORS.textSoft,
                marginBottom: 5,
              }}
            >
              Variación vs anterior
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: getVariationColor(variationValue),
              }}
            >
              {variationValue !== null
                ? `${formatDelta(variationValue)} ${processValueAxisLabel}`
                : "N/D"}
            </div>
          </div>
        </div>
      </div>

      {currentObservation && (
        <div
          style={{
            padding: 14,
            background: "#fbfdff",
          }}
        >
          <div
            style={{
              borderRadius: 16,
              padding: "12px 14px",
              ...observationTone,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                marginBottom: 6,
                opacity: 0.9,
              }}
            >
              Bloque abajo · observación
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                fontWeight: 700,
              }}
            >
              {currentObservation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderTrendChart({
  isStandardIndicatorSelected,
  processDailySeries,
  dashboardData,
  processValueAxisLabel,
  selectedDashboardIndicator,
  expanded = false,
  selectedTrendIndex = -1,
  onSelectTrendBar = null,
}) {
  if (isStandardIndicatorSelected) {
    const yDomainMax = resolveChartDomainMax(
      processDailySeries,
      selectedDashboardIndicator
    );

    const backgroundBands = buildIndicatorBackgroundBands(
      selectedDashboardIndicator,
      yDomainMax
    );

    const targetLineValue =
      getIndicatorTargetLineValue(selectedDashboardIndicator);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={processDailySeries}
          margin={
            expanded
              ? { top: 38, right: 26, left: 12, bottom: 78 }
              : { top: 28, right: 20, left: 8, bottom: 60 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />

          <XAxis
            dataKey="rawDate"
            type="category"
            allowDuplicatedCategory={false}
            interval={0}
            angle={0}
            textAnchor="middle"
            minTickGap={0}
            height={expanded ? 46 : 40}
            tickFormatter={(value) => formatDayMonth(value)}
            tick={{ fontSize: expanded ? 12 : 11, fill: CHART_COLORS.text }}
            label={
              expanded
                ? {
                    value: "Fecha",
                    position: "insideBottom",
                    offset: -4,
                    fill: CHART_COLORS.text,
                    fontSize: 12,
                    fontWeight: 700,
                  }
                : undefined
            }
          />

          <YAxis
            yAxisId="left"
            domain={[0, yDomainMax]}
            tick={{ fontSize: expanded ? 12 : 11, fill: CHART_COLORS.text }}
            tickFormatter={(value) => formatChartNumber(value)}
            label={
              expanded
                ? {
                    value: processValueAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: CHART_COLORS.text,
                    fontSize: 12,
                    fontWeight: 700,
                  }
                : undefined
            }
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: expanded ? 12 : 11, fill: CHART_COLORS.text }}
            tickFormatter={(value) => `${Number(value)}%`}
            label={
              expanded
                ? {
                    value: "% Cumplimiento",
                    angle: 90,
                    position: "insideRight",
                    fill: CHART_COLORS.text,
                    fontSize: 12,
                    fontWeight: 700,
                  }
                : undefined
            }
          />

          <Tooltip
            cursor={{ fill: "rgba(19,58,107,0.07)" }}
            content={({ active, payload }) => (
              <StandardTrendTooltip
                active={active}
                payload={payload}
                selectedPoint={
                  selectedTrendIndex >= 0 && selectedTrendIndex < processDailySeries.length
                    ? processDailySeries[selectedTrendIndex]
                    : processDailySeries[processDailySeries.length - 1]
                }
                selectedDashboardIndicator={selectedDashboardIndicator}
                processDailySeries={processDailySeries}
                processValueAxisLabel={processValueAxisLabel}
              />
            )}
          />

          {backgroundBands.map((band) => (
            <ReferenceArea
              key={band.key}
              yAxisId="left"
              y1={band.y1}
              y2={band.y2}
              fill={band.color}
              ifOverflow="extendDomain"
            />
          ))}

          {targetLineValue !== null ? (
            <ReferenceLine
              yAxisId="left"
              y={targetLineValue}
              stroke={CHART_COLORS.target}
              strokeWidth={2}
              strokeDasharray="8 6"
              ifOverflow="extendDomain"
              label={{
                value: `Meta: ${formatPlainNumber(targetLineValue)} ${processValueAxisLabel}`,
                position: "insideTopRight",
                fill: CHART_COLORS.target,
                fontSize: expanded ? 12 : 11,
                fontWeight: 800,
              }}
            />
          ) : null}

          <Bar
            yAxisId="left"
            dataKey="value"
            name={processValueAxisLabel}
            radius={[10, 10, 0, 0]}
            maxBarSize={expanded ? 46 : 34}
            onClick={(data, index) => {
              if (typeof onSelectTrendBar === "function") {
                onSelectTrendBar(index, data);
              }
            }}
          >
            {processDailySeries.map((entry, index) => {
              const isSelected = index === selectedTrendIndex;
              return (
                <Cell
                  key={`cell-${entry.rawDate || index}`}
                  fill={entry.fill || CHART_COLORS.ok}
                  stroke={isSelected ? CHART_COLORS.navy : "transparent"}
                  strokeWidth={isSelected ? 3 : 0}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
            <LabelList content={<DailyValueTopLabel />} />
            <LabelList content={<ObservationMarkerLabel />} />
          </Bar>

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="general"
            name="% cumplimiento"
            stroke={CHART_COLORS.navy}
            strokeWidth={3}
            dot={{ r: expanded ? 4 : 3, fill: CHART_COLORS.navy }}
            activeDot={false}
            isAnimationActive={false}
          />

          <Scatter
            yAxisId="left"
            data={processDailySeries.filter((item) => item.hasObservation)}
            dataKey="observationMarkerY"
            shape={<ObservationScatterShape />}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={sortByIsoDateAsc(
          (dashboardData?.trend || []).map((item) => {
            const realDate = getSafeIsoDate(
              item.record_date || item.date || item.label
            );
            return {
              ...item,
              rawDate: realDate,
              date: realDate,
              record_date: realDate,
              xLabel: formatDayMonth(realDate),
              fullDateLabel: formatFullDateEs(realDate),
              shortLabel: formatDayMonth(realDate),
            };
          })
        )}
        margin={{ top: 10, right: 20, left: 0, bottom: 50 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="rawDate"
          interval={0}
          angle={0}
          textAnchor="middle"
          height={40}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatDayMonth(value)}
        />
        <YAxis tickFormatter={(value) => `${value}%`} />
        <Tooltip
          formatter={(value) => formatPercent(value)}
          labelFormatter={(label) => formatFullDateEs(label)}
        />
        <Line
          type="monotone"
          dataKey="value"
          name="Promedio"
          stroke={CHART_COLORS.navy}
          strokeWidth={3}
          dot={{ r: 4, fill: CHART_COLORS.navy }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}


const dashboardWowCss = `
.dashboard-wow-page {
  position: relative;
  min-height: 100%;
  overflow: auto;
  padding: clamp(24px, 2.7vw, 42px);
  color: #0f172a;
  background:
    radial-gradient(circle at 96% 2%, rgba(34,197,94,.13), transparent 28%),
    radial-gradient(circle at 6% 10%, rgba(20,184,166,.08), transparent 26%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(247,252,250,.96));
  scrollbar-width: thin;
  scrollbar-color: rgba(34,197,94,.35) rgba(226,232,240,.45);
}

.dashboard-wow-page::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}

.dashboard-wow-page::-webkit-scrollbar-track {
  background: rgba(226,232,240,.50);
  border-radius: 999px;
}

.dashboard-wow-page::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(34,197,94,.62), rgba(16,185,129,.42));
  border-radius: 999px;
}

.dashboard-wow-page::before {
  content: "";
  position: absolute;
  top: -260px;
  right: -190px;
  width: 720px;
  height: 720px;
  pointer-events: none;
  opacity: .52;
  background:
    radial-gradient(circle at 58% 40%, rgba(34,197,94,.15) 0 2px, transparent 3px),
    radial-gradient(circle at 75% 24%, rgba(16,185,129,.16) 0 3px, transparent 4px),
    radial-gradient(circle at 45% 72%, rgba(20,184,166,.11) 0 5px, transparent 6px),
    repeating-radial-gradient(circle at 78% 58%, transparent 0 45px, rgba(34,197,94,.14) 46px, transparent 47px);
  mask-image: radial-gradient(circle, black, transparent 72%);
}

.dashboard-wow-page::after {
  content: "";
  position: absolute;
  left: -220px;
  bottom: -260px;
  width: 640px;
  height: 640px;
  pointer-events: none;
  opacity: .20;
  background: radial-gradient(circle, rgba(6,78,59,.42), transparent 65%);
}

.dashboard-wow-page > * {
  position: relative;
  z-index: 1;
}

.dashboard-wow-page .dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 20px;
  padding: 0 2px;
  border: 0;
  background: transparent;
}

.dashboard-wow-page .section-kicker {
  color: #059669;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.dashboard-wow-page .dashboard-header h3 {
  margin: 8px 0 0;
  color: #0f172a;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: 950;
}

.dashboard-wow-page .dashboard-header p {
  margin: 12px 0 0;
  color: #64748b;
  font-size: clamp(14px, .95vw, 17px);
  line-height: 1.45;
}

.dashboard-wow-page .dashboard-header-badge {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 999px;
  color: #047857;
  background: rgba(34,197,94,.10);
  border: 1px solid rgba(34,197,94,.22);
  box-shadow: 0 12px 28px rgba(34,197,94,.10);
  font-weight: 950;
}

.dashboard-wow-page .alert {
  margin: 0 0 18px;
  padding: 14px 16px;
  border-radius: 16px;
  color: #166534;
  background: rgba(34,197,94,.08);
  border: 1px solid rgba(34,197,94,.20);
  font-weight: 850;
}

.dashboard-wow-page .filters-card {
  position: relative;
  overflow: hidden;
  padding: 24px !important;
  margin-bottom: 24px;
  border-radius: 24px !important;
  border: 1px solid rgba(34,197,94,.20) !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.10), transparent 30%),
    rgba(255,255,255,.94) !important;
  box-shadow: 0 24px 64px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.92) !important;
}

.dashboard-wow-page .dashboard-filters {
  display: grid;
  grid-template-columns: minmax(190px, 1.25fr) minmax(260px, 1.7fr) repeat(4, minmax(120px, .75fr)) minmax(130px, .78fr);
  gap: 16px;
  align-items: end;
}

.dashboard-wow-page .field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.dashboard-wow-page .field label {
  color: #64748b;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.dashboard-wow-page .field input,
.dashboard-wow-page .field select {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid #dbe8e2;
  background: rgba(255,255,255,.95);
  color: #0f172a;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.85);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease, transform .18s ease;
}

.dashboard-wow-page .field input:focus,
.dashboard-wow-page .field select:focus {
  border-color: rgba(34,197,94,.62);
  box-shadow: 0 0 0 4px rgba(34,197,94,.13);
  background: #fff;
}

.dashboard-wow-page .field input:disabled,
.dashboard-wow-page .field select:disabled {
  color: #94a3b8;
  background: #f1f5f9;
  cursor: not-allowed;
}

.dashboard-wow-page .primary,
.dashboard-wow-page .secondary,
.dashboard-wow-page button {
  font-family: inherit;
}

.dashboard-wow-page .primary {
  height: 46px;
  min-width: 185px;
  border: 0;
  border-radius: 14px;
  color: #fff;
  cursor: pointer;
  font-weight: 950;
  background:
    linear-gradient(135deg, #047857, #16a34a 55%, #22c55e);
  box-shadow: 0 16px 34px rgba(34,197,94,.30);
  transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
}

.dashboard-wow-page .primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 42px rgba(34,197,94,.36);
}

.dashboard-wow-page .primary:disabled {
  opacity: .62;
  cursor: not-allowed;
  transform: none;
}

.dashboard-wow-page .secondary {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 13px;
  border: 1px solid rgba(34,197,94,.20);
  color: #047857;
  background: rgba(34,197,94,.07);
  cursor: pointer;
  font-weight: 900;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}

.dashboard-wow-page .secondary:hover {
  transform: translateY(-1px);
  background: rgba(34,197,94,.11);
  box-shadow: 0 10px 24px rgba(34,197,94,.14);
}

.dashboard-wow-page .process-focus-banner {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  gap: 22px;
  align-items: center;
  margin: 0 0 18px;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(34,197,94,.18);
  background:
    radial-gradient(circle at 98% 15%, rgba(34,197,94,.14), transparent 34%),
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.85));
  box-shadow: 0 20px 52px rgba(15,23,42,.07);
}

.dashboard-wow-page .process-focus-banner h2 {
  margin: 6px 0 0;
  color: #0f172a;
  font-size: clamp(26px, 2.1vw, 40px);
  line-height: 1.05;
  letter-spacing: -.045em;
  font-weight: 950;
}

.dashboard-wow-page .process-focus-banner p {
  margin: 8px 0 0;
  color: #64748b;
}

.dashboard-wow-page .focus-banner-side {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dashboard-wow-page .status-pill {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 999px;
  color: #047857;
  background: rgba(34,197,94,.09);
  border: 1px solid rgba(34,197,94,.20);
  font-weight: 900;
}

.dashboard-wow-page .status-pill.dark {
  color: #064e3b;
  background: rgba(6,78,59,.08);
  border-color: rgba(6,78,59,.14);
}

.dashboard-wow-page .executive-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  margin: 0 0 18px;
}

.dashboard-wow-page .executive-kpi {
  position: relative;
  overflow: hidden;
  min-height: 122px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(226,232,240,.94);
  background: rgba(255,255,255,.92);
  box-shadow: 0 18px 42px rgba(15,23,42,.07);
}

.dashboard-wow-page .executive-kpi::after {
  content: "";
  position: absolute;
  right: -30px;
  top: -30px;
  width: 110px;
  height: 110px;
  border-radius: 999px;
  background: rgba(34,197,94,.10);
}

.dashboard-wow-page .executive-kpi span {
  position: relative;
  z-index: 1;
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.dashboard-wow-page .executive-kpi strong {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 9px;
  color: #059669;
  font-size: clamp(24px, 2vw, 34px);
  line-height: 1;
  font-weight: 950;
}

.dashboard-wow-page .executive-kpi small {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 11px;
  color: #64748b;
  line-height: 1.3;
  font-size: 12px;
}

.dashboard-wow-page .blue-main {
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.18), transparent 38%),
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(236,253,245,.92));
  border-color: rgba(34,197,94,.20);
}

.dashboard-wow-page .chart-card,
.dashboard-wow-page .panel-block,
.dashboard-wow-page .executive-section,
.dashboard-wow-page .dashboard-process-panel {
  border-radius: 24px !important;
  border: 1px solid rgba(226,232,240,.94) !important;
  background:
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.88)) !important;
  box-shadow: 0 22px 60px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.92) !important;
}

.dashboard-wow-page .chart-card,
.dashboard-wow-page .executive-section,
.dashboard-wow-page .dashboard-process-panel {
  padding: 22px;
}

.dashboard-wow-page .dashboard-process-grid,
.dashboard-wow-page .dashboard-overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
  gap: 18px;
  margin-bottom: 18px;
}

.dashboard-wow-page .premium-process-grid {
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, .75fr);
}

.dashboard-wow-page .full-span {
  grid-column: 1 / -1;
}

.dashboard-wow-page .subsection-title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 950;
  letter-spacing: -.01em;
  margin-bottom: 14px;
}

.dashboard-wow-page .chart-container {
  width: 100%;
  min-height: 300px;
}

.dashboard-wow-page .executive-chart {
  height: 340px;
}

.dashboard-wow-page .large-executive-chart {
  height: 380px;
}

.dashboard-wow-page .indicator-summary-grid,
.dashboard-wow-page .indicator-trend-grid,
.dashboard-wow-page .process-overview-grid {
  display: grid;
  gap: 16px;
}

.dashboard-wow-page .indicator-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
}

.dashboard-wow-page .indicator-trend-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.dashboard-wow-page .process-overview-grid {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

.dashboard-wow-page .indicator-summary-card,
.dashboard-wow-page .indicator-trend-card,
.dashboard-wow-page .process-card {
  padding: 18px;
}

.dashboard-wow-page .indicator-card-head,
.dashboard-wow-page .indicator-trend-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.dashboard-wow-page .indicator-code {
  color: #059669;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .08em;
}

.dashboard-wow-page .indicator-name {
  margin-top: 5px;
  color: #0f172a;
  font-weight: 900;
  line-height: 1.25;
}

.dashboard-wow-page .indicator-main-value {
  margin-top: 16px;
  color: #059669;
  font-size: 32px;
  line-height: 1;
  font-weight: 950;
}

.dashboard-wow-page .indicator-main-value.small {
  font-size: 26px;
}

.dashboard-wow-page .indicator-rules {
  display: grid;
  gap: 7px;
  margin-top: 16px;
  color: #64748b;
  font-size: 12px;
}

.dashboard-wow-page .indicator-rules strong {
  color: #0f172a;
}

.dashboard-wow-page .mini-chart {
  height: 95px;
  margin-top: 12px;
}

.dashboard-wow-page .trend-badge {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  color: #047857;
  background: rgba(34,197,94,.10);
  font-size: 11px;
  font-weight: 900;
}

.dashboard-wow-page .trend-badge.down {
  color: #dc2626;
  background: rgba(239,68,68,.10);
}

.dashboard-wow-page .trend-badge.stable {
  color: #b45309;
  background: rgba(245,158,11,.12);
}

.dashboard-wow-page .process-rank-chip {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #047857;
  background: rgba(34,197,94,.10);
  font-weight: 950;
}

.dashboard-wow-page .process-card-title {
  margin-top: 12px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 950;
}

.dashboard-wow-page .process-card-value {
  margin-top: 10px;
  color: #059669;
  font-size: 30px;
  font-weight: 950;
}

.dashboard-wow-page .table-wrap {
  overflow: auto;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.dashboard-wow-page table {
  width: 100%;
  border-collapse: collapse;
}

.dashboard-wow-page th {
  height: 52px;
  padding: 0 16px;
  color: #059669;
  background: rgba(248,250,252,.96);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .06em;
  text-transform: uppercase;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.dashboard-wow-page td {
  height: 56px;
  padding: 0 16px;
  color: #1e293b;
  border-bottom: 1px solid #e5eaf1;
}

.dashboard-wow-page tr:hover td {
  background: rgba(34,197,94,.035);
}

.dashboard-wow-page .empty {
  height: 120px;
  text-align: center;
  color: #94a3b8;
  font-weight: 850;
}

.dashboard-wow-page .status.ok {
  color: #047857;
  background: rgba(34,197,94,.11);
}

.dashboard-wow-page .status.warning {
  color: #b45309;
  background: rgba(245,158,11,.12);
}

.dashboard-wow-page .status.critical {
  color: #dc2626;
  background: rgba(239,68,68,.10);
}

.dashboard-wow-page .recharts-wrapper text {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.dashboard-wow-page .recharts-cartesian-grid line {
  stroke: #dbeee4;
}

@media (max-width: 1500px) {
  .dashboard-wow-page .dashboard-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dashboard-wow-page .executive-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .dashboard-wow-page {
    padding: 24px;
  }

  .dashboard-wow-page .dashboard-header,
  .dashboard-wow-page .process-focus-banner {
    flex-direction: column;
  }

  .dashboard-wow-page .dashboard-filters,
  .dashboard-wow-page .dashboard-process-grid,
  .dashboard-wow-page .dashboard-overview-grid,
  .dashboard-wow-page .premium-process-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-wow-page .executive-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-wow-page .chart-container,
  .dashboard-wow-page .executive-chart,
  .dashboard-wow-page .large-executive-chart {
    min-height: 320px;
    height: 340px;
  }
}

@media (max-width: 720px) {
  .dashboard-wow-page {
    padding: 18px;
  }

  .dashboard-wow-page .dashboard-header h3 {
    font-size: 32px;
  }

  .dashboard-wow-page .filters-card,
  .dashboard-wow-page .chart-card,
  .dashboard-wow-page .panel-block,
  .dashboard-wow-page .executive-section,
  .dashboard-wow-page .dashboard-process-panel {
    border-radius: 18px !important;
    padding: 18px !important;
  }

  .dashboard-wow-page .executive-kpi-grid,
  .dashboard-wow-page .indicator-summary-grid,
  .dashboard-wow-page .indicator-trend-grid,
  .dashboard-wow-page .process-overview-grid {
    grid-template-columns: 1fr;
  }
}


/* ============================================================
   ETO DASHBOARD WOW FINAL - overrides visuales
   ============================================================ */

.dashboard-wow-page {
  padding: clamp(24px, 2.2vw, 38px) !important;
  background:
    radial-gradient(circle at 98% 0%, rgba(34,197,94,.16), transparent 30%),
    radial-gradient(circle at 0% 12%, rgba(5,150,105,.09), transparent 28%),
    linear-gradient(135deg, #ffffff 0%, #f8fbff 44%, #f2fbf7 100%) !important;
}

.dashboard-wow-page::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .34;
  background:
    linear-gradient(115deg, transparent 0 58%, rgba(34,197,94,.06) 58.4%, transparent 59%),
    radial-gradient(circle at 88% 28%, rgba(34,197,94,.09) 0 2px, transparent 3px),
    radial-gradient(circle at 92% 36%, rgba(34,197,94,.12) 0 3px, transparent 4px),
    radial-gradient(circle at 80% 20%, rgba(34,197,94,.08) 0 2px, transparent 3px);
}

.dashboard-wow-page .dashboard-header {
  position: relative;
  z-index: 1;
  margin-bottom: 18px;
  padding: 4px 2px 2px;
}

.dashboard-wow-page .dashboard-header h3 {
  font-size: clamp(34px, 2.7vw, 50px) !important;
  line-height: .98 !important;
  letter-spacing: -.055em !important;
}

.dashboard-wow-page .dashboard-header p {
  max-width: 760px;
  font-size: 15px !important;
  color: #64748b !important;
}

.dashboard-wow-page .dashboard-header-badge {
  height: 38px;
  padding: 0 18px !important;
  display: inline-flex;
  align-items: center;
  border-radius: 999px !important;
  color: #047857 !important;
  border: 1px solid rgba(34,197,94,.24) !important;
  background:
    radial-gradient(circle at 30% 0%, rgba(34,197,94,.18), transparent 52%),
    rgba(255,255,255,.88) !important;
  box-shadow: 0 14px 32px rgba(15,23,42,.07) !important;
}

.dashboard-wow-page .filters-card {
  position: relative;
  z-index: 1;
  margin-bottom: 22px !important;
  padding: 22px !important;
  border-color: rgba(34,197,94,.18) !important;
  background:
    radial-gradient(circle at 98% 0%, rgba(34,197,94,.10), transparent 30%),
    rgba(255,255,255,.92) !important;
  box-shadow:
    0 22px 60px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.90) !important;
  backdrop-filter: blur(12px);
}

.dashboard-wow-page .dashboard-filters {
  display: grid !important;
  grid-template-columns: 1.08fr 1.35fr .62fr .62fr .62fr .72fr .72fr 1fr;
  gap: 14px !important;
  align-items: end !important;
}

.dashboard-wow-page .field label {
  color: #64748b !important;
  font-size: 11px !important;
  font-weight: 950 !important;
  letter-spacing: .08em !important;
  text-transform: uppercase !important;
}

.dashboard-wow-page .field input,
.dashboard-wow-page .field select {
  min-height: 44px !important;
  border-radius: 13px !important;
  border: 1px solid #dbe7f2 !important;
  background: rgba(255,255,255,.90) !important;
  color: #0f172a !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.86) !important;
}

.dashboard-wow-page .field input:focus,
.dashboard-wow-page .field select:focus {
  border-color: rgba(34,197,94,.55) !important;
  box-shadow: 0 0 0 4px rgba(34,197,94,.12) !important;
}

.dashboard-wow-page .primary {
  min-height: 46px !important;
  border-radius: 14px !important;
  color: #fff !important;
  background:
    radial-gradient(circle at 28% 10%, rgba(255,255,255,.24), transparent 28%),
    linear-gradient(135deg, #047857 0%, #059669 45%, #22c55e 100%) !important;
  border: 0 !important;
  box-shadow: 0 16px 34px rgba(34,197,94,.29) !important;
  font-weight: 950 !important;
}

.dashboard-wow-page .secondary {
  border-radius: 14px !important;
  border: 1px solid rgba(34,197,94,.18) !important;
  color: #047857 !important;
  background: rgba(34,197,94,.07) !important;
  font-weight: 950 !important;
}

.dashboard-wow-page .process-focus-banner {
  position: relative;
  z-index: 1;
  border-radius: 24px !important;
  border: 1px solid rgba(34,197,94,.20) !important;
  background:
    radial-gradient(circle at 94% 4%, rgba(34,197,94,.14), transparent 33%),
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.62)) !important;
  box-shadow: 0 20px 48px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.92) !important;
}

.dashboard-wow-page .process-focus-banner h2 {
  font-size: clamp(30px, 2.5vw, 44px) !important;
  letter-spacing: -.055em !important;
}

.dashboard-wow-page .status-pill {
  color: #047857 !important;
  background: rgba(34,197,94,.09) !important;
  border: 1px solid rgba(34,197,94,.22) !important;
  box-shadow: 0 10px 24px rgba(34,197,94,.08) !important;
}

.dashboard-wow-page .status-pill.dark {
  color: #064e3b !important;
  background: rgba(236,253,245,.80) !important;
}

.dashboard-wow-page .clean-kpis {
  position: relative;
  z-index: 1;
  gap: 14px !important;
}

.dashboard-wow-page .executive-kpi {
  min-height: 112px !important;
  border-radius: 20px !important;
  border: 1px solid rgba(226,232,240,.96) !important;
  background:
    radial-gradient(circle at 96% 6%, rgba(34,197,94,.12), transparent 34%),
    rgba(255,255,255,.94) !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.075) !important;
}

.dashboard-wow-page .executive-kpi::before {
  content: "";
  position: absolute;
  left: 0;
  top: 16px;
  bottom: 16px;
  width: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, #059669, #22c55e);
}

.dashboard-wow-page .executive-kpi span {
  color: #64748b !important;
  font-size: 11px !important;
  letter-spacing: .08em !important;
}

.dashboard-wow-page .executive-kpi strong {
  color: #047857 !important;
  font-size: clamp(27px, 2vw, 36px) !important;
  letter-spacing: -.04em !important;
}

.dashboard-wow-page .executive-kpi small {
  color: #64748b !important;
}

.dashboard-wow-page .premium-chart-card,
.dashboard-wow-page .panel-block,
.dashboard-wow-page .executive-section {
  position: relative;
  z-index: 1;
  border-radius: 24px !important;
  border: 1px solid rgba(226,232,240,.96) !important;
  background:
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,255,255,.92)) !important;
  box-shadow:
    0 22px 54px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92) !important;
}

.dashboard-wow-page .full-span {
  grid-column: 1 / -1;
}

.dashboard-wow-page .dashboard-process-grid,
.dashboard-wow-page .premium-process-grid {
  position: relative;
  z-index: 1;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, .55fr) !important;
  gap: 18px !important;
}

.dashboard-wow-page .premium-process-grid .premium-chart-card:first-child {
  min-height: 390px;
}

.dashboard-wow-page .subsection-title {
  color: #0f172a !important;
  font-size: 15px !important;
  font-weight: 950 !important;
}

.dashboard-wow-page .chart-container {
  min-height: 330px !important;
}

.dashboard-wow-page .executive-chart {
  min-height: 330px !important;
}

.dashboard-wow-page .donut-card .chart-container {
  min-height: 330px !important;
}

.dashboard-wow-page .indicator-summary-grid,
.dashboard-wow-page .indicator-trend-grid {
  gap: 16px !important;
}

.dashboard-wow-page .clean-indicator-card,
.dashboard-wow-page .clean-trend-card {
  overflow: hidden;
  border-radius: 22px !important;
  border: 1px solid rgba(226,232,240,.96) !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(34,197,94,.10), transparent 30%),
    rgba(255,255,255,.96) !important;
}

.dashboard-wow-page .indicator-main-value {
  color: #047857 !important;
}

.dashboard-wow-page .trend-badge {
  border: 1px solid rgba(34,197,94,.18) !important;
  background: rgba(34,197,94,.08) !important;
  color: #047857 !important;
}

.dashboard-wow-page .dashboard-overview-grid {
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, .75fr) !important;
}

@media (max-width: 1500px) {
  .dashboard-wow-page .dashboard-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 1180px) {
  .dashboard-wow-page .dashboard-filters,
  .dashboard-wow-page .dashboard-process-grid,
  .dashboard-wow-page .premium-process-grid,
  .dashboard-wow-page .dashboard-overview-grid {
    grid-template-columns: 1fr !important;
  }

  .dashboard-wow-page .executive-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .dashboard-wow-page {
    padding: 18px !important;
  }

  .dashboard-wow-page .executive-kpi-grid {
    grid-template-columns: 1fr !important;
  }

  .dashboard-wow-page .dashboard-header,
  .dashboard-wow-page .process-focus-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;

export default function DashboardView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [indicatorHistoryRows, setIndicatorHistoryRows] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [isTrendExpanded, setIsTrendExpanded] = useState(false);
  const [selectedTrendIndex, setSelectedTrendIndex] = useState(-1);

  const [dashboardFilter, setDashboardFilter] = useState({
    process_id: "",
    indicator_id: "",
    year: new Date().getFullYear(),
    month: "",
    day: "",
    level: "",
    period: "month",
    week_segment: "",
    status_filter: "all",
  });

  const filteredIndicatorsForDashboard = useMemo(() => {
    if (!dashboardFilter.process_id) return [];
    return indicators.filter(
      (item) => String(item.process_id) === String(dashboardFilter.process_id)
    );
  }, [dashboardFilter.process_id, indicators]);

  const selectedDashboardIndicator = useMemo(() => {
    if (!dashboardFilter.indicator_id) return null;
    return indicators.find(
      (item) => String(item.id) === String(dashboardFilter.indicator_id)
    );
  }, [dashboardFilter.indicator_id, indicators]);

  const isStandardIndicatorSelected =
    !!selectedDashboardIndicator &&
    selectedDashboardIndicator.scope_type !== "entity";

  const weekRangeOptions = useMemo(() => {
    if (!dashboardFilter.year || !dashboardFilter.month) return [];
    return getWeekRangeOptions(dashboardFilter.year, dashboardFilter.month);
  }, [dashboardFilter.year, dashboardFilter.month]);

  async function handleLoadDashboard(e) {
    if (e) e.preventDefault();

    try {
      setLoading(true);
      setMessage("");
      setIsTrendExpanded(false);
      setIndicatorHistoryRows([]);
      setHistorySummary(null);
      setSelectedTrendIndex(-1);

      const filters = {
        ...dashboardFilter,
        level: Number(accessLevel),
      };

      if (filters.period === "week" && (!filters.year || !filters.month)) {
        throw new Error("Para vista semanal debes seleccionar año y mes.");
      }

      if (filters.period === "week" && !filters.week_segment) {
        throw new Error(
          "Selecciona la semana o rango de semanas que deseas visualizar."
        );
      }

      if (filters.period === "day" && !filters.day) {
        throw new Error("Para vista por día debes indicar el día.");
      }

      if (filters.indicator_id) {
        const selectedIndicator = indicators.find(
          (item) => String(item.id) === String(filters.indicator_id)
        );

        if (selectedIndicator?.scope_type === "entity") {
          if (!filters.year || !filters.month) {
            throw new Error(
              "Para dashboard por entidad debes seleccionar año y mes."
            );
          }

          const data = await API.getEntityDashboard({
            indicator_id: Number(filters.indicator_id),
            year: Number(filters.year),
            month: Number(filters.month),
          });

          setDashboardData({
            ...data,
            is_entity_dashboard: true,
          });
          setDashboardOverview(null);
          return;
        }
      }

      if (filters.process_id) {
        const selectedIndicator = filters.indicator_id
          ? indicators.find(
              (item) => String(item.id) === String(filters.indicator_id)
            )
          : null;

        const isStandardSelected =
          !!selectedIndicator && selectedIndicator.scope_type !== "entity";

        const processRequest = API.getProcessDashboard(filters);

        let historyRequest = Promise.resolve(null);
        let historySummaryRequest = Promise.resolve(null);

        if (filters.indicator_id && isStandardSelected) {
          const historyParams = {
            year: filters.year ? Number(filters.year) : undefined,
            month:
              filters.month && filters.period !== "year"
                ? Number(filters.month)
                : undefined,
            day:
              filters.period === "day" && filters.day
                ? Number(filters.day)
                : undefined,
            level: Number(accessLevel),
            process_id: Number(filters.process_id),
            indicator_id: Number(filters.indicator_id),
          };

          historyRequest = API.getHistory(historyParams);
          historySummaryRequest = API.getHistorySummary(historyParams);
        }

        const [processData, historyData, historySummaryData] = await Promise.all([
          processRequest,
          historyRequest,
          historySummaryRequest,
        ]);

        setDashboardData({
          ...processData,
          is_entity_dashboard: false,
        });

        setIndicatorHistoryRows(readHistoryRows(historyData));
        setHistorySummary(historySummaryData || readHistorySummary(historyData));
        setDashboardOverview(null);
      } else {
        const overview = await API.getDashboardOverview(filters);
        setDashboardOverview(overview);
        setDashboardData(null);
        setIndicatorHistoryRows([]);
        setHistorySummary(null);
      }
    } catch (err) {
      setMessage(err.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const dashboardPieData = useMemo(() => {
    if (isStandardIndicatorSelected && historySummary) {
      const source = [
        {
          name: "OK",
          normalizedStatus: "ok",
          value: Number(historySummary.ok_count || 0),
        },
        {
          name: "WARNING",
          normalizedStatus: "warning",
          value: Number(historySummary.warning_count || 0),
        },
        {
          name: "CRITICAL",
          normalizedStatus: "critical",
          value: Number(historySummary.critical_count || 0),
        },
      ].filter((item) =>
        isMatchingStatusFilter(item.normalizedStatus, dashboardFilter.status_filter)
      );

      const total = source.reduce((acc, item) => acc + Number(item.value || 0), 0);

      return source
        .filter((item) => Number(item.value || 0) > 0)
        .map((item) => ({
          ...item,
          percentage: total
            ? ((Number(item.value || 0) / total) * 100).toFixed(1)
            : "0.0",
          fill: getBarColorByStatus(item.normalizedStatus),
        }));
    }

    const source =
      dashboardData?.status_distribution ||
      dashboardOverview?.status_distribution ||
      [];

    const normalizedSource = source
      .map((item) => ({
        ...item,
        normalizedStatus: normalizeStatus(item.name),
      }))
      .filter((item) =>
        isMatchingStatusFilter(item.normalizedStatus, dashboardFilter.status_filter)
      );

    const total = normalizedSource.reduce(
      (acc, item) => acc + Number(item.value || 0),
      0
    );

    return normalizedSource
      .filter((x) => Number(x.value || 0) > 0)
      .map((item) => ({
        ...item,
        name: getStatusLabel(item.normalizedStatus),
        percentage: total
          ? ((Number(item.value || 0) / total) * 100).toFixed(1)
          : "0.0",
        fill: getBarColorByStatus(item.normalizedStatus),
      }));
  }, [
    dashboardData,
    dashboardOverview,
    dashboardFilter.status_filter,
    historySummary,
    isStandardIndicatorSelected,
  ]);

  const globalRankingData = useMemo(() => {
    return (dashboardOverview?.process_ranking || [])
      .map((item) => {
        const value = Number(item.value || 0);

        let derivedStatus = "ok";
        if (value < 60) derivedStatus = "critical";
        else if (value < 80) derivedStatus = "warning";

        return {
          ...item,
          value,
          status: normalizeStatus(item.status || derivedStatus),
          label: `${value.toFixed(2)}%`,
        };
      })
      .filter((item) =>
        isMatchingStatusFilter(item.status, dashboardFilter.status_filter)
      );
  }, [dashboardOverview, dashboardFilter.status_filter]);

  const entityDashboardBarData = useMemo(() => {
    if (!dashboardData?.is_entity_dashboard || !dashboardData?.ranking?.length) {
      return [];
    }

    return dashboardData.ranking
      .map((item) => ({
        name: formatCompactName(item.entity_name, 20),
        fullName: item.entity_name,
        meta: Number(item.target_value || 0),
        acumulado: Number(item.accumulated || 0),
        pendiente: Math.max(Number(item.remaining || 0), 0),
        cumplimiento: Number(item.compliance || 0),
        estado: normalizeStatus(item.status),
        entityCode: item.entity_code,
        entityType: item.entity_type || "",
      }))
      .filter((item) =>
        isMatchingStatusFilter(item.estado, dashboardFilter.status_filter)
      );
  }, [dashboardData, dashboardFilter.status_filter]);

  const entityDashboardChartHeight = useMemo(() => {
    const rows = entityDashboardBarData.length;
    return Math.max(420, rows * 48);
  }, [entityDashboardBarData]);

  const processDailySeriesRaw = useMemo(() => {
    if (!dashboardData || dashboardData?.is_entity_dashboard) return [];

    if (isStandardIndicatorSelected) {
      if (!indicatorHistoryRows.length) return [];
      return buildDailySeriesFromHistory(indicatorHistoryRows, dashboardFilter);
    }

    return sortByIsoDateAsc(
      (dashboardData?.trend || []).map((item) => {
        const numericValue = Number(item.value || 0);
        const status = normalizeStatus(item.status || "ok");
        const realDate = getSafeIsoDate(
          item.record_date || item.date || item.label
        );

        return {
          rawDate: realDate,
          date: realDate,
          record_date: realDate,
          xLabel: formatDayMonth(realDate),
          fullDateLabel: formatFullDateEs(realDate),
          shortLabel: formatDayMonth(realDate),
          value: Number.isFinite(numericValue) ? numericValue : 0,
          originalValue: Number.isFinite(numericValue) ? numericValue : null,
          trendValue: Number.isFinite(numericValue) ? numericValue : 0,
          general: normalizeGeneralToPercent(item.general ?? item.value ?? 0),
          status,
          fill: getBarColorByStatus(status),
          observation: normalizeObservationText(item.observation),
          hasObservation: !!normalizeObservationText(item.observation),
          observationMarkerY: Number.isFinite(numericValue) ? numericValue : 0,
        };
      })
    );
  }, [
    dashboardData,
    indicatorHistoryRows,
    isStandardIndicatorSelected,
    dashboardFilter,
  ]);

  const processDailySeries = useMemo(() => {
    return processDailySeriesRaw.filter((item) =>
      isMatchingStatusFilter(item.status, dashboardFilter.status_filter)
    );
  }, [processDailySeriesRaw, dashboardFilter.status_filter]);

  useEffect(() => {
    if (!processDailySeries.length) {
      setSelectedTrendIndex(-1);
      return;
    }

    if (
      selectedTrendIndex < 0 ||
      selectedTrendIndex >= processDailySeries.length
    ) {
      setSelectedTrendIndex(processDailySeries.length - 1);
    }
  }, [processDailySeries, selectedTrendIndex]);

  const selectedTrendPoint = useMemo(() => {
    if (!processDailySeries.length) return null;

    if (
      selectedTrendIndex >= 0 &&
      selectedTrendIndex < processDailySeries.length
    ) {
      return processDailySeries[selectedTrendIndex];
    }

    return processDailySeries[processDailySeries.length - 1];
  }, [processDailySeries, selectedTrendIndex]);

  const processValueAxisLabel = useMemo(() => {
    if (!selectedDashboardIndicator) return "Valor";
    return selectedDashboardIndicator.unit || "Valor";
  }, [selectedDashboardIndicator]);

  const weekRangeLabel = useMemo(() => {
    const match = weekRangeOptions.find(
      (item) => item.value === dashboardFilter.week_segment
    );
    return match?.label || "Semana";
  }, [weekRangeOptions, dashboardFilter.week_segment]);

  const dashboardAverageGeneral = useMemo(() => {
    if (historySummary) {
      return getSummaryValue(
        historySummary,
        ["average_general", "promedio_general", "general_average", "average"],
        Number(dashboardData?.summary?.average_general || 0)
      );
    }

    return Number(dashboardData?.summary?.average_general || 0);
  }, [historySummary, dashboardData]);

  const dashboardTotalRecords = useMemo(() => {
    if (historySummary) {
      return getSummaryValue(
        historySummary,
        ["total_records", "records", "registros", "total"],
        Number(dashboardData?.summary?.total_records || 0)
      );
    }

    return Number(dashboardData?.summary?.total_records || 0);
  }, [historySummary, dashboardData]);

  const dashboardOkCount = useMemo(() => {
    if (historySummary) {
      return getSummaryValue(
        historySummary,
        ["ok_count", "ok", "total_ok"],
        Number(dashboardData?.summary?.ok_count || 0)
      );
    }

    return Number(dashboardData?.summary?.ok_count || 0);
  }, [historySummary, dashboardData]);

  const dashboardWarningCount = useMemo(() => {
    if (historySummary) {
      return getSummaryValue(
        historySummary,
        ["warning_count", "warning", "warnings", "total_warning"],
        Number(dashboardData?.summary?.warning_count || 0)
      );
    }

    return Number(dashboardData?.summary?.warning_count || 0);
  }, [historySummary, dashboardData]);

  const dashboardCriticalCount = useMemo(() => {
    if (historySummary) {
      return getSummaryValue(
        historySummary,
        ["critical_count", "critical", "criticals", "total_critical"],
        Number(dashboardData?.summary?.critical_count || 0)
      );
    }

    return Number(dashboardData?.summary?.critical_count || 0);
  }, [historySummary, dashboardData]);

  const observationsCount = useMemo(() => {
    return processDailySeries.filter((item) => item.hasObservation).length;
  }, [processDailySeries]);

  const entitySummaryFiltered = useMemo(() => {
    const source = dashboardData?.summary || {};

    if (!dashboardData?.is_entity_dashboard) return null;

    if (dashboardFilter.status_filter === "ok") {
      return {
        average_compliance: source.average_compliance,
        total_entities: entityDashboardBarData.length,
        ok_count: entityDashboardBarData.length,
        warning_count: 0,
        critical_count: 0,
      };
    }

    if (dashboardFilter.status_filter === "warning") {
      return {
        average_compliance: source.average_compliance,
        total_entities: entityDashboardBarData.length,
        ok_count: 0,
        warning_count: entityDashboardBarData.length,
        critical_count: 0,
      };
    }

    if (dashboardFilter.status_filter === "critical") {
      return {
        average_compliance: source.average_compliance,
        total_entities: entityDashboardBarData.length,
        ok_count: 0,
        warning_count: 0,
        critical_count: entityDashboardBarData.length,
      };
    }

    return {
      average_compliance: source.average_compliance,
      total_entities: source.total_entities,
      ok_count: source.ok_count,
      warning_count: source.warning_count,
      critical_count: source.critical_count,
    };
  }, [dashboardData, entityDashboardBarData, dashboardFilter.status_filter]);

  return (
    <section className="dashboard-wow-page dashboard-master-card">
      <style>{dashboardWowCss}</style>
      <div className="card-header-block dashboard-header">
        <div>
          <div className="section-kicker">ANALÍTICA EJECUTIVA</div>
          <h3>Dashboard corporativo</h3>
          <p>
            Vista global por procesos o análisis detallado por proceso con
            tendencia y distribución ejecutiva.
          </p>
        </div>
        <div className="dashboard-header-badge">Nivel {accessLevel}</div>
      </div>

      {message && <div className="alert">{message}</div>}

      <form
        onSubmit={handleLoadDashboard}
        className="filters-card"
        style={{
          borderRadius: 24,
          border: `1px solid ${CHART_COLORS.cardBorder}`,
          boxShadow: CHART_COLORS.cardShadowSoft,
          background: "#ffffff",
        }}
      >
        <div className="inline-form-grid dashboard-filters">
          <div className="field">
            <label>Proceso</label>
            <select
              value={dashboardFilter.process_id}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  process_id: e.target.value,
                  indicator_id: "",
                })
              }
            >
              <option value="">Todos los procesos</option>
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
              value={dashboardFilter.indicator_id}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  indicator_id: e.target.value,
                })
              }
              disabled={!dashboardFilter.process_id}
            >
              <option value="">Todos los indicadores</option>
              {filteredIndicatorsForDashboard.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Año</label>
            <input
              type="number"
              value={dashboardFilter.year}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  year: e.target.value,
                  week_segment: "",
                })
              }
              placeholder="2026"
            />
          </div>

          <div className="field">
            <label>Mes</label>
            <input
              type="number"
              value={dashboardFilter.month}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  month: e.target.value,
                  week_segment: "",
                  day: "",
                })
              }
              placeholder="1-12"
            />
          </div>

          <div className="field">
            <label>Día</label>
            <input
              type="number"
              value={dashboardFilter.day}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  day: e.target.value,
                })
              }
              placeholder="1-31"
              disabled={dashboardFilter.period !== "day"}
            />
          </div>

          <div className="field">
            <label>Nivel</label>
            <input value={`Nivel ${accessLevel}`} disabled />
          </div>

          <div className="field">
            <label>Vista rápida</label>
            <select
              value={dashboardFilter.period}
              onChange={(e) => {
                const nextPeriod = e.target.value;
                setDashboardFilter({
                  ...dashboardFilter,
                  period: nextPeriod,
                  day: nextPeriod === "day" ? dashboardFilter.day : "",
                  week_segment:
                    nextPeriod === "week" ? dashboardFilter.week_segment : "",
                });
              }}
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </div>

          <div className="field">
            <label>Filtro por estado</label>
            <select
              value={dashboardFilter.status_filter}
              onChange={(e) =>
                setDashboardFilter({
                  ...dashboardFilter,
                  status_filter: e.target.value,
                })
              }
            >
              <option value="all">Todos</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {dashboardFilter.period === "week" && (
            <div className="field">
              <label>Semana / rango</label>
              <select
                value={dashboardFilter.week_segment}
                onChange={(e) =>
                  setDashboardFilter({
                    ...dashboardFilter,
                    week_segment: e.target.value,
                  })
                }
                disabled={!dashboardFilter.year || !dashboardFilter.month}
              >
                <option value="">Seleccionar</option>
                {weekRangeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field action-field">
            <label>&nbsp;</label>
            <button className="primary" disabled={loading}>
              {loading ? "Cargando..." : "Cargar dashboard"}
            </button>
          </div>
        </div>
      </form>

      {dashboardOverview && (
        <>
          <section className="executive-kpi-grid clean-kpis">
            <div className="executive-kpi blue-main">
              <span>Promedio general</span>
              <strong>
                {safeDisplay(
                  dashboardOverview?.summary?.average_general,
                  formatPercent
                )}
              </strong>
              <small>Consolidado de todos los procesos</small>
            </div>

            <div className="executive-kpi blue-neutral">
              <span>Registros</span>
              <strong>{safeDisplay(dashboardOverview?.summary?.total_records)}</strong>
              <small>Volumen total analizado</small>
            </div>

            <div className="executive-kpi blue-neutral">
              <span>OK</span>
              <strong>{safeDisplay(dashboardOverview?.summary?.ok_count)}</strong>
              <small>En rango esperado</small>
            </div>

            <div className="executive-kpi blue-neutral">
              <span>Warning</span>
              <strong>{safeDisplay(dashboardOverview?.summary?.warning_count)}</strong>
              <small>Con seguimiento</small>
            </div>

            <div className="executive-kpi blue-neutral">
              <span>Critical</span>
              <strong>{safeDisplay(dashboardOverview?.summary?.critical_count)}</strong>
              <small>Atención prioritaria</small>
            </div>
          </section>

          <div className="dashboard-overview-grid premium-overview">
            <section
              className="chart-card premium-chart-card"
              style={{
                borderRadius: 24,
                border: `1px solid ${CHART_COLORS.cardBorder}`,
                boxShadow: CHART_COLORS.cardShadow,
                background: "#ffffff",
              }}
            >
              <div className="subsection-title">Ranking de procesos</div>
              <div className="chart-container executive-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalRankingData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                    barCategoryGap={28}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.grid}
                    />
                    <XAxis type="number" tickFormatter={(value) => `${value}%`} />
                    <YAxis dataKey="name" type="category" width={140} />
                    <Tooltip formatter={(value) => formatPercent(value)} />
                    <Bar
                      dataKey="value"
                      name="Promedio"
                      fill={CHART_COLORS.blue}
                      radius={[12, 12, 12, 12]}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(value) => formatPercent(value)}
                        style={{
                          fill: CHART_COLORS.text,
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section
              className="chart-card premium-chart-card donut-card"
              style={{
                borderRadius: 24,
                border: `1px solid ${CHART_COLORS.cardBorder}`,
                boxShadow: CHART_COLORS.cardShadow,
                background: "#ffffff",
              }}
            >
              <div className="subsection-title">Distribución de estados</div>
              <div className="chart-container executive-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardPieData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={92}
                      innerRadius={58}
                      paddingAngle={4}
                      cornerRadius={10}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {dashboardPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, item) =>
                        `${value} (${item?.payload?.percentage || 0}%)`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="dashboard-process-panel">
            <div className="subsection-title">Vista ejecutiva por proceso</div>
            <div className="process-overview-grid compact-process-grid">
              {(dashboardOverview.process_cards || [])
                .map((item) => {
                  const value = Number(item.average_general || 0);

                  let derivedStatus = "ok";
                  if (value < 60) derivedStatus = "critical";
                  else if (value < 80) derivedStatus = "warning";

                  return {
                    ...item,
                    status: normalizeStatus(item.status || derivedStatus),
                  };
                })
                .filter((item) =>
                  isMatchingStatusFilter(
                    item.status,
                    dashboardFilter.status_filter
                  )
                )
                .map((item, index) => (
                  <div
                    key={item.process_name}
                    className="process-card executive-process-card clean-process-card"
                    style={{
                      borderRadius: 22,
                      border: `1px solid ${CHART_COLORS.cardBorder}`,
                      boxShadow: CHART_COLORS.cardShadowSoft,
                      background: "#ffffff",
                    }}
                  >
                    <div className="process-rank-chip">#{index + 1}</div>
                    <div className="process-card-title">
                      {safeDisplay(item.process_name)}
                    </div>
                    <div className="process-card-value big-percent">
                      {safeDisplay(item.average_general, formatPercent)}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {dashboardData && (
        <>
          {dashboardData?.is_entity_dashboard ? (
            <>
              <section className="process-focus-banner">
                <div>
                  <div className="section-kicker">INDICADOR POR ENTIDAD</div>
                  <h2>
                    {safeDisplay(dashboardData.indicator_code)} -{" "}
                    {safeDisplay(dashboardData.indicator_name)}
                  </h2>
                  <p>Ranking mensual por cumplimiento individual.</p>
                </div>
                <div className="focus-banner-side">
                  <span className="status-pill dark">
                    {safeDisplay(dashboardData.period_label)}
                  </span>
                </div>
              </section>

              <section className="executive-kpi-grid clean-kpis">
                <div className="executive-kpi blue-main">
                  <span>Promedio cumplimiento</span>
                  <strong>
                    {safeDisplay(
                      entitySummaryFiltered?.average_compliance,
                      formatPercent
                    )}
                  </strong>
                  <small>Promedio del indicador por entidad</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Total entidades</span>
                  <strong>{safeDisplay(entitySummaryFiltered?.total_entities)}</strong>
                  <small>Entidades evaluadas</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>OK</span>
                  <strong>{safeDisplay(entitySummaryFiltered?.ok_count)}</strong>
                  <small>Cumplen meta</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Warning</span>
                  <strong>{safeDisplay(entitySummaryFiltered?.warning_count)}</strong>
                  <small>En seguimiento</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Critical</span>
                  <strong>{safeDisplay(entitySummaryFiltered?.critical_count)}</strong>
                  <small>Prioridad alta</small>
                </div>
              </section>

              <section
                className="chart-card premium-chart-card full-span"
                style={{
                  borderRadius: 26,
                  border: `1px solid ${CHART_COLORS.cardBorder}`,
                  boxShadow: CHART_COLORS.cardShadow,
                  background:
                    "linear-gradient(180deg, rgba(247,250,255,0.9) 0%, rgba(255,255,255,1) 100%)",
                }}
              >
                <div
                  className="subsection-title"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>Avance por entidad frente a la meta</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: CHART_COLORS.textSoft,
                      background: "#f3f7fd",
                      border: "1px solid #e2ebf6",
                      padding: "6px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Estilo ejecutivo · vista tipo Power BI
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: 560,
                    overflowY: "auto",
                    overflowX: "hidden",
                    paddingRight: 6,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${entityDashboardChartHeight}px`,
                      minHeight: 420,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={entityDashboardBarData}
                        layout="vertical"
                        margin={{ top: 20, right: 240, left: 24, bottom: 20 }}
                        barCategoryGap={12}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={170}
                          interval={0}
                          tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload?.[0]?.payload || {};

                            return (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #dfe9f5",
                                  borderRadius: 16,
                                  padding: "14px 16px",
                                  boxShadow: "0 18px 36px rgba(18,42,74,0.14)",
                                  minWidth: 280,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: CHART_COLORS.text,
                                    marginBottom: 10,
                                  }}
                                >
                                  {safeDisplay(row.fullName || label)}
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gap: 6,
                                    fontSize: 13,
                                    color: CHART_COLORS.text,
                                  }}
                                >
                                  <div>
                                    <strong>Tipo:</strong>{" "}
                                    {safeDisplay(row.entityType)}
                                  </div>
                                  <div>
                                    <strong>Código:</strong>{" "}
                                    {safeDisplay(row.entityCode)}
                                  </div>
                                  <div>
                                    <strong>Meta:</strong>{" "}
                                    {safeDisplay(row.meta, formatPlainNumber)}
                                  </div>
                                  <div>
                                    <strong>Acumulado:</strong>{" "}
                                    {safeDisplay(row.acumulado, formatPlainNumber)}
                                  </div>
                                  <div>
                                    <strong>Pendiente:</strong>{" "}
                                    {safeDisplay(row.pendiente, formatPlainNumber)}
                                  </div>
                                  <div>
                                    <strong>Cumplimiento:</strong>{" "}
                                    {safeDisplay(row.cumplimiento, formatPercent)}
                                  </div>
                                  <div>
                                    <strong>Estado:</strong>{" "}
                                    {safeDisplay(getStatusLabel(row.estado))}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="acumulado"
                          name="Acumulado"
                          stackId="a"
                          fill={CHART_COLORS.blue}
                          radius={[10, 0, 0, 10]}
                        >
                          <LabelList
                            dataKey="acumulado"
                            position="insideLeft"
                            formatter={(value) => formatPlainNumber(value)}
                            style={{
                              fill: "#ffffff",
                              fontWeight: 800,
                              fontSize: 12,
                            }}
                          />
                        </Bar>
                        <Bar
                          dataKey="pendiente"
                          name="Pendiente"
                          stackId="a"
                          fill={CHART_COLORS.pending}
                          radius={[0, 10, 10, 0]}
                        >
                          <LabelList
                            dataKey="pendiente"
                            position="insideRight"
                            formatter={(value) => formatPlainNumber(value)}
                            style={{
                              fill: CHART_COLORS.text,
                              fontWeight: 800,
                              fontSize: 12,
                            }}
                          />
                          <LabelList content={<PersonProgressLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section
                className="panel-block"
                style={{
                  borderRadius: 24,
                  border: `1px solid ${CHART_COLORS.cardBorder}`,
                  boxShadow: CHART_COLORS.cardShadowSoft,
                  background: "#ffffff",
                }}
              >
                <div className="subsection-title">Ranking por entidad</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Código</th>
                        <th>Entidad</th>
                        <th>Meta</th>
                        <th>Acumulado</th>
                        <th>Faltante</th>
                        <th>Cumplimiento</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboardData.ranking || [])
                        .filter((item) =>
                          isMatchingStatusFilter(
                            normalizeStatus(item.status),
                            dashboardFilter.status_filter
                          )
                        )
                        .map((item) => (
                          <tr key={item.entity_id}>
                            <td>{safeDisplay(item.entity_type || "-")}</td>
                            <td>{safeDisplay(item.entity_code)}</td>
                            <td>{safeDisplay(item.entity_name)}</td>
                            <td>{safeDisplay(item.target_value, formatPlainNumber)}</td>
                            <td>{safeDisplay(item.accumulated, formatPlainNumber)}</td>
                            <td>{safeDisplay(item.remaining, formatPlainNumber)}</td>
                            <td>{safeDisplay(item.compliance, formatPercent)}</td>
                            <td>
                              <span
                                className={`status ${normalizeStatus(item.status)}`}
                                style={{
                                  ...getStatusPillStyles(item.status),
                                  borderRadius: 999,
                                  padding: "5px 10px",
                                  display: "inline-flex",
                                  fontWeight: 800,
                                  fontSize: 11,
                                }}
                              >
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                          </tr>
                        ))}

                      {!dashboardData.ranking?.filter((item) =>
                        isMatchingStatusFilter(
                          normalizeStatus(item.status),
                          dashboardFilter.status_filter
                        )
                      ).length && (
                        <tr>
                          <td colSpan="8" className="empty">
                            Sin resultados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="process-focus-banner">
                <div>
                  <div className="section-kicker">PROCESO SELECCIONADO</div>
                  <h2>{safeDisplay(dashboardData?.process?.name)}</h2>
                  <p>
                    Lectura ejecutiva del proceso con tendencia, distribución y
                    foco operativo.
                  </p>
                </div>
                <div className="focus-banner-side">
                  <span className="status-pill">
                    Nivel {safeDisplay(dashboardData?.process?.level)}
                  </span>
                  <span className="status-pill dark">Detalle ejecutivo</span>
                </div>
              </section>

              <section className="executive-kpi-grid clean-kpis">
                <div className="executive-kpi blue-main">
                  <span>Promedio general</span>
                  <strong>{safeDisplay(dashboardAverageGeneral, formatPercent)}</strong>
                  <small>
                    {historySummary
                      ? "Tomado directamente del resumen del histórico"
                      : "Resultado consolidado del proceso"}
                  </small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Registros</span>
                  <strong>{safeDisplay(dashboardTotalRecords)}</strong>
                  <small>Total de capturas analizadas</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>OK</span>
                  <strong>{safeDisplay(dashboardOkCount)}</strong>
                  <small>Dentro de rango</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Warning</span>
                  <strong>{safeDisplay(dashboardWarningCount)}</strong>
                  <small>Seguimiento</small>
                </div>

                <div className="executive-kpi blue-neutral">
                  <span>Critical</span>
                  <strong>{safeDisplay(dashboardCriticalCount)}</strong>
                  <small>Prioridad alta</small>
                </div>
              </section>

              {isStandardIndicatorSelected && (
                <ExecutiveIndicatorCard
                  selectedDashboardIndicator={selectedDashboardIndicator}
                  selectedPoint={selectedTrendPoint}
                  processDailySeries={processDailySeries}
                  processValueAxisLabel={processValueAxisLabel}
                />
              )}

              <div className="dashboard-process-grid premium-process-grid">
                <section
                  className="chart-card premium-chart-card"
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${CHART_COLORS.cardBorder}`,
                    boxShadow: CHART_COLORS.cardShadow,
                    background: "#ffffff",
                  }}
                >
                  <div
                    className="subsection-title"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span>
                      Tendencia general
                      {dashboardFilter.period === "week" &&
                      dashboardFilter.week_segment
                        ? ` - ${weekRangeLabel}`
                        : ""}
                    </span>

                    {isStandardIndicatorSelected &&
                      !!processDailySeries.length && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setIsTrendExpanded(true)}
                        >
                          Ampliar gráfica
                        </button>
                      )}
                  </div>

                  <div className="chart-container executive-chart">
                    {renderTrendChart({
                      isStandardIndicatorSelected,
                      processDailySeries,
                      dashboardData,
                      processValueAxisLabel,
                      selectedDashboardIndicator,
                      expanded: false,
                      selectedTrendIndex,
                      onSelectTrendBar: (index) => setSelectedTrendIndex(index),
                    })}
                  </div>

                  {isStandardIndicatorSelected && !!processDailySeries.length && (
                    <TrendLegend
                      selectedDashboardIndicator={selectedDashboardIndicator}
                      observationsCount={observationsCount}
                      processValueAxisLabel={processValueAxisLabel}
                      compact
                    />
                  )}
                </section>

                <section
                  className="chart-card premium-chart-card donut-card"
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${CHART_COLORS.cardBorder}`,
                    boxShadow: CHART_COLORS.cardShadow,
                    background: "#ffffff",
                  }}
                >
                  <div className="subsection-title">Distribución del proceso</div>
                  <div className="chart-container executive-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardPieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={90}
                          innerRadius={56}
                          paddingAngle={4}
                          cornerRadius={10}
                          label={({ name, percentage }) =>
                            `${name}: ${percentage}%`
                          }
                        >
                          {dashboardPieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, item) =>
                            `${value} (${item?.payload?.percentage || 0}%)`
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>



              </div>

              <section className="executive-section">
                <div className="subsection-title">Monitoreo por indicador</div>
                <div className="indicator-summary-grid">
                  {(dashboardData.indicator_cards || [])
                    .filter((item) =>
                      isMatchingStatusFilter(
                        normalizeStatus(item.status),
                        dashboardFilter.status_filter
                      )
                    )
                    .map((item) => (
                      <div
                        key={item.indicator_id}
                        className="indicator-summary-card clean-indicator-card"
                        style={{
                          borderRadius: 22,
                          border: `1px solid ${CHART_COLORS.cardBorder}`,
                          boxShadow: CHART_COLORS.cardShadowSoft,
                          background: "#ffffff",
                        }}
                      >
                        <div className="indicator-card-head">
                          <div>
                            <div className="indicator-code">
                              {safeDisplay(item.code)}
                            </div>
                            <div className="indicator-name">
                              {safeDisplay(item.name)}
                            </div>
                          </div>
                          <span
                            className={`status ${normalizeStatus(item.status)}`}
                            style={{
                              ...getStatusPillStyles(item.status),
                              borderRadius: 999,
                              padding: "5px 10px",
                              display: "inline-flex",
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </div>

                        <div className="indicator-main-value">
                          {safeDisplay(item.general, formatPercent)}
                        </div>

                        <div className="indicator-rules compact-rules">
                          <div>
                            Frecuencia:{" "}
                            <strong>
                              {safeDisplay(
                                item.frequency
                                  ? formatFrequencyLabel(item.frequency)
                                  : null
                              )}
                            </strong>
                          </div>
                          <div>
                            Captura:{" "}
                            <strong>
                              {safeDisplay(
                                item.capture_mode
                                  ? formatCaptureModeLabel(item.capture_mode)
                                  : null
                              )}
                            </strong>
                          </div>
                          <div>
                            Meta:{" "}
                            {safeDisplay(
                              formatRule(
                                item.target_operator,
                                item.target_value,
                                item.unit
                              )
                            )}
                          </div>
                          <div>
                            Warning:{" "}
                            {safeDisplay(
                              formatRule(
                                item.warning_operator,
                                item.warning_value,
                                item.unit
                              )
                            )}
                          </div>
                          <div>
                            Critical:{" "}
                            {safeDisplay(
                              formatRule(
                                item.critical_operator,
                                item.critical_value,
                                item.unit
                              )
                            )}
                          </div>
                          <div>
                            Tendencia:{" "}
                            <strong>
                              {item.direction === "up"
                                ? "Al alza"
                                : item.direction === "down"
                                ? "A la baja"
                                : "Estable"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              <section className="executive-section">
                <div className="subsection-title">
                  Micro tendencias por indicador
                </div>
                <div className="indicator-trend-grid">
                  {(dashboardData.indicator_trends || []).map((item) => (
                    <div
                      key={item.indicator_id}
                      className="indicator-trend-card clean-trend-card"
                      style={{
                        borderRadius: 22,
                        border: `1px solid ${CHART_COLORS.cardBorder}`,
                        boxShadow: CHART_COLORS.cardShadowSoft,
                        background: "#ffffff",
                      }}
                    >
                      <div className="indicator-trend-head">
                        <div>
                          <div className="indicator-code">
                            {safeDisplay(item.code)}
                          </div>
                          <div className="indicator-name">
                            {safeDisplay(item.name)}
                          </div>
                        </div>
                        <span className={`trend-badge ${item.direction}`}>
                          {item.direction === "up"
                            ? "Al alza"
                            : item.direction === "down"
                            ? "A la baja"
                            : "Estable"}
                        </span>
                      </div>

                      <div className="indicator-main-value small">
                        {safeDisplay(item.last_value, formatPercent)}
                      </div>

                      <div className="mini-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={item.points || []}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={CHART_COLORS.grid}
                            />
                            <XAxis dataKey="label" hide />
                            <YAxis hide />
                            <Tooltip formatter={(value) => formatPercent(value)} />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={CHART_COLORS.blue}
                              strokeWidth={2.6}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {isTrendExpanded &&
        isStandardIndicatorSelected &&
        !!processDailySeries.length && (
          <div
            onClick={() => setIsTrendExpanded(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 31, 53, 0.55)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(1200px, 96vw)",
                height: "min(760px, 92vh)",
                background: "#ffffff",
                borderRadius: 26,
                boxShadow: "0 30px 80px rgba(10, 28, 48, 0.28)",
                border: "1px solid #d7e3f1",
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "#6b7c93",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Tendencia ampliada
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      color: CHART_COLORS.text,
                      fontSize: 28,
                      lineHeight: 1.1,
                    }}
                  >
                    {safeDisplay(selectedDashboardIndicator?.code)} -{" "}
                    {safeDisplay(selectedDashboardIndicator?.name)}
                  </h3>
                </div>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsTrendExpanded(false)}
                >
                  Cerrar
                </button>
              </div>

              <TrendLegend
                selectedDashboardIndicator={selectedDashboardIndicator}
                observationsCount={observationsCount}
                processValueAxisLabel={processValueAxisLabel}
                processName={dashboardData?.process?.name}
                weekRangeLabel={weekRangeLabel}
                showRange={
                  dashboardFilter.period === "week" &&
                  !!dashboardFilter.week_segment
                }
              />

              <div style={{ flex: 1, minHeight: 0 }}>
                {renderTrendChart({
                  isStandardIndicatorSelected,
                  processDailySeries,
                  dashboardData,
                  processValueAxisLabel,
                  selectedDashboardIndicator,
                  expanded: true,
                  selectedTrendIndex,
                  onSelectTrendBar: (index) => setSelectedTrendIndex(index),
                })}
              </div>
            </div>
          </div>
        )}
    </section>
  );
}