from datetime import date, timedelta
from typing import Optional, List
from collections import defaultdict
import calendar

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, text

from pydantic import BaseModel

from database import SessionLocal, engine, Base
from models import (
    Process,
    Indicator,
    DailyRecord,
    Entity,
    EntityIndicatorTarget,
    EntityRecord,
)
from schemas import (
    ProcessCreate,
    ProcessOut,
    IndicatorCreate,
    IndicatorOut,
    DailyRecordCreate,
    DailyRecordOut,
    PeriodRecordSave,
    EntityCreate,
    EntityOut,
    EntityIndicatorTargetCreate,
    EntityIndicatorTargetOut,
    EntityRecordBulkSave,
    EntityRecordOut,
    EntityCaptureGridOut,
    EntityCaptureGridRow,
    EntityDashboardOut,
    EntityDashboardItem,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ETO DIGITAL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_OPERATORS = [">", ">=", "<", "<=", "="]
VALID_UNITS = ["%", "días", "horas", "unidades", "casos", "número"]
VALID_FREQUENCIES = ["day", "week", "month"]
VALID_CAPTURE_MODES = ["single", "shifts"]
VALID_SCOPE_TYPES = ["standard", "entity"]


class MonthlyRecordRow(BaseModel):
    record_date: date
    single_value: Optional[float] = None
    shift_a: Optional[float] = None
    shift_b: Optional[float] = None
    shift_c: Optional[float] = None
    observation: Optional[str] = None


class MonthlyRecordSave(BaseModel):
    indicator_id: int
    rows: List[MonthlyRecordRow]


def table_exists_sqlite(connection, table_name: str) -> bool:
    try:
        result = connection.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
            {"table_name": table_name},
        ).fetchone()
        return result is not None
    except Exception:
        return False


def run_safe_migrations():
    with engine.begin() as connection:
        try:
            dialect_name = connection.dialect.name

            if dialect_name == "sqlite":
                indicator_columns = [
                    row[1]
                    for row in connection.execute(text("PRAGMA table_info(indicators)")).fetchall()
                ]
                daily_record_columns = [
                    row[1]
                    for row in connection.execute(text("PRAGMA table_info(daily_records)")).fetchall()
                ]
                entity_columns = (
                    [
                        row[1]
                        for row in connection.execute(text("PRAGMA table_info(entities)")).fetchall()
                    ]
                    if table_exists_sqlite(connection, "entities")
                    else []
                )

                if "frequency" not in indicator_columns:
                    connection.execute(
                        text("ALTER TABLE indicators ADD COLUMN frequency VARCHAR NOT NULL DEFAULT 'day'")
                    )
                if "capture_mode" not in indicator_columns:
                    connection.execute(
                        text("ALTER TABLE indicators ADD COLUMN capture_mode VARCHAR NOT NULL DEFAULT 'shifts'")
                    )
                if "shifts" not in indicator_columns:
                    connection.execute(
                        text("ALTER TABLE indicators ADD COLUMN shifts VARCHAR NOT NULL DEFAULT 'A,B,C'")
                    )
                if "scope_type" not in indicator_columns:
                    connection.execute(
                        text("ALTER TABLE indicators ADD COLUMN scope_type VARCHAR NOT NULL DEFAULT 'standard'")
                    )

                if "single_value" not in daily_record_columns:
                    connection.execute(text("ALTER TABLE daily_records ADD COLUMN single_value FLOAT"))
                if "shift_a" not in daily_record_columns:
                    connection.execute(text("ALTER TABLE daily_records ADD COLUMN shift_a FLOAT"))
                if "shift_b" not in daily_record_columns:
                    connection.execute(text("ALTER TABLE daily_records ADD COLUMN shift_b FLOAT"))
                if "shift_c" not in daily_record_columns:
                    connection.execute(text("ALTER TABLE daily_records ADD COLUMN shift_c FLOAT"))

                if table_exists_sqlite(connection, "persons") and not table_exists_sqlite(connection, "entities"):
                    connection.execute(text("ALTER TABLE persons RENAME TO entities"))

                if table_exists_sqlite(connection, "person_indicator_targets") and not table_exists_sqlite(connection, "entity_indicator_targets"):
                    connection.execute(text("ALTER TABLE person_indicator_targets RENAME TO entity_indicator_targets"))

                if table_exists_sqlite(connection, "person_records") and not table_exists_sqlite(connection, "entity_records"):
                    connection.execute(text("ALTER TABLE person_records RENAME TO entity_records"))

                if table_exists_sqlite(connection, "entities"):
                    entity_columns = [
                        row[1]
                        for row in connection.execute(text("PRAGMA table_info(entities)")).fetchall()
                    ]
                    if "name" not in entity_columns and "full_name" in entity_columns:
                        try:
                            connection.execute(text("ALTER TABLE entities ADD COLUMN name VARCHAR"))
                            connection.execute(text("UPDATE entities SET name = full_name WHERE name IS NULL"))
                        except Exception:
                            pass

                    if "entity_type" not in entity_columns:
                        connection.execute(
                            text("ALTER TABLE entities ADD COLUMN entity_type VARCHAR NOT NULL DEFAULT 'persona'")
                        )

                try:
                    connection.execute(
                        text("UPDATE indicators SET scope_type = 'entity' WHERE scope_type IN ('person', 'persona')")
                    )
                except Exception:
                    pass

            else:
                connection.execute(
                    text("ALTER TABLE indicators ADD COLUMN IF NOT EXISTS scope_type VARCHAR NOT NULL DEFAULT 'standard'")
                )
                connection.execute(
                    text("ALTER TABLE indicators ADD COLUMN IF NOT EXISTS frequency VARCHAR NOT NULL DEFAULT 'day'")
                )
                connection.execute(
                    text("ALTER TABLE indicators ADD COLUMN IF NOT EXISTS capture_mode VARCHAR NOT NULL DEFAULT 'shifts'")
                )
                connection.execute(
                    text("ALTER TABLE indicators ADD COLUMN IF NOT EXISTS shifts VARCHAR NOT NULL DEFAULT 'A,B,C'")
                )

                try:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS single_value DOUBLE PRECISION")
                    )
                except Exception:
                    pass
                try:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS shift_a DOUBLE PRECISION")
                    )
                except Exception:
                    pass
                try:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS shift_b DOUBLE PRECISION")
                    )
                except Exception:
                    pass
                try:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS shift_c DOUBLE PRECISION")
                    )
                except Exception:
                    pass

                try:
                    connection.execute(text("ALTER TABLE persons RENAME TO entities"))
                except Exception:
                    pass

                try:
                    connection.execute(text("ALTER TABLE person_indicator_targets RENAME TO entity_indicator_targets"))
                except Exception:
                    pass

                try:
                    connection.execute(text("ALTER TABLE person_records RENAME TO entity_records"))
                except Exception:
                    pass

                try:
                    connection.execute(text("ALTER TABLE entities RENAME COLUMN full_name TO name"))
                except Exception:
                    pass

                try:
                    connection.execute(
                        text("ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_type VARCHAR NOT NULL DEFAULT 'persona'")
                    )
                except Exception:
                    pass

                try:
                    connection.execute(
                        text("ALTER TABLE indicators ALTER COLUMN scope_type SET DEFAULT 'standard'")
                    )
                except Exception:
                    pass

                try:
                    connection.execute(
                        text("UPDATE indicators SET scope_type = 'entity' WHERE scope_type IN ('person', 'persona')")
                    )
                except Exception:
                    pass

            connection.execute(
                text(
                    """
                    UPDATE indicators
                    SET shifts = ''
                    WHERE capture_mode = 'single'
                    """
                )
            )

            connection.execute(
                text(
                    """
                    UPDATE daily_records
                    SET shift_a = NULL,
                        shift_b = NULL,
                        shift_c = NULL
                    WHERE indicator_id IN (
                        SELECT id
                        FROM indicators
                        WHERE capture_mode = 'single'
                    )
                    """
                )
            )

        except Exception:
            pass


run_safe_migrations()
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_frequency(value: Optional[str]) -> str:
    mapping = {
        "day": "day",
        "daily": "day",
        "week": "week",
        "weekly": "week",
        "month": "month",
        "monthly": "month",
    }
    clean = (value or "").strip().lower()
    return mapping.get(clean, clean)


def normalize_capture_mode(value: Optional[str]) -> str:
    mapping = {
        "single": "single",
        "unique": "single",
        "valor único": "single",
        "valor unico": "single",
        "shifts": "shifts",
        "shift": "shifts",
        "turnos": "shifts",
        "por turnos": "shifts",
    }
    clean = (value or "").strip().lower()
    return mapping.get(clean, clean)


def normalize_scope_type(value: Optional[str]) -> str:
    mapping = {
        "standard": "standard",
        "entity": "entity",
        "entidad": "entity",
        "recurso": "entity",
        "resource": "entity",
        "person": "entity",
        "persona": "entity",
        "persona por persona": "entity",
        "machine": "entity",
        "maquina": "entity",
        "máquina": "entity",
    }
    clean = (value or "").strip().lower()
    return mapping.get(clean, clean)


