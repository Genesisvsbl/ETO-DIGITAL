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
from models import Process, Indicator, DailyRecord
from schemas import (
    ProcessCreate,
    ProcessOut,
    IndicatorCreate,
    IndicatorOut,
    DailyRecordCreate,
    DailyRecordOut,
    PeriodRecordSave,
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


def run_safe_migrations():
    with engine.begin() as connection:
        try:
            # Estas migraciones son seguras solo para SQLite.
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

                if "single_value" not in daily_record_columns:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN single_value FLOAT")
                    )
                if "shift_a" not in daily_record_columns:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN shift_a FLOAT")
                    )
                if "shift_b" not in daily_record_columns:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN shift_b FLOAT")
                    )
                if "shift_c" not in daily_record_columns:
                    connection.execute(
                        text("ALTER TABLE daily_records ADD COLUMN shift_c FLOAT")
                    )

            # Normalización funcional para cualquier motor
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


def generate_indicator_code(db: Session):
    last = db.query(Indicator).order_by(Indicator.id.desc()).first()
    next_id = 1 if not last else last.id + 1
    return f"IND-{next_id:04d}"


def get_enabled_shifts(indicator: Indicator):
    return [s.strip().upper() for s in (indicator.shifts or "").split(",") if s.strip()]


def sanitize_record_values_for_mode(capture_mode, single_value, shift_a, shift_b, shift_c):
    if capture_mode == "single":
        return single_value, None, None, None
    return None, shift_a, shift_b, shift_c


def compare_value(value: float, operator: str, rule_value: float) -> bool:
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
        return round(float(single_value or 0), 2)

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


def calculate_general(indicator: Indicator, measured_value: float):
    target = float(indicator.target_value)
    operator = indicator.target_operator

    if operator == "=":
        if target == 0:
            return 100.0 if measured_value == 0 else 0.0

        diff_ratio = abs(measured_value - target) / abs(target)
        compliance = max(0.0, 100.0 - (diff_ratio * 100.0))
        return round(min(compliance, 100.0), 2)

    if operator in [">", ">="]:
        if target == 0:
            return 100.0 if measured_value >= 0 else 0.0

        compliance = (measured_value / target) * 100.0
        return round(max(0.0, min(compliance, 100.0)), 2)

    if operator in ["<", "<="]:
        if measured_value <= target:
            return 100.0

        if target == 0:
            return 0.0

        compliance = (target / measured_value) * 100.0
        return round(max(0.0, min(compliance, 100.0)), 2)

    return 0.0


def calculate_status(indicator: Indicator, measured_value: float):
    if compare_value(measured_value, indicator.critical_operator, indicator.critical_value):
        return "critical"
    if compare_value(measured_value, indicator.warning_operator, indicator.warning_value):
        return "warning"
    return "ok"


def validate_indicator_payload(payload: IndicatorCreate):
    payload.frequency = normalize_frequency(payload.frequency)
    payload.capture_mode = normalize_capture_mode(payload.capture_mode)

    if payload.unit not in VALID_UNITS:
        raise HTTPException(status_code=400, detail="Unidad no válida")

    if payload.target_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de meta no válido")

    if payload.warning_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de warning no válido")

    if payload.critical_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de critical no válido")

    if payload.frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Frecuencia no válida")

    if payload.capture_mode not in VALID_CAPTURE_MODES:
        raise HTTPException(status_code=400, detail="Modo de captura no válido")

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
    )


def format_week_label(start_date: date, end_date: date, index: int):
    return (
        f"Semana {index} | "
        f"{start_date.strftime('%d/%m')} - {end_date.strftime('%d/%m')}"
    )


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

    process = Process(
        name=payload.name.strip(),
        level=payload.level
    )
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
    )
    db.add(indicator)
    db.commit()
    db.refresh(indicator)

    return IndicatorOut(
        id=indicator.id,
        code=indicator.code,
        name=indicator.name,
        process_id=indicator.process_id,
        meeting_level=indicator.meeting_level,
        unit=indicator.unit,
        target_operator=indicator.target_operator,
        target_value=indicator.target_value,
        warning_operator=indicator.warning_operator,
        warning_value=indicator.warning_value,
        critical_operator=indicator.critical_operator,
        critical_value=indicator.critical_value,
        frequency=indicator.frequency,
        capture_mode=indicator.capture_mode,
        shifts=indicator.shifts,
        process_name=process.name,
        process_level=process.level,
    )


