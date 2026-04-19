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

    warning_operator: Optional[str] = None
    warning_value: Optional[float] = None

    critical_operator: Optional[str] = None
    critical_value: Optional[float] = None

    frequency: str
    capture_mode: str
    shifts: List[str] = Field(default_factory=list)

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

    warning_operator: Optional[str] = None
    warning_value: Optional[float] = None

    critical_operator: Optional[str] = None
    critical_value: Optional[float] = None

    frequency: str
    capture_mode: str
    shifts: str
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


class EntityCreate(BaseModel):
    code: str
    name: str
    entity_type: str = "persona"
    document: Optional[str] = None
    position: Optional[str] = None
    area: Optional[str] = None
    is_active: bool = True


class EntityOut(BaseModel):
    id: int
    code: str
    name: str
    entity_type: str
    document: Optional[str] = None
    position: Optional[str] = None
    area: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class EntityIndicatorTargetCreate(BaseModel):
    indicator_id: int
    entity_id: int
    target_value: float
    is_active: bool = True


class EntityIndicatorTargetOut(BaseModel):
    id: int
    indicator_id: int
    entity_id: int
    target_value: float
    is_active: bool

    indicator_code: str
    indicator_name: str
    entity_code: str
    entity_name: str
    entity_type: str

    class Config:
        from_attributes = True


class EntityRecordRowSave(BaseModel):
    entity_id: int
    value: Optional[float] = None
    observation: Optional[str] = None


class EntityRecordBulkSave(BaseModel):
    indicator_id: int
    record_date: date
    rows: List[EntityRecordRowSave]


class EntityRecordOut(BaseModel):
    id: int
    indicator_id: int
    indicator_code: str
    indicator_name: str
    entity_id: int
    entity_code: str
    entity_name: str
    entity_type: str
    record_date: date
    value: float
    observation: Optional[str] = None

    class Config:
        from_attributes = True


class EntityCaptureGridRow(BaseModel):
    entity_id: int
    entity_code: str
    entity_name: str
    entity_type: str
    target_value: float
    day_value: float
    accumulated: float
    remaining: float
    compliance: float
    status: str
    observation: Optional[str] = None


class EntityCaptureGridOut(BaseModel):
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
    rows: List[EntityCaptureGridRow]


class EntityDashboardItem(BaseModel):
    entity_id: int
    entity_code: str
    entity_name: str
    entity_type: str
    target_value: float
    accumulated: float
    remaining: float
    compliance: float
    status: str


class EntityDashboardOut(BaseModel):
    indicator_id: int
    indicator_code: str
    indicator_name: str
    process_name: str
    period_label: str
    summary: dict
    ranking: List[EntityDashboardItem]