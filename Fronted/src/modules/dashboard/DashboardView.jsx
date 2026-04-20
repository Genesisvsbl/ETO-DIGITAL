import { useMemo, useState } from "react";
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
  formatShortDate,
  formatFrequencyLabel,
  formatCaptureModeLabel,
  formatPlainNumber,
  formatRule,
} from "../../utils/formatters";

const CHART_COLORS = {
  navy: "#133a6b",
  blue: "#2459c3",
  blueSoft: "#9dbcf5",
  blueLight: "#eef4ff",
  grid: "#d7e3f1",
  text: "#17324d",
  textSoft: "#5f738a",
  pending: "#dce7f8",
  white: "#ffffff",
  ok: "#39a96b",
  okSoft: "rgba(57, 169, 107, 0.12)",
  warning: "#f4c430",
  warningSoft: "rgba(244, 196, 48, 0.14)",
  critical: "#e24b4b",
  criticalSoft: "rgba(226, 75, 75, 0.13)",
  observation: "#6d4cff",
  target: "#1c4b8f",
  targetSoft: "rgba(28, 75, 143, 0.10)",
  warningArea: "rgba(244, 196, 48, 0.16)",
  criticalArea: "rgba(226, 75, 75, 0.14)",
  cardBorder: "#e7eef7",
  cardShadow: "0 16px 40px rgba(17, 42, 74, 0.08)",
  cardShadowSoft: "0 12px 30px rgba(17, 42, 74, 0.06)",
};

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

