import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from backend.db.database import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, index=True)
    join_date = Column(Date, nullable=False)
    status = Column(String, index=True, default="New Joiner")  # Active, New Joiner, Remote, Resigned
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    # Relationships
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    project = relationship("Project", back_populates="employees")

    # A seat_id is defined on the employee or we can define occupant on the seat.
    # To represent one-to-one, we can store seat_id in Employee and also link it.
    seat_id = Column(Integer, ForeignKey("seats.id", ondelete="SET NULL"), nullable=True, unique=True)
    seat = relationship("Seat", back_populates="employee", foreign_keys=[seat_id])

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    manager_name = Column(String, index=True)
    department = Column(String, index=True)
    status = Column(String, index=True, default="Active")  # Active, Completed
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    # Relationships
    employees = relationship("Employee", back_populates="project")

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    seat_number = Column(String, unique=True, index=True, nullable=False)  # e.g., F1-A01
    floor = Column(Integer, index=True, nullable=False)  # 1, 2, 3, etc.
    block = Column(String, index=True, nullable=False)  # A, B, C, D
    status = Column(String, index=True, default="Available")  # Available, Occupied, Maintenance
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    # Relationship back to Employee
    employee = relationship("Employee", back_populates="seat", uselist=False, foreign_keys=[Employee.seat_id])

class AllocationHistory(Base):
    __tablename__ = "allocation_history"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, index=True, nullable=False)
    employee_name = Column(String, nullable=False)
    seat_id = Column(Integer, nullable=True)
    seat_number = Column(String, nullable=True)
    project_id = Column(Integer, nullable=True)
    project_name = Column(String, nullable=True)
    action = Column(String, nullable=False)  # Allocate, Release, Move
    performed_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    performed_by = Column(String, default="Admin")
