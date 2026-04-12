from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    ForeignKey,
    Text,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship
from database import Base


class Process(Base):
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    level = Column(Integer, nullable=False)

    indicators = relationship("Indicator", back_populates="process", cascade="all, delete")


class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False, index=True)

    process_id = Column(Integer, ForeignKey("processes.id"), nullable=False)
    meeting_level = Column(Integer, nullable=False)

    unit = Column(String, nullable=False, default="%")

    target_operator = Column(String, nullable=False, default=">=")
    target_value = Column(Float, nullable=False, default=0)

    warning_operator = Column(String, nullable=False, default=">=")
    warning_value = Column(Float, nullable=False, default=0)

    critical_operator = Column(String, nullable=False, default="<")
    critical_value = Column(Float, nullable=False, default=0)

    frequency = Column(String, nullable=False, default="day")        # day | week | month
    capture_mode = Column(String, nullable=False, default="shifts")  # single | shifts
    shifts = Column(String, nullable=False, default="A,B,C")         # A,B,C | A,B | A | ""

    # NUEVO
    scope_type = Column(String, nullable=False, default="standard")  # standard | person

    process = relationship("Process", back_populates="indicators")
    daily_records = relationship("DailyRecord", back_populates="indicator", cascade="all, delete")
    person_targets = relationship("PersonIndicatorTarget", back_populates="indicator", cascade="all, delete")
    person_records = relationship("PersonRecord", back_populates="indicator", cascade="all, delete")


class DailyRecord(Base):
    __tablename__ = "daily_records"
    __table_args__ = (
        UniqueConstraint("indicator_id", "record_date", name="uq_indicator_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    record_date = Column(Date, nullable=False, index=True)

    single_value = Column(Float, nullable=True)

    shift_a = Column(Float, nullable=True)
    shift_b = Column(Float, nullable=True)
    shift_c = Column(Float, nullable=True)

    general = Column(Float, nullable=False, default=0)
    status = Column(String, nullable=False, default="ok")
    observation = Column(Text, nullable=True)

    indicator = relationship("Indicator", back_populates="daily_records")


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=False, index=True)
    document = Column(String, nullable=True, unique=True)
    position = Column(String, nullable=True)
    area = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    targets = relationship("PersonIndicatorTarget", back_populates="person", cascade="all, delete")
    records = relationship("PersonRecord", back_populates="person", cascade="all, delete")


class PersonIndicatorTarget(Base):
    __tablename__ = "person_indicator_targets"
    __table_args__ = (
        UniqueConstraint("indicator_id", "person_id", name="uq_person_indicator_target"),
    )

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)

    target_value = Column(Float, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    indicator = relationship("Indicator", back_populates="person_targets")
    person = relationship("Person", back_populates="targets")


class PersonRecord(Base):
    __tablename__ = "person_records"
    __table_args__ = (
        UniqueConstraint("indicator_id", "person_id", "record_date", name="uq_person_indicator_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    record_date = Column(Date, nullable=False, index=True)

    value = Column(Float, nullable=False, default=0)
    observation = Column(Text, nullable=True)

    indicator = relationship("Indicator", back_populates="person_records")
    person = relationship("Person", back_populates="records")