from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    manager_name: str
    department: str
    status: Optional[str] = "Active"

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Minimal models to break circular definitions
class ProjectMin(BaseModel):
    id: int
    name: str
    code: str
    department: str
    manager_name: str

    class Config:
        from_attributes = True

class SeatMin(BaseModel):
    id: int
    seat_number: str
    floor: int
    block: str
    status: str

    class Config:
        from_attributes = True

# Employee Schemas
class EmployeeBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    join_date: date
    status: str = "New Joiner"
    project_id: Optional[int] = None
    seat_id: Optional[int] = None

class EmployeeCreate(EmployeeBase):
    pass

class Employee(EmployeeBase):
    id: int
    created_at: datetime
    project: Optional[ProjectMin] = None
    seat: Optional[SeatMin] = None

    class Config:
        from_attributes = True

class EmployeeMin(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    join_date: Optional[date] = None
    project: Optional[ProjectMin] = None

    class Config:
        from_attributes = True

# Seat Schemas
class SeatBase(BaseModel):
    seat_number: str
    floor: int
    block: str
    status: str = "Available"

class SeatCreate(SeatBase):
    pass

class Seat(SeatBase):
    id: int
    created_at: datetime
    employee: Optional[EmployeeMin] = None

    class Config:
        from_attributes = True

# Allocation Request Schemas
class AllocateRequest(BaseModel):
    employee_id: int
    seat_id: int
    performed_by: Optional[str] = "Admin"

class ReleaseRequest(BaseModel):
    seat_id: int
    performed_by: Optional[str] = "Admin"

class BulkReleaseRequest(BaseModel):
    seat_ids: List[int]
    performed_by: Optional[str] = "Admin"

class MaintenanceRequest(BaseModel):
    seat_id: int
    action: str  # "maintenance" or "resolve"
    performed_by: Optional[str] = "Admin"

# History Schemas
class AllocationHistoryOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    seat_id: Optional[int] = None
    seat_number: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    action: str
    performed_at: datetime
    performed_by: str

    class Config:
        from_attributes = True

# NLP AI Assistant Query Schemas
class AIQueryRequest(BaseModel):
    query: str

class AISuggestedAction(BaseModel):
    type: str  # allocate, release, view_employee, view_seat, view_project, filter_seats, view_dashboard
    params: dict

class AIQueryResponse(BaseModel):
    response_text: str
    query_type: str
    data: Optional[dict] = None
    suggested_action: Optional[AISuggestedAction] = None

# Analytics schemas
class DashboardSummary(BaseModel):
    total_employees: int
    total_seats: int
    allocated_seats: int
    available_seats: int
    maintenance_seats: int
    total_projects: int
    remote_employees: int
    new_joiners: int
    utilization_rate: float
    floor_utilization: dict
    project_allocation: dict