@app.get("/indicators", response_model=list[IndicatorOut])
def list_indicators(
    process_id: Optional[int] = None,
    level: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Indicator).options(joinedload(Indicator.process))

    if process_id:
        query = query.filter(Indicator.process_id == process_id)
    if level:
        query = query.filter(Indicator.meeting_level == level)

    items = query.order_by(Indicator.code.asc()).all()

    return [
        IndicatorOut(
            id=i.id,
            code=i.code,
            name=i.name,
            process_id=i.process_id,
            meeting_level=i.meeting_level,
            unit=i.unit,
            target_operator=i.target_operator,
            target_value=i.target_value,
            warning_operator=i.warning_operator,
            warning_value=i.warning_value,
            critical_operator=i.critical_operator,
            critical_value=i.critical_value,
            frequency=normalize_frequency(i.frequency),
            capture_mode=normalize_capture_mode(i.capture_mode),
            shifts="" if normalize_capture_mode(i.capture_mode) == "single" else (i.shifts or ""),
            process_name=i.process.name,
            process_level=i.process.level,
        )
        for i in items
    ]


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

    if indicator.capture_mode == "single":
        records = db.query(DailyRecord).filter(DailyRecord.indicator_id == indicator.id).all()
        for r in records:
            r.shift_a = None
            r.shift_b = None
            r.shift_c = None

    db.commit()
    db.refresh(indicator)

    return IndicatorOut(
        id=indicator.id,
        code=indicator.code,
        name=indicator.name,
        process_id=indicator.process_id,
        meeting_level=indicator.meeting_level,
        unit=indicator.unit,
        target_operator=indicator.target_operator,
        target_value=indicator.target_value,
        warning_operator=indicator.warning_operator,
        warning_value=indicator.warning_value,
        critical_operator=indicator.critical_operator,
        critical_value=indicator.critical_value,
        frequency=indicator.frequency,
        capture_mode=indicator.capture_mode,
        shifts=indicator.shifts,
        process_name=process.name,
        process_level=process.level,
    )


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

    measured_value = calculate_measured_value(
        indicator,
        single_value,
        shift_a,
        shift_b,
        shift_c
    )
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
        raise HTTPException(
            status_code=400,
            detail="Ya existe otro registro para ese indicador en esa fecha"
        )

    validate_record_payload(indicator, payload)

    single_value, shift_a, shift_b, shift_c = sanitize_record_values_for_mode(
        indicator.capture_mode,
        payload.single_value,
        payload.shift_a,
        payload.shift_b,
        payload.shift_c,
    )

    measured_value = calculate_measured_value(
        indicator,
        single_value,
        shift_a,
        shift_b,
        shift_c
    )
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
        "warning_operator": indicator.warning_operator,
        "warning_value": indicator.warning_value,
        "critical_operator": indicator.critical_operator,
        "critical_value": indicator.critical_value,
        "frequency": indicator.frequency,
        "capture_mode": indicator.capture_mode,
        "shifts": indicator.shifts,
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
            raise HTTPException(
                status_code=400,
                detail=f"Falta valor único para la fila {row.record_date}"
            )

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

        measured_value = calculate_measured_value(
            indicator,
            single_value,
            shift_a,
            shift_b,
            shift_c
        )
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
    return save_period_matrix(
        payload=PeriodRecordSave(indicator_id=payload.indicator_id, rows=payload.rows),
        db=db
    )


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

    ranking = [
        {"name": x["process_name"], "value": x["average_general"]}
        for x in process_cards
    ]

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
            "process": {
                "id": process.id,
                "name": process.name,
                "level": process.level
            },
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
        trend.append({
            "label": label,
            "value": round(sum(values) / len(values), 2)
        })

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

        trend_values = [
            {"label": str(x.record_date), "value": x.general}
            for x in ordered
        ]

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
            "warning_operator": latest_record.indicator.warning_operator,
            "warning_value": latest_record.indicator.warning_value,
            "critical_operator": latest_record.indicator.critical_operator,
            "critical_value": latest_record.indicator.critical_value,
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
        "process": {
            "id": process.id,
            "name": process.name,
            "level": process.level
        },
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