import os
from sqlalchemy import create_engine, Column, Integer, Float, String, Boolean, DateTime, ForeignKey, event
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifting.db")

# Railway gives Postgres URLs starting with postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Only enable SQLite foreign keys when using SQLite locally
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    category = Column(String)
    increment = Column(Float, default=5.0)  # Default increment value

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, default=datetime.utcnow)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)

class Set(Base):
    __tablename__ = "sets"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    weight = Column(Float, nullable=False)
    reps = Column(Integer, nullable=False)
    is_pr = Column(Boolean, default=False)
    set_number = Column(Integer, nullable=False)  # New column for set_id

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class TemplateExercise(Base):
    __tablename__ = "template_exercises"
    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("templates.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))

