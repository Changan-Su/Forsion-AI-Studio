"""
Database configuration and connection management.
Supports both SQLite (default) and MySQL.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker, declarative_base

load_dotenv()

# Database configuration from environment variables
# Use SQLite by default for easier development
DATABASE_TYPE = os.getenv("DATABASE_TYPE", "sqlite")  # sqlite or mysql

if DATABASE_TYPE.lower() == "mysql":
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "forsion_ai_studio")
    
    DATABASE_URL = (
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
        "?charset=utf8mb4"
    )
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=os.getenv("SQL_DEBUG", "").lower() == "true",
    )
else:
    # SQLite configuration (default)
    DB_PATH = Path(__file__).parent / "forsion.db"
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Required for SQLite
        echo=os.getenv("SQL_DEBUG", "").lower() == "true",
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a database session.
    Automatically closes the session after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize the database by creating all tables.
    """
    Base.metadata.create_all(bind=engine)

