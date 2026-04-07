import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")

print("👉 DATABASE_URL:", DATABASE_URL)

if DATABASE_URL:
    print("🔥 Usando PostgreSQL (Neon)")
    engine = create_engine(DATABASE_URL)
else:
    print("⚠️ Usando SQLite local")
    engine = create_engine(
        "sqlite:///./eto_digital.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()