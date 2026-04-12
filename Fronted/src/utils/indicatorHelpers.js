export function normalizeShifts(shifts) {
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

export function hasShift(source, shift) {
  return normalizeShifts(source).includes(shift);
}

export function formatRecordValue(record) {
  if (record?.scope_type === "person") {
    const personName = record?.person_name || record?.person || "-";
    const personValue =
      record?.value !== null && record?.value !== undefined
        ? record.value
        : "-";
    return `${personName}: ${personValue}`;
  }

  if (record?.capture_mode === "single") {
    return record?.single_value ?? "-";
  }

  const enabled = normalizeShifts(record?.shifts);
  const parts = [];

  if (
    enabled.includes("A") &&
    record?.shift_a !== null &&
    record?.shift_a !== undefined
  ) {
    parts.push(`A: ${record.shift_a}`);
  }

  if (
    enabled.includes("B") &&
    record?.shift_b !== null &&
    record?.shift_b !== undefined
  ) {
    parts.push(`B: ${record.shift_b}`);
  }

  if (
    enabled.includes("C") &&
    record?.shift_c !== null &&
    record?.shift_c !== undefined
  ) {
    parts.push(`C: ${record.shift_c}`);
  }

  return parts.length ? parts.join(" | ") : "-";
}