def normalize_optional_operator(value: Optional[str]) -> Optional[str]:
    clean = (value or "").strip()
    return clean if clean else None


def normalize_optional_number(value):
    if value is None:
        return None
    return float(value)


def is_blank_string(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def has_explicit_value(value) -> bool:
    return value is not None and not (isinstance(value, str) and value.strip() == "")


def generate_indicator_code(db: Session):
    last = db.query(Indicator).order_by(Indicator.id.desc()).first()
    next_id = 1 if not last else last.id + 1
    return f"IND-{next_id:04d}"


def generate_entity_code(db: Session):
    last = db.query(Entity).order_by(Entity.id.desc()).first()
    next_id = 1 if not last else last.id + 1
    return f"ENT-{next_id:04d}"


def get_enabled_shifts(indicator: Indicator):
    return [s.strip().upper() for s in (indicator.shifts or "").split(",") if s.strip()]


def sanitize_record_values_for_mode(capture_mode, single_value, shift_a, shift_b, shift_c):
    if capture_mode == "single":
        return single_value, None, None, None
    return None, shift_a, shift_b, shift_c


def compare_value(value: Optional[float], operator: Optional[str], rule_value: Optional[float]) -> bool:
    if value is None or operator is None or rule_value is None:
        return False

    if operator == ">":
        return value > rule_value
    if operator == ">=":
        return value >= rule_value
    if operator == "<":
        return value < rule_value
    if operator == "<=":
        return value <= rule_value
    if operator == "=":
        return value == rule_value
    return False


def calculate_measured_value(indicator: Indicator, single_value, shift_a, shift_b, shift_c):
    if indicator.capture_mode == "single":
        return round(float(single_value if single_value is not None else 0), 2)

    enabled = get_enabled_shifts(indicator)
    values = []

    if "A" in enabled and shift_a is not None:
        values.append(float(shift_a))
    if "B" in enabled and shift_b is not None:
        values.append(float(shift_b))
    if "C" in enabled and shift_c is not None:
        values.append(float(shift_c))

    if not values:
        return 0.0

    return round(sum(values) / len(values), 2)


def calculate_compliance_by_rule(operator: str, target: float, measured_value: float):
    if operator == "=":
        if target == 0:
            return 100.0 if measured_value == 0 else 0.0
        diff_ratio = abs(measured_value - target) / abs(target)
        compliance = max(0.0, 100.0 - (diff_ratio * 100.0))
        return round(min(compliance, 100.0), 2)

    if operator in [">", ">="]:
        if target == 0:
            return 100.0 if compare_value(measured_value, operator, target) else 0.0
        compliance = (measured_value / target) * 100.0
        return round(max(0.0, min(compliance, 100.0)), 2)

    if operator in ["<", "<="]:
        if compare_value(measured_value, operator, target):
            return 100.0
        if target == 0:
            return 0.0
        if measured_value == 0:
            return 100.0
        compliance = (target / measured_value) * 100.0
        return round(max(0.0, min(compliance, 100.0)), 2)

    return 0.0


def calculate_general(indicator: Indicator, measured_value: float):
    target = float(indicator.target_value if indicator.target_value is not None else 0)
    operator = indicator.target_operator
    return calculate_compliance_by_rule(operator, target, measured_value)


def calculate_status(indicator: Indicator, measured_value: float):
    if compare_value(
        measured_value,
        normalize_optional_operator(getattr(indicator, "critical_operator", None)),
        normalize_optional_number(getattr(indicator, "critical_value", None)),
    ):
        return "critical"

    if compare_value(
        measured_value,
        normalize_optional_operator(getattr(indicator, "warning_operator", None)),
        normalize_optional_number(getattr(indicator, "warning_value", None)),
    ):
        return "warning"

    return "ok"


def calculate_entity_status(indicator: Indicator, measured_value: float):
    return calculate_status(indicator, measured_value)


def validate_optional_rule(operator, rule_value, label: str):
    operator = normalize_optional_operator(operator)
    rule_value = normalize_optional_number(rule_value)

    if operator is None and rule_value is None:
        return None, None

    if operator is None or rule_value is None:
        raise HTTPException(
            status_code=400,
            detail=f"Debes completar operador y valor para {label}"
        )

    if operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail=f"Operador de {label} no válido")

    return operator, rule_value


def validate_indicator_payload(payload: IndicatorCreate):
    payload.frequency = normalize_frequency(payload.frequency)
    payload.capture_mode = normalize_capture_mode(payload.capture_mode)
    payload.scope_type = normalize_scope_type(payload.scope_type)

    if payload.unit not in VALID_UNITS:
        raise HTTPException(status_code=400, detail="Unidad no válida")

    if payload.target_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de meta no válido")

    if payload.frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Frecuencia no válida")

    if payload.capture_mode not in VALID_CAPTURE_MODES:
        raise HTTPException(status_code=400, detail="Modo de captura no válido")

    if payload.scope_type not in VALID_SCOPE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de alcance no válido")

    warning_operator, warning_value = validate_optional_rule(
        getattr(payload, "warning_operator", None),
        getattr(payload, "warning_value", None),
        "warning",
    )
    critical_operator, critical_value = validate_optional_rule(
        getattr(payload, "critical_operator", None),
        getattr(payload, "critical_value", None),
        "critical",
    )

    payload.warning_operator = warning_operator
    payload.warning_value = warning_value
    payload.critical_operator = critical_operator
    payload.critical_value = critical_value

    if payload.scope_type == "entity":
        payload.capture_mode = "single"
        payload.shifts = []
        return []

    if payload.capture_mode == "single":
        payload.shifts = []
        return []

    shifts_clean = []
    for s in payload.shifts or []:
        current = (s or "").strip().upper()
        if current in ["A", "B", "C"] and current not in shifts_clean:
            shifts_clean.append(current)

    if not shifts_clean:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un turno")

    payload.shifts = shifts_clean
    return shifts_clean


def validate_record_payload(indicator: Indicator, payload: DailyRecordCreate):
    if indicator.scope_type != "standard":
        raise HTTPException(status_code=400, detail="Este indicador usa captura por entidad")

    if indicator.capture_mode == "single":
        if payload.single_value is None:
            raise HTTPException(status_code=400, detail="Este indicador requiere un valor único")
        return

    enabled = get_enabled_shifts(indicator)
    has_any = False

    if "A" in enabled and payload.shift_a is not None:
        has_any = True
    if "B" in enabled and payload.shift_b is not None:
        has_any = True
    if "C" in enabled and payload.shift_c is not None:
        has_any = True

    if not has_any:
        raise HTTPException(
            status_code=400,
            detail="Debes registrar al menos un valor en los turnos habilitados"
        )


def row_has_values(indicator: Indicator, row) -> bool:
    if indicator.capture_mode == "single":
        return row.single_value is not None

    enabled = get_enabled_shifts(indicator)
    return (
        ("A" in enabled and row.shift_a is not None)
        or ("B" in enabled and row.shift_b is not None)
        or ("C" in enabled and row.shift_c is not None)
    )


def base_history_query(db: Session):
    return (
        db.query(DailyRecord)
        .join(DailyRecord.indicator)
        .join(Indicator.process)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
        .filter(Indicator.scope_type == "standard")
    )


def base_entity_history_query(db: Session):
    return (
        db.query(EntityRecord)
        .join(EntityRecord.indicator)
        .join(Indicator.process)
        .join(EntityRecord.entity)
        .options(
            joinedload(EntityRecord.indicator).joinedload(Indicator.process),
            joinedload(EntityRecord.entity),
        )
        .filter(Indicator.scope_type == "entity")
    )


def apply_common_filters(
    query,
    year=None,
    month=None,
    day=None,
    level=None,
    process_id=None,
    indicator_id=None
):
    if year:
        query = query.filter(extract("year", DailyRecord.record_date) == year)
    if month:
        query = query.filter(extract("month", DailyRecord.record_date) == month)
    if day:
        query = query.filter(extract("day", DailyRecord.record_date) == day)
    if level:
        query = query.filter(Indicator.meeting_level == level)
    if process_id:
        query = query.filter(Indicator.process_id == process_id)
    if indicator_id:
        query = query.filter(DailyRecord.indicator_id == indicator_id)
    return query


def apply_entity_record_filters(
    query,
    year=None,
    month=None,
    day=None,
    level=None,
    process_id=None,
    indicator_id=None,
    entity_id=None,
):
    if year:
        query = query.filter(extract("year", EntityRecord.record_date) == year)
    if month:
        query = query.filter(extract("month", EntityRecord.record_date) == month)
    if day:
        query = query.filter(extract("day", EntityRecord.record_date) == day)
    if level:
        query = query.filter(Indicator.meeting_level == level)
    if process_id:
        query = query.filter(Indicator.process_id == process_id)
    if indicator_id:
        query = query.filter(EntityRecord.indicator_id == indicator_id)
    if entity_id:
        query = query.filter(EntityRecord.entity_id == entity_id)
    return query


