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

    warning_operator = Column(String, nullable=True, default=None)
    warning_value = Column(Float, nullable=True, default=None)

    critical_operator = Column(String, nullable=True, default=None)
    critical_value = Column(Float, nullable=True, default=None)

    frequency = Column(String, nullable=False, default="day")
    capture_mode = Column(String, nullable=False, default="shifts")
    shifts = Column(String, nullable=False, default="A,B,C")

    scope_type = Column(String, nullable=False, default="standard")  # standard | entity

    process = relationship("Process", back_populates="indicators")
    daily_records = relationship("DailyRecord", back_populates="indicator", cascade="all, delete")

    entity_targets = relationship(
        "EntityIndicatorTarget",
        back_populates="indicator",
        cascade="all, delete",
    )
    entity_records = relationship(
        "EntityRecord",
        back_populates="indicator",
        cascade="all, delete",
    )

    # Alias de compatibilidad para main.py nuevo
    entity_indicator_targets = relationship(
        "EntityIndicatorTarget",
        viewonly=True,
        overlaps="entity_targets,indicator",
    )


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


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, default="persona")
    document = Column(String, nullable=True, unique=True)
    position = Column(String, nullable=True)
    area = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    targets = relationship("EntityIndicatorTarget", back_populates="entity", cascade="all, delete")
    records = relationship("EntityRecord", back_populates="entity", cascade="all, delete")


class EntityIndicatorTarget(Base):
    __tablename__ = "entity_indicator_targets"
    __table_args__ = (
        UniqueConstraint("indicator_id", "entity_id", name="uq_entity_indicator_target"),
    )

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    target_value = Column(Float, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    indicator = relationship("Indicator", back_populates="entity_targets")
    entity = relationship("Entity", back_populates="targets")


class EntityRecord(Base):
    __tablename__ = "entity_records"
    __table_args__ = (
        UniqueConstraint("indicator_id", "entity_id", "record_date", name="uq_entity_indicator_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    record_date = Column(Date, nullable=False, index=True)

    value = Column(Float, nullable=False, default=0)
    observation = Column(Text, nullable=True)

    indicator = relationship("Indicator", back_populates="entity_records")
    entity = relationship("Entity", back_populates="records")