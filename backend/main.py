from datetime import date, timedelta
from typing import Optional
from collections import defaultdict

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract

from database import SessionLocal, engine, Base
from models import Process, Indicator, DailyRecord
from schemas import (
    ProcessCreate, ProcessOut,
    IndicatorCreate, IndicatorOut,
    DailyRecordCreate, DailyRecordOut
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_indicator_code(db: Session):
    last = db.query(Indicator).order_by(Indicator.id.desc()).first()
    next_id = 1 if not last else last.id + 1
    return f"IND-{next_id:04d}"


def calculate_general(indicator: Indicator, shift_a, shift_b, shift_c):
    enabled = [s.strip() for s in indicator.shifts.split(",") if s.strip()]
    values = []

    if "A" in enabled and shift_a is not None:
        values.append(shift_a)
    if "B" in enabled and shift_b is not None:
        values.append(shift_b)
    if "C" in enabled and shift_c is not None:
        values.append(shift_c)

    if not values:
        return 0.0

    return round(sum(values) / len(values), 2)


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


def calculate_status(indicator: Indicator, general: float):
    if compare_value(general, indicator.critical_operator, indicator.critical_value):
        return "critical"
    if compare_value(general, indicator.warning_operator, indicator.warning_value):
        return "warning"
    return "ok"


def validate_indicator_payload(payload: IndicatorCreate):
    if payload.unit not in VALID_UNITS:
        raise HTTPException(status_code=400, detail="Unidad no válida")

    if payload.target_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de meta no válido")

    if payload.warning_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de warning no válido")

    if payload.critical_operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail="Operador de critical no válido")

    shifts_clean = [s.upper() for s in payload.shifts if s.upper() in ["A", "B", "C"]]
    if not shifts_clean:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un turno")

    return shifts_clean


def base_history_query(db: Session):
    return (
        db.query(DailyRecord)
        .join(DailyRecord.indicator)
        .join(Indicator.process)
        .options(joinedload(DailyRecord.indicator).joinedload(Indicator.process))
    )


def apply_common_filters(query, year=None, month=None, day=None, level=None, process_id=None):
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
        shift_a=record.shift_a,
        shift_b=record.shift_b,
        shift_c=record.shift_c,
        general=record.general,
        status=record.status,
        observation=record.observation,
        unit=record.indicator.unit,
    )


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
        shifts=",".join(shifts_clean),
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
            shifts=i.shifts,
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
    indicator.shifts = ",".join(shifts_clean)

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

    general = calculate_general(
        indicator,
        payload.shift_a,
        payload.shift_b,
        payload.shift_c
    )
    status = calculate_status(indicator, general)

    record = (
        db.query(DailyRecord)
        .filter(
            DailyRecord.indicator_id == payload.indicator_id,
            DailyRecord.record_date == payload.record_date
        )
        .first()
    )

    if record:
        record.shift_a = payload.shift_a
        record.shift_b = payload.shift_b
        record.shift_c = payload.shift_c
        record.general = general
        record.status = status
        record.observation = payload.observation
    else:
        record = DailyRecord(
            indicator_id=payload.indicator_id,
            record_date=payload.record_date,
            shift_a=payload.shift_a,
            shift_b=payload.shift_b,
            shift_c=payload.shift_c,
            general=general,
            status=status,
            observation=payload.observation,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return DailyRecordOut(
        id=record.id,
        indicator_id=indicator.id,
        indicator_code=indicator.code,
        indicator_name=indicator.name,
        process_id=indicator.process.id,
        process_name=indicator.process.name,
        meeting_level=indicator.meeting_level,
        record_date=record.record_date,
        shift_a=record.shift_a,
        shift_b=record.shift_b,
        shift_c=record.shift_c,
        general=record.general,
        status=record.status,
        observation=record.observation,
        unit=indicator.unit,
    )


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


@app.get("/history", response_model=list[DailyRecordOut])
def get_history(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id)
    records = query.order_by(DailyRecord.record_date.desc(), Indicator.code.asc()).all()
    return [build_daily_record_out(r) for r in records]


# -------------------------
# HISTORY SUMMARY
# -------------------------
@app.get("/history/summary")
def get_history_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    process_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id)
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
# DASHBOARD GLOBAL
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
    query = apply_common_filters(query, year, month, day, level, None)
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


# -------------------------
# DASHBOARD PROCESS DETAIL
# -------------------------
@app.get("/dashboard/process")
def get_process_dashboard(
    process_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    level: Optional[int] = None,
    period: Optional[str] = None,
    db: Session = Depends(get_db)
):
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    query = base_history_query(db)
    query = apply_common_filters(query, year, month, day, level, process_id)

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

    for indicator_id, latest_record in latest_by_indicator.items():
        trend_records = grouped_indicator_records[indicator_id]
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
        score = 0
        if r.status == "critical":
            score = 3
        elif r.status == "warning":
            score = 2
        else:
            score = 1
        impact_map[r.indicator.name] += score

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