def get_period_dates(period: str):
    today = date.today()
    if period == "day":
        return today, today
    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, today
    if period == "month":
        start = today.replace(day=1)
        return start, today
    if period == "year":
        start = today.replace(month=1, day=1)
        return start, today
    raise HTTPException(status_code=400, detail="Periodo no válido. Use day, week, month o year.")


def get_month_start_end(year: int, month: int):
    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1])
    return start, end


def build_daily_record_out(record: DailyRecord):
    return DailyRecordOut(
        id=record.id,
        indicator_id=record.indicator.id,
        indicator_code=record.indicator.code,
        indicator_name=record.indicator.name,
        process_id=record.indicator.process.id,
        process_name=record.indicator.process.name,
        meeting_level=record.indicator.meeting_level,
        record_date=record.record_date,
        single_value=record.single_value,
        shift_a=record.shift_a,
        shift_b=record.shift_b,
        shift_c=record.shift_c,
        general=record.general,
        status=record.status,
        observation=record.observation,
        unit=record.indicator.unit,
        frequency=record.indicator.frequency,
        capture_mode=record.indicator.capture_mode,
        shifts=record.indicator.shifts,
        scope_type=record.indicator.scope_type,
    )


def format_week_label(start_date: date, end_date: date, index: int):
    return f"Semana {index} | {start_date.strftime('%d/%m')} - {end_date.strftime('%d/%m')}"


def build_matrix_rows(year: int, month: int, indicator: Indicator, existing_records: list[DailyRecord]):
    frequency = normalize_frequency(indicator.frequency)
    records_map = {r.record_date: r for r in existing_records}
    result = []

    if frequency == "day":
        total_days = calendar.monthrange(year, month)[1]
        for day_number in range(1, total_days + 1):
            current_date = date(year, month, day_number)
            existing = records_map.get(current_date)
            result.append({
                "record_date": current_date,
                "period_label": current_date.strftime("%d/%m/%Y"),
                "single_value": existing.single_value if existing else None,
                "shift_a": existing.shift_a if existing else None,
                "shift_b": existing.shift_b if existing else None,
                "shift_c": existing.shift_c if existing else None,
                "observation": existing.observation if existing else "",
            })
        return result

    if frequency == "week":
        month_start = date(year, month, 1)
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        current_start = month_start - timedelta(days=month_start.weekday())
        index = 1

        while current_start <= month_end:
            current_end = current_start + timedelta(days=6)
            existing = records_map.get(current_start)

            result.append({
                "record_date": current_start,
                "period_label": format_week_label(current_start, current_end, index),
                "single_value": existing.single_value if existing else None,
                "shift_a": existing.shift_a if existing else None,
                "shift_b": existing.shift_b if existing else None,
                "shift_c": existing.shift_c if existing else None,
                "observation": existing.observation if existing else "",
            })

            current_start = current_start + timedelta(days=7)
            index += 1

        return result

    if frequency == "month":
        current_date = date(year, month, 1)
        existing = records_map.get(current_date)
        return [{
            "record_date": current_date,
            "period_label": current_date.strftime("%m/%Y"),
            "single_value": existing.single_value if existing else None,
            "shift_a": existing.shift_a if existing else None,
            "shift_b": existing.shift_b if existing else None,
            "shift_c": existing.shift_c if existing else None,
            "observation": existing.observation if existing else "",
        }]

    raise HTTPException(status_code=400, detail="Frecuencia no soportada para la matriz")


def build_indicator_out(indicator: Indicator):
    return IndicatorOut(
        id=indicator.id,
        code=indicator.code,
        name=indicator.name,
        process_id=indicator.process_id,
        meeting_level=indicator.meeting_level,
        unit=indicator.unit,
        target_operator=indicator.target_operator,
        target_value=indicator.target_value,
        warning_operator=normalize_optional_operator(indicator.warning_operator),
        warning_value=normalize_optional_number(indicator.warning_value),
        critical_operator=normalize_optional_operator(indicator.critical_operator),
        critical_value=normalize_optional_number(indicator.critical_value),
        frequency=normalize_frequency(indicator.frequency),
        capture_mode=normalize_capture_mode(indicator.capture_mode),
        shifts="" if normalize_capture_mode(indicator.capture_mode) == "single" else (indicator.shifts or ""),
        scope_type=normalize_scope_type(indicator.scope_type),
        process_name=indicator.process.name,
        process_level=indicator.process.level,
    )


def build_entity_out(item: Entity):
    return EntityOut(
        id=item.id,
        code=item.code,
        name=item.name,
        entity_type=item.entity_type,
        document=item.document,
        position=item.position,
        area=item.area,
        is_active=item.is_active,
    )


def build_entity_target_out(item: EntityIndicatorTarget):
    return EntityIndicatorTargetOut(
        id=item.id,
        indicator_id=item.indicator_id,
        entity_id=item.entity_id,
        target_value=item.target_value,
        is_active=item.is_active,
        indicator_code=item.indicator.code,
        indicator_name=item.indicator.name,
        entity_code=item.entity.code,
        entity_name=item.entity.name,
        entity_type=item.entity.entity_type,
    )


def build_entity_record_out(item: EntityRecord):
    return EntityRecordOut(
        id=item.id,
        indicator_id=item.indicator_id,
        indicator_code=item.indicator.code,
        indicator_name=item.indicator.name,
        entity_id=item.entity_id,
        entity_code=item.entity.code,
        entity_name=item.entity.name,
        entity_type=item.entity.entity_type,
        record_date=item.record_date,
        value=item.value,
        observation=item.observation,
    )


def build_entity_history_row(item: EntityRecord):
    target_value = 0.0
    target = (
        item.indicator.entity_indicator_targets
        if hasattr(item.indicator, "entity_indicator_targets")
        else []
    )

    for current in target:
        if current.entity_id == item.entity_id and current.is_active:
            target_value = float(current.target_value or 0)
            break

    general = calculate_compliance_by_rule(
        item.indicator.target_operator,
        target_value,
        float(item.value if item.value is not None else 0),
    )
    status = calculate_entity_status(item.indicator, general)

    return {
        "id": item.id,
        "indicator_id": item.indicator_id,
        "indicator_code": item.indicator.code,
        "indicator_name": item.indicator.name,
        "process_id": item.indicator.process.id,
        "process_name": item.indicator.process.name,
        "meeting_level": item.indicator.meeting_level,
        "entity_id": item.entity_id,
        "entity_code": item.entity.code,
        "entity_name": item.entity.name,
        "entity_type": item.entity.entity_type,
        "record_date": item.record_date,
        "value": round(float(item.value if item.value is not None else 0), 2),
        "general": general,
        "status": status,
        "observation": item.observation,
        "unit": item.indicator.unit,
        "frequency": item.indicator.frequency,
        "capture_mode": item.indicator.capture_mode,
        "scope_type": item.indicator.scope_type,
        "target_value": round(target_value, 2),
    }


def build_entity_history_summary(records: list[EntityRecord]):
    if not records:
        return {
            "total_records": 0,
            "average_general": 0,
            "ok_count": 0,
            "warning_count": 0,
            "critical_count": 0,
            "processes": []
        }

    rows = [build_entity_history_row(item) for item in records]

    total_records = len(rows)
    average_general = round(sum(r["general"] for r in rows) / total_records, 2)
    ok_count = len([r for r in rows if r["status"] == "ok"])
    warning_count = len([r for r in rows if r["status"] == "warning"])
    critical_count = len([r for r in rows if r["status"] == "critical"])

    grouped = defaultdict(list)
    for row in rows:
        grouped[row["process_name"]].append(row)

    processes = []
    for process_name, items in grouped.items():
        avg = round(sum(x["general"] for x in items) / len(items), 2)
        processes.append({
            "process_name": process_name,
            "total_records": len(items),
            "average_general": avg,
            "ok_count": len([x for x in items if x["status"] == "ok"]),
            "warning_count": len([x for x in items if x["status"] == "warning"]),
            "critical_count": len([x for x in items if x["status"] == "critical"]),
        })

    processes.sort(key=lambda x: x["process_name"])

    return {
        "total_records": total_records,
        "average_general": average_general,
        "ok_count": ok_count,
        "warning_count": warning_count,
        "critical_count": critical_count,
        "processes": processes,
    }


def build_legacy_person_out(item: Entity):
    return {
        "id": item.id,
        "code": item.code,
        "full_name": item.name,
        "name": item.name,
        "entity_type": item.entity_type,
        "document": item.document,
        "position": item.position,
        "area": item.area,
        "is_active": item.is_active,
    }


def build_legacy_person_target_out(item: EntityIndicatorTarget):
    return {
        "id": item.id,
        "indicator_id": item.indicator_id,
        "person_id": item.entity_id,
        "target_value": item.target_value,
        "is_active": item.is_active,
        "indicator_code": item.indicator.code,
        "indicator_name": item.indicator.name,
        "person_code": item.entity.code,
        "person_name": item.entity.name,
        "entity_type": item.entity.entity_type,
    }


