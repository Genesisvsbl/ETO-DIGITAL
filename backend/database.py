import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 📌 Detectar si hay DATABASE_URL (Render / Neon)
DATABASE_URL = os.getenv("DATABASE_URL")

# 📌 Si NO existe → usa SQLite local (para desarrollo)
if not DATABASE_URL:
    BASE_DIR = Path(__file__).resolve().parent
    DB_PATH = BASE_DIR / "eto_digital.db"
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    connect_args = {"check_same_thread": False}
    print("🟡 Usando SQLite local:", DB_PATH)
else:
    connect_args = {}
    print("🟢 Usando PostgreSQL (Neon)")

# 🚀 Crear engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# 📌 Sesión
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# 📌 Base ORM
Base = declarative_base()