function getMeasuredValueFromHistoryRow(row) {
  if (!row) return null;

  if (row.capture_mode === "single") {
    const value = Number(row.single_value);
    return Number.isFinite(value) ? value : null;
  }

  const values = [];
  if (row.shift_a !== null && row.shift_a !== undefined && row.shift_a !== "") {
    values.push(Number(row.shift_a));
  }
  if (row.shift_b !== null && row.shift_b !== undefined && row.shift_b !== "") {
    values.push(Number(row.shift_b));
  }
  if (row.shift_c !== null && row.shift_c !== undefined && row.shift_c !== "") {
    values.push(Number(row.shift_c));
  }

  const valid = values.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  return valid.reduce((acc, val) => acc + val, 0) / valid.length;
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
    (a, b) => new Date(a.record_date) - new Date(b.record_date)
  );

  if (period === "day") {
    const selectedDay = Number(filter?.day);
    if (!selectedDay) return sorted;

    return sorted.filter((row) => {
      const day = Number(String(row.record_date || "").slice(8, 10));
      return day === selectedDay;
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
      const day = Number(String(row.record_date || "").slice(8, 10));
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

function getLatestHistoryRecord(historyRows) {
  const rows = Array.isArray(historyRows) ? historyRows : [];
  if (!rows.length) return null;

  return [...rows].sort(
    (a, b) => new Date(b.record_date) - new Date(a.record_date)
  )[0];
}

function getPreviousHistoryRecord(historyRows) {
  const rows = Array.isArray(historyRows) ? historyRows : [];
  if (rows.length < 2) return null;

  const sorted = [...rows].sort(
    (a, b) => new Date(b.record_date) - new Date(a.record_date)
  );

  return sorted[1] || null;
}

function buildDailySeriesFromHistory(historyRows, filter) {
  const filteredRows = filterHistoryRowsByPeriod(historyRows, filter);

  return filteredRows.map((item, index) => {
    const recordDate = String(item.record_date || "").slice(0, 10);
    const day = Number(recordDate.slice(8, 10)) || index + 1;
    const realValue = getMeasuredValueFromHistoryRow(item);
    const general = normalizeGeneralToPercent(item.general || 0);
    const status = normalizeStatus(item.status);
    const observation = String(item.observation || "").trim();

    return {
      date: recordDate,
      day,
      xLabel: String(day),
      shortLabel: String(day),
      fullshortLabel: String(day),
      value: Number.isFinite(realValue) ? realValue : 0,
      originalValue: realValue,
      trendValue: Number.isFinite(realValue) ? realValue : 0,
      general,
      unit: item.unit || "",
      status,
      fill: getBarColorByStatus(status),
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
  });
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

function MetricMiniCard({ title, value, tone = "neutral" }) {
  const toneMap = {
    neutral: {
      background: "#ffffff",
      color: CHART_COLORS.text,
      border: CHART_COLORS.cardBorder,
    },
    ok: {
      background: "#f5fbf8",
      color: CHART_COLORS.ok,
      border: "rgba(57,169,107,0.18)",
    },
    warning: {
      background: "#fffaf0",
      color: "#a16d00",
      border: "rgba(244,196,48,0.22)",
    },
    critical: {
      background: "#fff6f6",
      color: CHART_COLORS.critical,
      border: "rgba(226,75,75,0.22)",
    },
    primary: {
      background: "#eef4ff",
      color: CHART_COLORS.navy,
      border: "rgba(36,89,195,0.15)",
    },
  };

  const currentTone = toneMap[tone] || toneMap.neutral;

  return (
    <div
      style={{
        background: currentTone.background,
        color: currentTone.color,
        border: `1px solid ${currentTone.border}`,
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
        {title}
      </span>
      <strong
        style={{
          fontSize: 24,
          lineHeight: 1.1,
          color: currentTone.color,
        }}
      >
        {value}
      </strong>
    </div>
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
        <strong>Barras:</strong> valor real por día
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

function CustomDailyTooltip({
  active,
  payload,
  label,
  valueAxisLabel,
  selectedDashboardIndicator,
}) {
  if (!active || !payload?.length) return null;

  const row =
    payload.find((item) => item?.payload)?.payload ||
    payload[0]?.payload ||
    {};

  const targetValue = getIndicatorTargetLineValue(selectedDashboardIndicator);
  const warningRule = formatRule(
    selectedDashboardIndicator?.warning_operator,
    selectedDashboardIndicator?.warning_value,
    selectedDashboardIndicator?.unit || valueAxisLabel
  );
  const criticalRule = formatRule(
    selectedDashboardIndicator?.critical_operator,
    selectedDashboardIndicator?.critical_value,
    selectedDashboardIndicator?.unit || valueAxisLabel
  );

  const pillStyles = getStatusPillStyles(row.status);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #d7e3f1",
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 16px 34px rgba(23,50,77,0.14)",
        minWidth: 300,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontWeight: 800,
            color: CHART_COLORS.text,
          }}
        >
          {safeDisplay(row.date || label)}
        </div>

        <span
          style={{
            ...pillStyles,
            padding: "5px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          {getStatusLabel(row.status)}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          fontSize: 13,
          color: CHART_COLORS.text,
        }}
      >
        <div>
          <strong>Fecha:</strong> {safeDisplay(row.date || label)}
        </div>
        <div>
          <strong>Valor:</strong>{" "}
          {row.originalValue !== null && row.originalValue !== undefined
            ? `${formatPlainNumber(Number(row.value || 0))} ${valueAxisLabel}`
            : "N/D"}
        </div>
        <div>
          <strong>Cumplimiento:</strong>{" "}
          {safeDisplay(
            Number.isFinite(Number(row.general)) ? Number(row.general) : null,
            formatPercent
          )}
        </div>
        <div>
          <strong>Estado:</strong> {safeDisplay(getStatusLabel(row.status))}
        </div>
        <div>
          <strong>Meta:</strong>{" "}
          {targetValue !== null
            ? `${formatPlainNumber(targetValue)} ${valueAxisLabel}`
            : "N/D"}
        </div>
        <div>
          <strong>Warning rule:</strong> {warningRule || "N/D"}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <strong>Critical rule:</strong> {criticalRule || "N/D"}
        </div>
      </div>

      <div
        style={{
          color: CHART_COLORS.text,
          fontSize: 13,
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #e6eef8",
        }}
      >
        <strong>Observación:</strong> {safeDisplay(row.observation)}
      </div>
    </div>
  );
}

function ExecutiveIndicatorCard({
  selectedDashboardIndicator,
  indicatorHistoryRows,
  processValueAxisLabel,
}) {
  if (!selectedDashboardIndicator) return null;

  const latestRecord = getLatestHistoryRecord(indicatorHistoryRows);
  const previousRecord = getPreviousHistoryRecord(indicatorHistoryRows);

  const latestMeasuredValue = latestRecord
    ? getMeasuredValueFromHistoryRow(latestRecord)
    : null;
  const previousMeasuredValue = previousRecord
    ? getMeasuredValueFromHistoryRow(previousRecord)
    : null;

  const complianceValue = latestRecord
    ? normalizeGeneralToPercent(latestRecord.general || 0)
    : null;

  const targetValue = getSafeNumericValue(selectedDashboardIndicator.target_value);
  const latestStatus = latestRecord
    ? normalizeStatus(latestRecord.status)
    : normalizeStatus(selectedDashboardIndicator.status);

  const variationValue =
    latestMeasuredValue !== null &&
    latestMeasuredValue !== undefined &&
    previousMeasuredValue !== null &&
    previousMeasuredValue !== undefined
      ? Number(latestMeasuredValue) - Number(previousMeasuredValue)
      : null;

  const latestObservation = String(latestRecord?.observation || "").trim();
  const statusStyles = getStatusPillStyles(latestStatus);

  const observationTone =
    latestStatus === "critical"
      ? {
          background: "#fff6f6",
          border: "1px solid rgba(226,75,75,0.22)",
          color: CHART_COLORS.critical,
        }
      : latestStatus === "warning"
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
            {safeDisplay(getStatusLabel(latestStatus))}
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
                Fecha último registro
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: CHART_COLORS.text,
                }}
              >
                {safeDisplay(latestRecord?.record_date)}
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
                {latestMeasuredValue !== null
                  ? `${formatPlainNumber(latestMeasuredValue)} ${processValueAxisLabel}`
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
                  color:
                    variationValue === null
                      ? CHART_COLORS.text
                      : variationValue < 0
                      ? CHART_COLORS.critical
                      : variationValue > 0
                      ? CHART_COLORS.ok
                      : CHART_COLORS.text,
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
            <MetricMiniCard
              title="% cumplimiento"
              value={
                complianceValue !== null ? formatPercent(complianceValue) : "N/D"
              }
              tone="primary"
            />

            <MetricMiniCard
              title="Estado"
              value={safeDisplay(getStatusLabel(latestStatus))}
              tone={latestStatus}
            />

            <MetricMiniCard
              title="Warning rule"
              value={safeDisplay(
                formatRule(
                  selectedDashboardIndicator.warning_operator,
                  selectedDashboardIndicator.warning_value,
                  selectedDashboardIndicator.unit || processValueAxisLabel
                )
              )}
              tone="neutral"
            />

            <MetricMiniCard
              title="Critical rule"
              value={safeDisplay(
                formatRule(
                  selectedDashboardIndicator.critical_operator,
                  selectedDashboardIndicator.critical_value,
                  selectedDashboardIndicator.unit || processValueAxisLabel
                )
              )}
              tone="neutral"
            />
          </div>
        </div>
      </div>

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
            {latestObservation || "N/D"}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderTrendChart({
  isStandardIndicatorSelected,
  processDailySeries,
  dashboardData,
  processValueAxisLabel,
  selectedDashboardIndicator,
  expanded = false,
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
            dataKey="xLabel"
            interval={0}
            angle={0}
            textAnchor="middle"
            height={expanded ? 46 : 40}
            tick={{ fontSize: expanded ? 12 : 11, fill: CHART_COLORS.text }}
            label={
              expanded
                ? {
                    value: "Día",
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

          <Tooltip
            content={
              <CustomDailyTooltip
                valueAxisLabel={processValueAxisLabel}
                selectedDashboardIndicator={selectedDashboardIndicator}
              />
            }
          />

          <Bar
            yAxisId="left"
            dataKey="value"
            name={processValueAxisLabel}
            radius={[10, 10, 0, 0]}
            maxBarSize={expanded ? 46 : 34}
          >
            {processDailySeries.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS.ok} />
            ))}
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
            activeDot={{ r: expanded ? 6 : 5 }}
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
        data={dashboardData.trend.map((item, index) => ({
          ...item,
          xLabel: String(
            Number(String(item.label || "").slice(8, 10)) || index + 1
          ),
          shortLabel: formatShortDate(item.label),
        }))}
        margin={{ top: 10, right: 20, left: 0, bottom: 50 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="shortLabel"
          interval={0}
          angle={0}
          textAnchor="middle"
          height={40}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickFormatter={(value) => `${value}%`} />
        <Tooltip
          formatter={(value) => formatPercent(value)}
          labelFormatter={(label, payload) =>
            payload?.[0]?.payload?.label || label
          }
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

export default function DashboardView({ accessLevel, processes, indicators }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [indicatorHistoryRows, setIndicatorHistoryRows] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [isTrendExpanded, setIsTrendExpanded] = useState(false);

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
        const requests = [API.getProcessDashboard(filters)];

        if (filters.indicator_id && isStandardIndicatorSelected) {
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

          requests.push(API.getHistory(historyParams));
        }

        const [processData, historyData] = await Promise.all(requests);

        setDashboardData({
          ...processData,
          is_entity_dashboard: false,
        });

        setIndicatorHistoryRows(readHistoryRows(historyData));
        setHistorySummary(readHistorySummary(historyData));
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
  }, [dashboardData, dashboardOverview, dashboardFilter.status_filter]);

  const dashboardBarData = useMemo(() => {
    if (!dashboardData?.indicator_cards?.length) return [];

    return dashboardData.indicator_cards
      .map((item) => ({
        name: formatCompactName(item.code, 16),
        fullName: `${item.code} - ${item.name}`,
        general: Number(item.general || 0),
        status: normalizeStatus(item.status),
        fill: getBarColorByStatus(item.status),
      }))
      .filter((item) =>
        isMatchingStatusFilter(item.status, dashboardFilter.status_filter)
      );
  }, [dashboardData, dashboardFilter.status_filter]);

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

    if (isStandardIndicatorSelected && indicatorHistoryRows.length) {
      return buildDailySeriesFromHistory(indicatorHistoryRows, dashboardFilter);
    }

    return (dashboardData?.trend || [])
      .map((item, index) => {
        const numericValue = Number(item.value || 0);
        const status = normalizeStatus(item.status || "ok");
        return {
          date: item.label,
          day: Number(String(item.label || "").slice(8, 10)) || index + 1,
          xLabel: String(
            Number(String(item.label || "").slice(8, 10)) || index + 1
          ),
          shortLabel: formatShortDate(item.label),
          value: Number.isFinite(numericValue) ? numericValue : 0,
          originalValue: Number.isFinite(numericValue) ? numericValue : null,
          trendValue: Number.isFinite(numericValue) ? numericValue : 0,
          general: normalizeGeneralToPercent(item.general ?? item.value ?? 0),
          status,
          fill: getBarColorByStatus(status),
          observation: String(item.observation || "").trim(),
          hasObservation: !!String(item.observation || "").trim(),
          observationMarkerY: Number.isFinite(numericValue) ? numericValue : 0,
        };
      })
      .sort((a, b) => Number(a.day) - Number(b.day));
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
    <section className="content-card dashboard-master-card">
      <div className="card-header-block dashboard-header">
        <div>
          <div className="section-kicker">ANALÍTICA EJECUTIVA</div>
          <h3>Dashboard corporativo</h3>
          <p>
            Vista global por procesos o análisis detallado por proceso con
            tendencia, comparativos y Pareto.
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
                    Lectura ejecutiva del proceso con tendencia, comparativos y
                    foco de impacto.
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
                  indicatorHistoryRows={indicatorHistoryRows}
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

                <section
                  className="chart-card premium-chart-card full-span"
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${CHART_COLORS.cardBorder}`,
                    boxShadow: CHART_COLORS.cardShadow,
                    background: "#ffffff",
                  }}
                >
                  <div className="subsection-title">Comparativo de indicadores</div>
                  <div className="chart-container large-executive-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardBarData}
                        margin={{ top: 18, right: 18, left: 10, bottom: 50 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip
                          formatter={(value) => formatPercent(value)}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.fullName || label
                          }
                        />
                        <Bar
                          dataKey="general"
                          name="Resultado"
                          radius={[10, 10, 0, 0]}
                        >
                          {dashboardBarData.map((entry, index) => (
                            <Cell key={`indicator-bar-${index}`} fill={entry.fill} />
                          ))}
                          <LabelList
                            dataKey="general"
                            position="top"
                            formatter={(value) => formatPercent(value)}
                            style={{
                              fill: CHART_COLORS.text,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section
                  className="chart-card premium-chart-card full-span"
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${CHART_COLORS.cardBorder}`,
                    boxShadow: CHART_COLORS.cardShadow,
                    background: "#ffffff",
                  }}
                >
                  <div className="subsection-title">Pareto de impacto</div>
                  <div className="chart-container large-executive-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(dashboardData.pareto || []).map((item) => ({
                          ...item,
                          shortName: formatCompactName(item.name, 24),
                        }))}
                        margin={{ top: 18, right: 18, left: 10, bottom: 50 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_COLORS.grid}
                        />
                        <XAxis
                          dataKey="shortName"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === "% Acumulado") {
                              return `${Number(value).toFixed(1)}%`;
                            }
                            return formatPlainNumber(value);
                          }}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.name || label
                          }
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="value"
                          name="Impacto"
                          fill={CHART_COLORS.blue}
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList
                            dataKey="value"
                            position="top"
                            formatter={(value) => formatPlainNumber(value)}
                            style={{
                              fill: CHART_COLORS.text,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          />
                        </Bar>

                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulative"
                          name="% Acumulado"
                          stroke={CHART_COLORS.navy}
                          strokeWidth={3}
                          dot={{ r: 4, fill: CHART_COLORS.navy }}
                        >
                          <LabelList
                            dataKey="cumulative"
                            position="top"
                            formatter={(value) =>
                              `${Number(value).toFixed(1)}%`
                            }
                            style={{
                              fill: CHART_COLORS.text,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          />
                        </Line>
                      </ComposedChart>
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
                            <Tooltip
                              formatter={(value) => formatPercent(value)}
                            />
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
                })}
              </div>
            </div>
          </div>
        )}
    </section>
  );
}