def build_legacy_person_record_out(item: EntityRecord):
    return {
        "id": item.id,
        "indicator_id": item.indicator_id,
        "indicator_code": item.indicator.code,
        "indicator_name": item.indicator.name,
        "person_id": item.entity_id,
        "person_code": item.entity.code,
        "person_name": item.entity.name,
        "record_date": item.record_date,
        "value": item.value,
        "observation": item.observation,
    }


@app.get("/")
def root():
    return {"message": "ETO DIGITAL API OK"}


# -------------------------
# PROCESOS
# -------------------------
@app.post("/processes", response_model=ProcessOut)
def create_process(payload: ProcessCreate, db: Session = Depends(get_db)):
    exists = db.query(Process).filter(Process.name == payload.name.strip()).first()
    if exists:
        raise HTTPException(status_code=400, detail="El proceso ya existe")

    process = Process(name=payload.name.strip(), level=payload.level)
    db.add(process)
    db.commit()
    db.refresh(process)
    return process


@app.get("/processes", response_model=list[ProcessOut])
def list_processes(level: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Process)
    if level:
        query = query.filter(Process.level == level)
    return query.order_by(Process.level.asc(), Process.name.asc()).all()


@app.put("/processes/{process_id}", response_model=ProcessOut)
def update_process(process_id: int, payload: ProcessCreate, db: Session = Depends(get_db)):
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    exists = (
        db.query(Process)
        .filter(Process.name == payload.name.strip(), Process.id != process_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Ya existe otro proceso con ese nombre")

    process.name = payload.name.strip()
    process.level = payload.level

    db.commit()
    db.refresh(process)
    return process


@app.delete("/processes/{process_id}")
def delete_process(process_id: int, db: Session = Depends(get_db)):
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    db.delete(process)
    db.commit()
    return {"message": "Proceso eliminado correctamente"}


# -------------------------
# INDICADORES
# -------------------------
@app.post("/indicators", response_model=IndicatorOut)
def create_indicator(payload: IndicatorCreate, db: Session = Depends(get_db)):
    process = db.query(Process).filter(Process.id == payload.process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    shifts_clean = validate_indicator_payload(payload)
    code = generate_indicator_code(db)

    indicator = Indicator(
        code=code,
        name=payload.name.strip(),
        process_id=payload.process_id,
        meeting_level=payload.meeting_level,
        unit=payload.unit,
        target_operator=payload.target_operator,
        target_value=payload.target_value,
        warning_operator=payload.warning_operator,
        warning_value=payload.warning_value,
        critical_operator=payload.critical_operator,
        critical_value=payload.critical_value,
        frequency=payload.frequency,
        capture_mode="single" if payload.capture_mode == "single" else "shifts",
        shifts="" if payload.capture_mode == "single" else ",".join(shifts_clean),
        scope_type=payload.scope_type,
    )
    db.add(indicator)
    db.commit()
    db.refresh(indicator)

    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == indicator.id).first()
    return build_indicator_out(indicator)


@app.get("/indicators", response_model=list[IndicatorOut])
def list_indicators(
    process_id: Optional[int] = None,
    level: Optional[int] = None,
    scope_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Indicator).options(joinedload(Indicator.process))

    if process_id:
        query = query.filter(Indicator.process_id == process_id)
    if level:
        query = query.filter(Indicator.meeting_level == level)
    if scope_type:
        query = query.filter(Indicator.scope_type == normalize_scope_type(scope_type))

    items = query.order_by(Indicator.code.asc()).all()
    return [build_indicator_out(i) for i in items]


@app.put("/indicators/{indicator_id}", response_model=IndicatorOut)
def update_indicator(indicator_id: int, payload: IndicatorCreate, db: Session = Depends(get_db)):
    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    process = db.query(Process).filter(Process.id == payload.process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    shifts_clean = validate_indicator_payload(payload)

    indicator.name = payload.name.strip()
    indicator.process_id = payload.process_id
    indicator.meeting_level = payload.meeting_level
    indicator.unit = payload.unit
    indicator.target_operator = payload.target_operator
    indicator.target_value = payload.target_value
    indicator.warning_operator = payload.warning_operator
    indicator.warning_value = payload.warning_value
    indicator.critical_operator = payload.critical_operator
    indicator.critical_value = payload.critical_value
    indicator.frequency = payload.frequency
    indicator.capture_mode = "single" if payload.capture_mode == "single" else "shifts"
    indicator.shifts = "" if payload.capture_mode == "single" else ",".join(shifts_clean)
    indicator.scope_type = payload.scope_type

    if indicator.capture_mode == "single":
        records = db.query(DailyRecord).filter(DailyRecord.indicator_id == indicator.id).all()
        for r in records:
            r.shift_a = None
            r.shift_b = None
            r.shift_c = None

    db.commit()
    db.refresh(indicator)

    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == indicator.id).first()
    return build_indicator_out(indicator)


@app.delete("/indicators/{indicator_id}")
def delete_indicator(indicator_id: int, db: Session = Depends(get_db)):
    indicator = db.query(Indicator).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    db.delete(indicator)
    db.commit()
    return {"message": "Indicador eliminado correctamente"}


# -------------------------
# DAILY RECORDS
# -------------------------
@app.post("/daily-records", response_model=DailyRecordOut)
def save_daily_record(payload: DailyRecordCreate, db: Session = Depends(get_db)):
    indicator = (
        db.query(Indicator)
        .options(joinedload(Indicator.process))
        .filter(Indicator.id == payload.indicator_id)
        .first()
    )
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    validate_record_payload(indicator, payload)

    single_value, shift_a, shift_b, shift_c = sanitize_record_values_for_mode(
        indicator.capture_mode,
        payload.single_value,
        payload.shift_a,
        payload.shift_b,
        payload.shift_c,
    )

    measured_value = calculate_measured_value(indicator, single_value, shift_a, shift_b, shift_c)
    general = calculate_general(indicator, measured_value)
    status = calculate_status(indicator, measured_value)

    record = (
        db.query(DailyRecord)
        .filter(
            DailyRecord.indicator_id == payload.indicator_id,
            DailyRecord.record_date == payload.record_date
        )
        .first()
    )

    if record:
        record.single_value = single_value
        record.shift_a = shift_a
        record.shift_b = shift_b
        record.shift_c = shift_c
        record.general = general
        record.status = status
        record.observation = payload.observation
    else:
        record = DailyRecord(
            indicator_id=payload.indicator_id,
            record_date=payload.record_date,
            single_value=single_value,
            shift_a=shift_a,
            shift_b=shift_b,
            shift_c=shift_c,
            general=general,
            status=status,
            observation=payload.observation,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    record = (
        db.query(DailyRecord)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
        .filter(DailyRecord.id == record.id)
        .first()
    )
    return build_daily_record_out(record)


@app.put("/daily-records/{record_id}", response_model=DailyRecordOut)
def update_daily_record(record_id: int, payload: DailyRecordCreate, db: Session = Depends(get_db)):
    record = (
        db.query(DailyRecord)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
        .filter(DailyRecord.id == record_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    indicator = (
        db.query(Indicator)
        .options(joinedload(Indicator.process))
        .filter(Indicator.id == payload.indicator_id)
        .first()
    )
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    duplicate = (
        db.query(DailyRecord)
        .filter(
            DailyRecord.id != record_id,
            DailyRecord.indicator_id == payload.indicator_id,
            DailyRecord.record_date == payload.record_date
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Ya existe otro registro para ese indicador en esa fecha")

    validate_record_payload(indicator, payload)

    single_value, shift_a, shift_b, shift_c = sanitize_record_values_for_mode(
        indicator.capture_mode,
        payload.single_value,
        payload.shift_a,
        payload.shift_b,
        payload.shift_c,
    )

    measured_value = calculate_measured_value(indicator, single_value, shift_a, shift_b, shift_c)
    general = calculate_general(indicator, measured_value)
    record_status = calculate_status(indicator, measured_value)

    record.indicator_id = payload.indicator_id
    record.record_date = payload.record_date
    record.single_value = single_value
    record.shift_a = shift_a
    record.shift_b = shift_b
    record.shift_c = shift_c
    record.general = general
    record.status = record_status
    record.observation = payload.observation

    db.commit()
    db.refresh(record)

    record = (
        db.query(DailyRecord)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
        .filter(DailyRecord.id == record_id)
        .first()
    )
    return build_daily_record_out(record)


@app.delete("/daily-records/{record_id}")
def delete_daily_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DailyRecord).filter(DailyRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    db.delete(record)
    db.commit()
    return {"message": "Registro eliminado correctamente"}


@app.get("/daily-records/by-date", response_model=list[DailyRecordOut])
def get_daily_by_date(
    record_date: date,
    process_id: Optional[int] = None,
    level: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(DailyRecord)
        .join(DailyRecord.indicator)
        .join(Indicator.process)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
        .filter(DailyRecord.record_date == record_date)
        .filter(Indicator.scope_type == "standard")
    )

    if process_id:
        query = query.filter(Indicator.process_id == process_id)
    if level:
        query = query.filter(Indicator.meeting_level == level)

    records = query.order_by(Indicator.code.asc()).all()
    return [build_daily_record_out(r) for r in records]


@app.get("/daily-records/matrix")
def get_period_matrix(
    year: int,
    month: int,
    indicator_id: int,
    db: Session = Depends(get_db)
):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mes no válido")

    indicator = (
        db.query(Indicator)
        .options(joinedload(Indicator.process))
        .filter(Indicator.id == indicator_id)
        .first()
    )
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    if indicator.scope_type != "standard":
        raise HTTPException(status_code=400, detail="Este indicador usa captura por entidad")

    month_start = date(year, month, 1)
    month_end = date(year, month, calendar.monthrange(year, month)[1])

    if indicator.frequency == "week":
        query_start = month_start - timedelta(days=month_start.weekday())
        query_end = month_end
    elif indicator.frequency == "month":
        query_start = month_start
        query_end = month_start
    else:
        query_start = month_start
        query_end = month_end

    existing_records = (
        db.query(DailyRecord)
        .filter(
            DailyRecord.indicator_id == indicator_id,
            DailyRecord.record_date >= query_start,
            DailyRecord.record_date <= query_end
        )
        .order_by(DailyRecord.record_date.asc())
        .all()
    )

    rows = build_matrix_rows(year, month, indicator, existing_records)

    return {
        "indicator_id": indicator.id,
        "indicator_code": indicator.code,
        "indicator_name": indicator.name,
        "process_id": indicator.process.id,
        "process_name": indicator.process.name,
        "meeting_level": indicator.meeting_level,
        "unit": indicator.unit,
        "target_operator": indicator.target_operator,
        "target_value": indicator.target_value,
        "warning_operator": normalize_optional_operator(indicator.warning_operator),
        "warning_value": normalize_optional_number(indicator.warning_value),
        "critical_operator": normalize_optional_operator(indicator.critical_operator),
        "critical_value": normalize_optional_number(indicator.critical_value),
        "frequency": indicator.frequency,
        "capture_mode": indicator.capture_mode,
        "shifts": indicator.shifts,
        "scope_type": indicator.scope_type,
        "rows": rows,
    }


@app.post("/daily-records/matrix")
def save_period_matrix(payload: PeriodRecordSave, db: Session = Depends(get_db)):
    indicator = (
        db.query(Indicator)
        .options(joinedload(Indicator.process))
        .filter(Indicator.id == payload.indicator_id)
        .first()
    )
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")

    if indicator.scope_type != "standard":
        raise HTTPException(status_code=400, detail="Este indicador usa captura por entidad")

    saved = 0
    deleted = 0

    for row in payload.rows:
        existing = (
            db.query(DailyRecord)
            .filter(
                DailyRecord.indicator_id == payload.indicator_id,
                DailyRecord.record_date == row.record_date
            )
            .first()
        )

        has_values = row_has_values(indicator, row)
        has_observation = bool((row.observation or "").strip())

        if not has_values and not has_observation:
            if existing:
                db.delete(existing)
                deleted += 1
            continue

        if indicator.capture_mode == "single" and row.single_value is None:
            raise HTTPException(status_code=400, detail=f"Falta valor único para la fila {row.record_date}")

        if indicator.capture_mode == "shifts":
            enabled = get_enabled_shifts(indicator)
            has_any_shift = (
                ("A" in enabled and row.shift_a is not None)
                or ("B" in enabled and row.shift_b is not None)
                or ("C" in enabled and row.shift_c is not None)
            )
            if not has_any_shift:
                raise HTTPException(
                    status_code=400,
                    detail=f"Debes registrar al menos un turno habilitado en la fila {row.record_date}"
                )

        single_value, shift_a, shift_b, shift_c = sanitize_record_values_for_mode(
            indicator.capture_mode,
            row.single_value,
            row.shift_a,
            row.shift_b,
            row.shift_c,
        )

        measured_value = calculate_measured_value(indicator, single_value, shift_a, shift_b, shift_c)
        general = calculate_general(indicator, measured_value)
        record_status = calculate_status(indicator, measured_value)

        if existing:
            existing.single_value = single_value
            existing.shift_a = shift_a
            existing.shift_b = shift_b
            existing.shift_c = shift_c
            existing.general = general
            existing.status = record_status
            existing.observation = row.observation
        else:
            new_record = DailyRecord(
                indicator_id=payload.indicator_id,
                record_date=row.record_date,
                single_value=single_value,
                shift_a=shift_a,
                shift_b=shift_b,
                shift_c=shift_c,
                general=general,
                status=record_status,
                observation=row.observation,
            )
            db.add(new_record)

        saved += 1

    db.commit()
    return {
        "message": "Carga masiva guardada correctamente",
        "saved_rows": saved,
        "deleted_rows": deleted,
        "frequency": indicator.frequency,
        "capture_mode": indicator.capture_mode,
    }


@app.get("/daily-records/month")
def get_month_matrix(
    year: int,
    month: int,
    indicator_id: int,
    db: Session = Depends(get_db)
):
    return get_period_matrix(year=year, month=month, indicator_id=indicator_id, db=db)


@app.post("/daily-records/month")
def save_month_matrix(payload: MonthlyRecordSave, db: Session = Depends(get_db)):
    converted_rows = [
        {
            "record_date": row.record_date,
            "single_value": row.single_value,
            "shift_a": row.shift_a,
            "shift_b": row.shift_b,
            "shift_c": row.shift_c,
            "observation": row.observation,
        }
        for row in payload.rows
    ]
    return save_period_matrix(
        payload=PeriodRecordSave(
            indicator_id=payload.indicator_id,
            rows=converted_rows,
        ),
        db=db,
    )


# -------------------------
# HISTORY STANDARD
# -------------------------
@app.get("/history", response_model=list[DailyRecordOut])
def get_history(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id, indicator_id)
    records = query.order_by(DailyRecord.record_date.desc(), Indicator.code.asc()).all()
    return [build_daily_record_out(r) for r in records]


@app.get("/history/summary")
def get_history_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id, indicator_id)
    records = query.all()

    if not records:
        return {
            "total_records": 0,
            "average_general": 0,
            "ok_count": 0,
            "warning_count": 0,
            "critical_count": 0,
            "processes": []
        }

    total_records = len(records)
    average_general = round(sum(r.general for r in records) / total_records, 2)
    ok_count = len([r for r in records if r.status == "ok"])
    warning_count = len([r for r in records if r.status == "warning"])
    critical_count = len([r for r in records if r.status == "critical"])

    grouped = defaultdict(list)
    for r in records:
        grouped[r.indicator.process.name].append(r)

    processes = []
    for process_name, items in grouped.items():
        avg = round(sum(x.general for x in items) / len(items), 2)
        processes.append({
            "process_name": process_name,
            "total_records": len(items),
            "average_general": avg,
            "ok_count": len([x for x in items if x.status == "ok"]),
            "warning_count": len([x for x in items if x.status == "warning"]),
            "critical_count": len([x for x in items if x.status == "critical"]),
        })

    processes.sort(key=lambda x: x["process_name"])

    return {
        "total_records": total_records,
        "average_general": average_general,
        "ok_count": ok_count,
        "warning_count": warning_count,
        "critical_count": critical_count,
        "processes": processes
    }


# -------------------------
# HISTORY ENTITY
# -------------------------
@app.get("/history/entity")
def get_entity_history(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_entity_history_query(db).options(
        joinedload(EntityRecord.indicator).joinedload(Indicator.process),
        joinedload(EntityRecord.entity),
        joinedload(EntityRecord.indicator).joinedload(Indicator.entity_indicator_targets),
    )
    query = apply_entity_record_filters(
        query,
        year=year,
        month=month,
        day=day,
        level=level,
        process_id=process_id,
        indicator_id=indicator_id,
        entity_id=entity_id,
    )
    records = query.order_by(EntityRecord.record_date.desc(), Indicator.code.asc(), Entity.id.asc()).all()
    return [build_entity_history_row(item) for item in records]


@app.get("/history/entity/summary")
def get_entity_history_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_entity_history_query(db).options(
        joinedload(EntityRecord.indicator).joinedload(Indicator.process),
        joinedload(EntityRecord.entity),
        joinedload(EntityRecord.indicator).joinedload(Indicator.entity_indicator_targets),
    )
    query = apply_entity_record_filters(
        query,
        year=year,
        month=month,
        day=day,
        level=level,
        process_id=process_id,
        indicator_id=indicator_id,
        entity_id=entity_id,
    )
    records = query.all()
    return build_entity_history_summary(records)


# -------------------------
# DASHBOARD OVERVIEW / PROCESS
# -------------------------
@app.get("/dashboard/overview")
def get_dashboard_overview(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, None, None)
    records = query.order_by(DailyRecord.record_date.asc()).all()

    if not records:
        return {
            "summary": {
                "total_records": 0,
                "average_general": 0,
                "ok_count": 0,
                "warning_count": 0,
                "critical_count": 0,
            },
            "process_cards": [],
            "process_ranking": [],
            "status_distribution": [],
        }

    total_records = len(records)
    average_general = round(sum(r.general for r in records) / total_records, 2)
    ok_count = len([r for r in records if r.status == "ok"])
    warning_count = len([r for r in records if r.status == "warning"])
    critical_count = len([r for r in records if r.status == "critical"])

    grouped = defaultdict(list)
    for r in records:
        grouped[r.indicator.process.name].append(r)

    process_cards = []
    for process_name, items in grouped.items():
        avg = round(sum(x.general for x in items) / len(items), 2)
        process_cards.append({
            "process_name": process_name,
            "average_general": avg,
            "total_records": len(items),
            "ok_count": len([x for x in items if x.status == "ok"]),
            "warning_count": len([x for x in items if x.status == "warning"]),
            "critical_count": len([x for x in items if x.status == "critical"]),
        })

    process_cards.sort(key=lambda x: x["average_general"], reverse=True)

    status_distribution = [
        {"name": "OK", "value": ok_count},
        {"name": "Warning", "value": warning_count},
        {"name": "Critical", "value": critical_count},
    ]

    ranking = [{"name": x["process_name"], "value": x["average_general"]} for x in process_cards]

    return {
        "summary": {
            "total_records": total_records,
            "average_general": average_general,
            "ok_count": ok_count,
            "warning_count": warning_count,
            "critical_count": critical_count,
        },
        "process_cards": process_cards,
        "process_ranking": ranking,
        "status_distribution": status_distribution,
    }


@app.get("/dashboard/process")
def get_process_dashboard(
    process_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    period: Optional[str] = None,
    indicator_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id, indicator_id)

    if period and not any([year, month, day]):
        start_date, end_date = get_period_dates(period)
        query = query.filter(DailyRecord.record_date >= start_date)
        query = query.filter(DailyRecord.record_date <= end_date)

    records = query.order_by(DailyRecord.record_date.asc(), Indicator.code.asc()).all()

    if not records:
        return {
            "process": {"id": process.id, "name": process.name, "level": process.level},
            "summary": {
                "average_general": 0,
                "total_records": 0,
                "ok_count": 0,
                "warning_count": 0,
                "critical_count": 0
            },
            "trend": [],
            "indicator_cards": [],
            "indicator_trends": [],
            "pareto": [],
            "status_distribution": []
        }

    total_records = len(records)
    average_general = round(sum(r.general for r in records) / total_records, 2)
    ok_count = len([r for r in records if r.status == "ok"])
    warning_count = len([r for r in records if r.status == "warning"])
    critical_count = len([r for r in records if r.status == "critical"])

    trend_map = defaultdict(list)
    for r in records:
        trend_map[str(r.record_date)].append(r.general)

    trend = []
    for label, values in sorted(trend_map.items()):
        trend.append({"label": label, "value": round(sum(values) / len(values), 2)})

    latest_by_indicator = {}
    grouped_indicator_records = defaultdict(list)

    for r in records:
        latest_by_indicator[r.indicator_id] = r
        grouped_indicator_records[r.indicator_id].append(r)

    indicator_cards = []
    indicator_trends = []

    for current_indicator_id, latest_record in latest_by_indicator.items():
        trend_records = grouped_indicator_records[current_indicator_id]
        ordered = sorted(trend_records, key=lambda x: x.record_date)

        trend_values = [{"label": str(x.record_date), "value": x.general} for x in ordered]

        direction = "stable"
        if len(ordered) >= 2:
            first_value = ordered[0].general
            last_value = ordered[-1].general
            if last_value > first_value:
                direction = "up"
            elif last_value < first_value:
                direction = "down"

        indicator_cards.append({
            "indicator_id": latest_record.indicator.id,
            "code": latest_record.indicator.code,
            "name": latest_record.indicator.name,
            "unit": latest_record.indicator.unit,
            "frequency": latest_record.indicator.frequency,
            "capture_mode": latest_record.indicator.capture_mode,
            "general": latest_record.general,
            "status": latest_record.status,
            "target_operator": latest_record.indicator.target_operator,
            "target_value": latest_record.indicator.target_value,
            "warning_operator": normalize_optional_operator(latest_record.indicator.warning_operator),
            "warning_value": normalize_optional_number(latest_record.indicator.warning_value),
            "critical_operator": normalize_optional_operator(latest_record.indicator.critical_operator),
            "critical_value": normalize_optional_number(latest_record.indicator.critical_value),
            "direction": direction,
        })

        indicator_trends.append({
            "indicator_id": latest_record.indicator.id,
            "code": latest_record.indicator.code,
            "name": latest_record.indicator.name,
            "unit": latest_record.indicator.unit,
            "direction": direction,
            "points": trend_values,
            "last_value": latest_record.general,
        })

    indicator_cards.sort(key=lambda x: x["code"])
    indicator_trends.sort(key=lambda x: x["code"])

    impact_map = defaultdict(float)
    for r in records:
        score = 3 if r.status == "critical" else 2 if r.status == "warning" else 1
        impact_map[f"{r.indicator.code} - {r.indicator.name}"] += score

    total_impact = sum(impact_map.values()) if impact_map else 0
    running = 0
    pareto = []

    for name, value in sorted(impact_map.items(), key=lambda x: x[1], reverse=True):
        pct = round((value / total_impact) * 100, 2) if total_impact else 0
        running += pct
        pareto.append({
            "name": name,
            "value": round(value, 2),
            "percentage": pct,
            "cumulative": round(running, 2)
        })

    status_distribution = [
        {"name": "OK", "value": ok_count},
        {"name": "Warning", "value": warning_count},
        {"name": "Critical", "value": critical_count},
    ]

    return {
        "process": {"id": process.id, "name": process.name, "level": process.level},
        "summary": {
            "average_general": average_general,
            "total_records": total_records,
            "ok_count": ok_count,
            "warning_count": warning_count,
            "critical_count": critical_count
        },
        "trend": trend,
        "indicator_cards": indicator_cards,
        "indicator_trends": indicator_trends,
        "pareto": pareto,
        "status_distribution": status_distribution
    }


# -------------------------
# ENTIDADES
# -------------------------
@app.post("/entities", response_model=EntityOut)
def create_entity(payload: EntityCreate, db: Session = Depends(get_db)):
    code = payload.code.strip() if payload.code.strip() else generate_entity_code(db)

    exists_code = db.query(Entity).filter(Entity.code == code).first()
    if exists_code:
        raise HTTPException(status_code=400, detail="Ya existe una entidad con ese código")

    if payload.document:
        exists_doc = db.query(Entity).filter(Entity.document == payload.document.strip()).first()
        if exists_doc:
            raise HTTPException(status_code=400, detail="Ya existe una entidad con ese documento")

    entity = Entity(
        code=code,
        name=payload.name.strip(),
        entity_type=(payload.entity_type or "persona").strip(),
        document=payload.document.strip() if payload.document else None,
        position=payload.position.strip() if payload.position else None,
        area=payload.area.strip() if payload.area else None,
        is_active=payload.is_active,
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return build_entity_out(entity)


@app.get("/entities", response_model=list[EntityOut])
def list_entities(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Entity)
    if active_only:
        query = query.filter(Entity.is_active == True)
    return [build_entity_out(item) for item in query.order_by(Entity.name.asc()).all()]


@app.put("/entities/{entity_id}", response_model=EntityOut)
def update_entity(entity_id: int, payload: EntityCreate, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")

    code = payload.code.strip() if payload.code.strip() else entity.code

    exists_code = db.query(Entity).filter(Entity.code == code, Entity.id != entity_id).first()
    if exists_code:
        raise HTTPException(status_code=400, detail="Ya existe otra entidad con ese código")

    if payload.document:
        exists_doc = db.query(Entity).filter(
            Entity.document == payload.document.strip(),
            Entity.id != entity_id
        ).first()
        if exists_doc:
            raise HTTPException(status_code=400, detail="Ya existe otra entidad con ese documento")

    entity.code = code
    entity.name = payload.name.strip()
    entity.entity_type = (payload.entity_type or entity.entity_type or "persona").strip()
    entity.document = payload.document.strip() if payload.document else None
    entity.position = payload.position.strip() if payload.position else None
    entity.area = payload.area.strip() if payload.area else None
    entity.is_active = payload.is_active

    db.commit()
    db.refresh(entity)
    return build_entity_out(entity)


@app.delete("/entities/{entity_id}")
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")

    db.delete(entity)
    db.commit()
    return {"message": "Entidad eliminada correctamente"}


# -------------------------
# METAS POR ENTIDAD
# -------------------------
@app.post("/entity-indicator-targets", response_model=EntityIndicatorTargetOut)
def create_or_update_entity_target(payload: EntityIndicatorTargetCreate, db: Session = Depends(get_db)):
    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == payload.indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    if indicator.scope_type != "entity":
        raise HTTPException(status_code=400, detail="El indicador no es de tipo entidad")

    entity = db.query(Entity).filter(Entity.id == payload.entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")

    item = db.query(EntityIndicatorTarget).filter(
        EntityIndicatorTarget.indicator_id == payload.indicator_id,
        EntityIndicatorTarget.entity_id == payload.entity_id
    ).first()

    if item:
        item.target_value = payload.target_value
        item.is_active = payload.is_active
    else:
        item = EntityIndicatorTarget(
            indicator_id=payload.indicator_id,
            entity_id=payload.entity_id,
            target_value=payload.target_value,
            is_active=payload.is_active,
        )
        db.add(item)

    db.commit()
    db.refresh(item)
    item = db.query(EntityIndicatorTarget).options(
        joinedload(EntityIndicatorTarget.indicator),
        joinedload(EntityIndicatorTarget.entity)
    ).filter(EntityIndicatorTarget.id == item.id).first()
    return build_entity_target_out(item)


@app.get("/entity-indicator-targets", response_model=list[EntityIndicatorTargetOut])
def list_entity_targets(
    indicator_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(EntityIndicatorTarget).options(
        joinedload(EntityIndicatorTarget.indicator),
        joinedload(EntityIndicatorTarget.entity)
    )

    if indicator_id:
        query = query.filter(EntityIndicatorTarget.indicator_id == indicator_id)
    if entity_id:
        query = query.filter(EntityIndicatorTarget.entity_id == entity_id)
    if active_only:
        query = query.filter(EntityIndicatorTarget.is_active == True)

    items = query.join(EntityIndicatorTarget.entity).order_by(Entity.name.asc()).all()
    return [build_entity_target_out(x) for x in items]


@app.delete("/entity-indicator-targets/{target_id}")
def delete_entity_target(target_id: int, db: Session = Depends(get_db)):
    item = db.query(EntityIndicatorTarget).filter(EntityIndicatorTarget.id == target_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    db.delete(item)
    db.commit()
    return {"message": "Asignación eliminada correctamente"}


# -------------------------
# CAPTURA POR ENTIDAD
# -------------------------
@app.get("/entity-records/grid", response_model=EntityCaptureGridOut)
def get_entity_capture_grid(
    indicator_id: int,
    record_date: date,
    db: Session = Depends(get_db)
):
    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    if indicator.scope_type != "entity":
        raise HTTPException(status_code=400, detail="El indicador no es de tipo entidad")

    period_start = record_date.replace(day=1)
    period_end = record_date

    targets = db.query(EntityIndicatorTarget).options(
        joinedload(EntityIndicatorTarget.entity)
    ).filter(
        EntityIndicatorTarget.indicator_id == indicator_id,
        EntityIndicatorTarget.is_active == True
    ).join(EntityIndicatorTarget.entity).order_by(Entity.name.asc()).all()

    current_records = db.query(EntityRecord).filter(
        EntityRecord.indicator_id == indicator_id,
        EntityRecord.record_date == record_date
    ).all()
    current_map = {x.entity_id: x for x in current_records}

    accumulated_rows = db.query(
        EntityRecord.entity_id,
        text("COALESCE(SUM(value), 0) AS accumulated")
    ).filter(
        EntityRecord.indicator_id == indicator_id,
        EntityRecord.record_date >= period_start,
        EntityRecord.record_date <= period_end
    ).group_by(EntityRecord.entity_id).all()

    accumulated_map = {row[0]: float(row[1] or 0) for row in accumulated_rows}

    rows = []
    for target in targets:
        day_record = current_map.get(target.entity_id)
        day_value = float(day_record.value) if day_record and day_record.value is not None else 0.0
        accumulated = round(float(accumulated_map.get(target.entity_id, 0.0)), 2)
        target_value = round(float(target.target_value or 0), 2)
        remaining = round(max(target_value - accumulated, 0.0), 2)
        compliance = calculate_compliance_by_rule(
            indicator.target_operator,
            target_value,
            accumulated,
        )
        status = calculate_entity_status(indicator, accumulated)

        rows.append(EntityCaptureGridRow(
            entity_id=target.entity_id,
            entity_code=target.entity.code,
            entity_name=target.entity.name,
            entity_type=target.entity.entity_type,
            target_value=target_value,
            day_value=round(day_value, 2),
            accumulated=accumulated,
            remaining=remaining,
            compliance=compliance,
            status=status,
            observation=day_record.observation if day_record else None,
        ))

    return EntityCaptureGridOut(
        indicator_id=indicator.id,
        indicator_code=indicator.code,
        indicator_name=indicator.name,
        process_id=indicator.process.id,
        process_name=indicator.process.name,
        meeting_level=indicator.meeting_level,
        unit=indicator.unit,
        frequency=indicator.frequency,
        scope_type=indicator.scope_type,
        record_date=record_date,
        rows=rows,
    )


@app.post("/entity-records/bulk")
def save_entity_records_bulk(payload: EntityRecordBulkSave, db: Session = Depends(get_db)):
    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == payload.indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    if indicator.scope_type != "entity":
        raise HTTPException(status_code=400, detail="El indicador no es de tipo entidad")

    target_map = {
        x.entity_id: x
        for x in db.query(EntityIndicatorTarget).filter(
            EntityIndicatorTarget.indicator_id == payload.indicator_id,
            EntityIndicatorTarget.is_active == True
        ).all()
    }

    saved = 0
    deleted = 0

    for row in payload.rows:
        if row.entity_id not in target_map:
            raise HTTPException(
                status_code=400,
                detail=f"La entidad {row.entity_id} no está asociada al indicador"
            )

        existing = db.query(EntityRecord).filter(
            EntityRecord.indicator_id == payload.indicator_id,
            EntityRecord.entity_id == row.entity_id,
            EntityRecord.record_date == payload.record_date
        ).first()

        value_provided = has_explicit_value(getattr(row, "value", None))
        raw_value = float(row.value) if value_provided else None
        observation = (row.observation or "").strip()

        if not value_provided and not observation:
            if existing:
                db.delete(existing)
                deleted += 1
            continue

        if raw_value is None:
            raw_value = float(existing.value) if existing and existing.value is not None else 0.0

        if existing:
            existing.value = raw_value
            existing.observation = observation or None
        else:
            db.add(EntityRecord(
                indicator_id=payload.indicator_id,
                entity_id=row.entity_id,
                record_date=payload.record_date,
                value=raw_value,
                observation=observation or None,
            ))

        saved += 1

    db.commit()
    return {
        "message": "Captura por entidad guardada correctamente",
        "saved_rows": saved,
        "deleted_rows": deleted,
    }


@app.get("/entity-records", response_model=list[EntityRecordOut])
def list_entity_records(
    indicator_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EntityRecord).options(
        joinedload(EntityRecord.indicator),
        joinedload(EntityRecord.entity)
    )

    if indicator_id:
        query = query.filter(EntityRecord.indicator_id == indicator_id)
    if entity_id:
        query = query.filter(EntityRecord.entity_id == entity_id)
    if year:
        query = query.filter(extract("year", EntityRecord.record_date) == year)
    if month:
        query = query.filter(extract("month", EntityRecord.record_date) == month)

    items = query.order_by(EntityRecord.record_date.desc(), EntityRecord.id.desc()).all()
    return [build_entity_record_out(x) for x in items]


# -------------------------
# DASHBOARD POR ENTIDAD
# -------------------------
@app.get("/dashboard/entity", response_model=EntityDashboardOut)
def get_entity_dashboard(
    indicator_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    indicator = db.query(Indicator).options(joinedload(Indicator.process)).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    if indicator.scope_type != "entity":
        raise HTTPException(status_code=400, detail="El indicador no es de tipo entidad")

    start_date, end_date = get_month_start_end(year, month)

    targets = db.query(EntityIndicatorTarget).options(
        joinedload(EntityIndicatorTarget.entity)
    ).filter(
        EntityIndicatorTarget.indicator_id == indicator_id,
        EntityIndicatorTarget.is_active == True
    ).join(EntityIndicatorTarget.entity).order_by(Entity.name.asc()).all()

    accumulated_rows = db.query(
        EntityRecord.entity_id,
        text("COALESCE(SUM(value), 0) AS accumulated")
    ).filter(
        EntityRecord.indicator_id == indicator_id,
        EntityRecord.record_date >= start_date,
        EntityRecord.record_date <= end_date
    ).group_by(EntityRecord.entity_id).all()

    accumulated_map = {row[0]: float(row[1] or 0) for row in accumulated_rows}

    ranking = []
    ok_count = 0
    warning_count = 0
    critical_count = 0

    for target in targets:
        accumulated = round(float(accumulated_map.get(target.entity_id, 0.0)), 2)
        target_value = round(float(target.target_value or 0), 2)
        remaining = round(max(target_value - accumulated, 0.0), 2)
        compliance = calculate_compliance_by_rule(
            indicator.target_operator,
            target_value,
            accumulated,
        )
        status = calculate_entity_status(indicator, compliance)

        if status == "ok":
            ok_count += 1
        elif status == "warning":
            warning_count += 1
        else:
            critical_count += 1

        ranking.append(EntityDashboardItem(
            entity_id=target.entity_id,
            entity_code=target.entity.code,
            entity_name=target.entity.name,
            entity_type=target.entity.entity_type,
            target_value=target_value,
            accumulated=accumulated,
            remaining=remaining,
            compliance=compliance,
            status=status,
        ))

    ranking.sort(key=lambda x: (-x.compliance, x.entity_name))

    average_compliance = round(
        sum(x.compliance for x in ranking) / len(ranking), 2
    ) if ranking else 0

    return EntityDashboardOut(
        indicator_id=indicator.id,
        indicator_code=indicator.code,
        indicator_name=indicator.name,
        process_name=indicator.process.name,
        period_label=f"{month:02d}/{year}",
        summary={
            "total_entities": len(ranking),
            "average_compliance": average_compliance,
            "ok_count": ok_count,
            "warning_count": warning_count,
            "critical_count": critical_count,
        },
        ranking=ranking,
    )


# -------------------------
# RUTAS LEGACY / COMPATIBILIDAD
# -------------------------
@app.get("/persons")
def legacy_list_persons(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Entity)
    if active_only:
        query = query.filter(Entity.is_active == True)
    items = query.order_by(Entity.name.asc()).all()
    return [build_legacy_person_out(item) for item in items]


@app.post("/persons")
def legacy_create_person(payload: EntityCreate, db: Session = Depends(get_db)):
    created = create_entity(payload, db)
    return {
        "id": created.id,
        "code": created.code,
        "full_name": created.name,
        "name": created.name,
        "entity_type": created.entity_type,
        "document": created.document,
        "position": created.position,
        "area": created.area,
        "is_active": created.is_active,
    }


@app.put("/persons/{person_id}")
def legacy_update_person(person_id: int, payload: EntityCreate, db: Session = Depends(get_db)):
    updated = update_entity(person_id, payload, db)
    return {
        "id": updated.id,
        "code": updated.code,
        "full_name": updated.name,
        "name": updated.name,
        "entity_type": updated.entity_type,
        "document": updated.document,
        "position": updated.position,
        "area": updated.area,
        "is_active": updated.is_active,
    }


@app.delete("/persons/{person_id}")
def legacy_delete_person(person_id: int, db: Session = Depends(get_db)):
    return delete_entity(person_id, db)


@app.get("/person-indicator-targets")
def legacy_list_person_targets(
    indicator_id: Optional[int] = None,
    person_id: Optional[int] = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(EntityIndicatorTarget).options(
        joinedload(EntityIndicatorTarget.indicator),
        joinedload(EntityIndicatorTarget.entity)
    )

    if indicator_id:
        query = query.filter(EntityIndicatorTarget.indicator_id == indicator_id)
    if person_id:
        query = query.filter(EntityIndicatorTarget.entity_id == person_id)
    if active_only:
        query = query.filter(EntityIndicatorTarget.is_active == True)

    items = query.join(EntityIndicatorTarget.entity).order_by(Entity.name.asc()).all()
    return [build_legacy_person_target_out(item) for item in items]


@app.post("/person-indicator-targets")
def legacy_create_or_update_person_target(payload: dict, db: Session = Depends(get_db)):
    body = EntityIndicatorTargetCreate(
        indicator_id=payload.get("indicator_id"),
        entity_id=payload.get("person_id"),
        target_value=payload.get("target_value", 0),
        is_active=payload.get("is_active", True),
    )
    item = create_or_update_entity_target(body, db)
    return {
        "id": item.id,
        "indicator_id": item.indicator_id,
        "person_id": item.entity_id,
        "target_value": item.target_value,
        "is_active": item.is_active,
        "indicator_code": item.indicator_code,
        "indicator_name": item.indicator_name,
        "person_code": item.entity_code,
        "person_name": item.entity_name,
        "entity_type": item.entity_type,
    }


@app.delete("/person-indicator-targets/{target_id}")
def legacy_delete_person_target(target_id: int, db: Session = Depends(get_db)):
    return delete_entity_target(target_id, db)


@app.get("/person-records")
def legacy_list_person_records(
    indicator_id: Optional[int] = None,
    person_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EntityRecord).options(
        joinedload(EntityRecord.indicator),
        joinedload(EntityRecord.entity)
    )

    if indicator_id:
        query = query.filter(EntityRecord.indicator_id == indicator_id)
    if person_id:
        query = query.filter(EntityRecord.entity_id == person_id)
    if year:
        query = query.filter(extract("year", EntityRecord.record_date) == year)
    if month:
        query = query.filter(extract("month", EntityRecord.record_date) == month)

    items = query.order_by(EntityRecord.record_date.desc(), EntityRecord.id.desc()).all()
    return [build_legacy_person_record_out(item) for item in items]


@app.get("/person-records/grid")
def legacy_get_person_capture_grid(
    indicator_id: int,
    record_date: date,
    db: Session = Depends(get_db)
):
    data = get_entity_capture_grid(indicator_id=indicator_id, record_date=record_date, db=db)
    return {
        "indicator_id": data.indicator_id,
        "indicator_code": data.indicator_code,
        "indicator_name": data.indicator_name,
        "process_id": data.process_id,
        "process_name": data.process_name,
        "meeting_level": data.meeting_level,
        "unit": data.unit,
        "frequency": data.frequency,
        "scope_type": "person",
        "record_date": data.record_date,
        "rows": [
            {
                "person_id": row.entity_id,
                "person_code": row.entity_code,
                "person_name": row.entity_name,
                "target_value": row.target_value,
                "day_value": row.day_value,
                "accumulated": row.accumulated,
                "remaining": row.remaining,
                "compliance": row.compliance,
                "status": row.status,
                "observation": row.observation,
            }
            for row in data.rows
        ],
    }


@app.post("/person-records/bulk")
def legacy_save_person_grid(payload: dict, db: Session = Depends(get_db)):
    body = EntityRecordBulkSave(
        indicator_id=payload.get("indicator_id"),
        record_date=payload.get("record_date"),
        rows=[
            {
                "entity_id": row.get("person_id"),
                "value": row.get("value"),
                "observation": row.get("observation"),
            }
            for row in payload.get("rows", [])
        ],
    )
    return save_entity_records_bulk(body, db)


@app.get("/dashboard/person")
def legacy_person_dashboard(
    indicator_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    data = get_entity_dashboard(indicator_id=indicator_id, year=year, month=month, db=db)
    return {
        "indicator_id": data.indicator_id,
        "indicator_code": data.indicator_code,
        "indicator_name": data.indicator_name,
        "process_name": data.process_name,
        "period_label": data.period_label,
        "summary": {
            "total_persons": data.summary["total_entities"],
            "average_compliance": data.summary["average_compliance"],
            "ok_count": data.summary["ok_count"],
            "warning_count": data.summary["warning_count"],
            "critical_count": data.summary["critical_count"],
        },
        "ranking": [
            {
                "person_id": row.entity_id,
                "person_code": row.entity_code,
                "person_name": row.entity_name,
                "target_value": row.target_value,
                "accumulated": row.accumulated,
                "remaining": row.remaining,
                "compliance": row.compliance,
                "status": row.status,
            }
            for row in data.ranking
        ],
    }


@app.get("/history/person")
def legacy_person_history(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    person_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    rows = get_entity_history(
        year=year,
        month=month,
        day=day,
        level=level,
        process_id=process_id,
        indicator_id=indicator_id,
        entity_id=person_id,
        db=db,
    )
    return [
        {
            "id": row["id"],
            "indicator_id": row["indicator_id"],
            "indicator_code": row["indicator_code"],
            "indicator_name": row["indicator_name"],
            "process_id": row["process_id"],
            "process_name": row["process_name"],
            "meeting_level": row["meeting_level"],
            "person_id": row["entity_id"],
            "person_code": row["entity_code"],
            "person_name": row["entity_name"],
            "record_date": row["record_date"],
            "value": row["value"],
            "general": row["general"],
            "status": row["status"],
            "observation": row["observation"],
            "unit": row["unit"],
            "frequency": row["frequency"],
            "capture_mode": row["capture_mode"],
            "scope_type": "person",
            "target_value": row["target_value"],
        }
        for row in rows
    ]


@app.get("/history/person/summary")
def legacy_person_history_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    indicator_id: Optional[int] = None,
    person_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return get_entity_history_summary(
        year=year,
        month=month,
        day=day,
        level=level,
        process_id=process_id,
        indicator_id=indicator_id,
        entity_id=person_id,
        db=db,
    )