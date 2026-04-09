from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class ProcessCreate(BaseModel):
    name: str
    level: int = Field(..., ge=1, le=2)


class ProcessOut(BaseModel):
    id: int
    name: str
    level: int

    class Config:
        from_attributes = True


class IndicatorCreate(BaseModel):
    name: str
    process_id: int
    meeting_level: int = Field(..., ge=1, le=2)

    unit: str

    target_operator: str
    target_value: float

    warning_operator: str
    warning_value: float

    critical_operator: str
    critical_value: float

    frequency: str
    capture_mode: str
    shifts: List[str] = Field(default_factory=list)

    # NUEVO
    scope_type: str = "standard"


class IndicatorOut(BaseModel):
    id: int
    code: str
    name: str

    process_id: int
    meeting_level: int

    unit: str

    target_operator: str
    target_value: float

    warning_operator: str
    warning_value: float

    critical_operator: str
    critical_value: float

    frequency: str
    capture_mode: str
    shifts: str

    # NUEVO
    scope_type: str

    process_name: str
    process_level: int

    class Config:
        from_attributes = True


class DailyRecordCreate(BaseModel):
    indicator_id: int
    record_date: date

    single_value: Optional[float] = None
    shift_a: Optional[float] = None
    shift_b: Optional[float] = None
    shift_c: Optional[float] = None

    observation: Optional[str] = None


class DailyRecordOut(BaseModel):
    id: int
    indicator_id: int
    indicator_code: str
    indicator_name: str
    process_id: int
    process_name: str
    meeting_level: int
    record_date: date

    single_value: Optional[float]
    shift_a: Optional[float]
    shift_b: Optional[float]
    shift_c: Optional[float]

    general: float
    status: str
    observation: Optional[str]

    unit: str
    frequency: str
    capture_mode: str
    shifts: str
    scope_type: str

    class Config:
        from_attributes = True


class PeriodRecordRow(BaseModel):
    record_date: date
    period_label: Optional[str] = None

    single_value: Optional[float] = None
    shift_a: Optional[float] = None
    shift_b: Optional[float] = None
    shift_c: Optional[float] = None

    observation: Optional[str] = None


class PeriodRecordSave(BaseModel):
    indicator_id: int
    rows: List[PeriodRecordRow]


# -------------------------
# PERSONAS
# -------------------------
class PersonCreate(BaseModel):
    code: str
    full_name: str
    document: Optional[str] = None
    position: Optional[str] = None
    area: Optional[str] = None
    is_active: bool = True


class PersonOut(BaseModel):
    id: int
    code: str
    full_name: str
    document: Optional[str] = None
    position: Optional[str] = None
    area: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class PersonIndicatorTargetCreate(BaseModel):
    indicator_id: int
    person_id: int
    target_value: float
    is_active: bool = True


class PersonIndicatorTargetOut(BaseModel):
    id: int
    indicator_id: int
    person_id: int
    target_value: float
    is_active: bool

    indicator_code: str
    indicator_name: str
    person_code: str
    person_name: str

    class Config:
        from_attributes = True


class PersonRecordRowSave(BaseModel):
    person_id: int
    value: Optional[float] = 0
    observation: Optional[str] = None


class PersonRecordBulkSave(BaseModel):
    indicator_id: int
    record_date: date
    rows: List[PersonRecordRowSave]


class PersonRecordOut(BaseModel):
    id: int
    indicator_id: int
    indicator_code: str
    indicator_name: str
    person_id: int
    person_code: str
    person_name: str
    record_date: date
    value: float
    observation: Optional[str] = None

    class Config:
        from_attributes = True


class PersonCaptureGridRow(BaseModel):
    person_id: int
    person_code: str
    person_name: str
    target_value: float
    day_value: float
    accumulated: float
    remaining: float
    compliance: float
    status: str
    observation: Optional[str] = None


class PersonCaptureGridOut(BaseModel):
    indicator_id: int
    indicator_code: str
    indicator_name: str
    process_id: int
    process_name: str
    meeting_level: int
    unit: str
    frequency: str
    scope_type: str
    record_date: date
    rows: List[PersonCaptureGridRow]


class PersonDashboardItem(BaseModel):
    person_id: int
    person_code: str
    person_name: str
    target_value: float
    accumulated: float
    remaining: float
    compliance: float
    status: str


class PersonDashboardOut(BaseModel):
    indicator_id: int
    indicator_code: str
    indicator_name: str
    process_name: str
    period_label: str
    summary: dict
    ranking: List[PersonDashboardItem]