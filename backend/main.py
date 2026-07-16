import datetime
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.db.database import Base, engine, get_db
from backend.db.models import Employee, Project, Seat, AllocationHistory
from backend.db.schemas import (
    Employee as EmployeeSchema,
    EmployeeCreate,
    Project as ProjectSchema,
    Seat as SeatSchema,
    AllocateRequest,
    ReleaseRequest,
    BulkReleaseRequest,
    MaintenanceRequest,
    AllocationHistoryOut,
    AIQueryRequest,
    AIQueryResponse,
    DashboardSummary
)
from backend.app.nlp_engine import parse_query

# Create tables if not exist (fallback, though seeded DB will have them)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ethara Seat Allocation & Project Mapping API")

@app.on_event("startup")
def startup_event():
    import threading
    
    def run_seeding():
        # Automatically seed the database if it is empty in a background thread
        from backend.db.database import SessionLocal
        from backend.db.models import Seat
        from backend.db.seed import seed_db
        
        db = SessionLocal()
        try:
            seat_count = db.query(Seat).count()
            if seat_count == 0:
                print("Database is empty! Auto-seeding initial datasets in the background...")
                seed_db()
                print("Database background auto-seeding completed.")
        except Exception as e:
            print(f"Database background startup check failed/skipped: {e}")
        finally:
            db.close()

    # Launch background thread to prevent blocking Uvicorn port binding
    threading.Thread(target=run_seeding, daemon=True).start()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DASHBOARD & ANALYTICS ---

@app.get("/api/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    # Fetch all seats and employee metadata in single round-trips
    seats_data = db.query(Seat.floor, Seat.status).all()
    employees_data = db.query(Employee.status, Employee.project_id, Employee.seat_id).all()
    active_projects = db.query(Project.id, Project.name, Project.code).filter(Project.status == "Active").all()

    # In-memory calculations for seats
    total_s = len(seats_data)
    occ_s = sum(1 for s in seats_data if s[1] == "Occupied")
    maint_s = sum(1 for s in seats_data if s[1] == "Maintenance")
    avail_s = sum(1 for s in seats_data if s[1] == "Available")
    
    util_rate = round((occ_s / (total_s - maint_s)) * 100, 2) if (total_s - maint_s) > 0 else 0.0

    # Floor-wise utilization computed in-memory
    floor_util = {}
    for floor in [1, 2, 3, 4, 5]:
        f_seats = [s for s in seats_data if s[0] == floor]
        f_total = len(f_seats)
        f_maint = sum(1 for s in f_seats if s[1] == "Maintenance")
        f_occ = sum(1 for s in f_seats if s[1] == "Occupied")
        usable = f_total - f_maint
        f_rate = round((f_occ / usable) * 100, 2) if usable > 0 else 0.0
        floor_util[f"Floor {floor}"] = {
            "occupied": f_occ,
            "available": usable - f_occ,
            "maintenance": f_maint,
            "rate": f_rate
        }

    # In-memory calculations for employees
    total_emp = len(employees_data)
    rem_emp = sum(1 for e in employees_data if e[0] == "Remote")
    nj_emp = sum(1 for e in employees_data if e[0] == "New Joiner")
    total_p = len(active_projects)

    # Pre-group employee project stats in-memory for instant lookup:
    proj_stats = {}
    for status, proj_id, seat_id in employees_data:
        if proj_id is not None:
            if proj_id not in proj_stats:
                proj_stats[proj_id] = {"allocated": 0, "total": 0}
            proj_stats[proj_id]["total"] += 1
            if seat_id is not None:
                proj_stats[proj_id]["allocated"] += 1

    # Project-wise seat allocation computed in-memory
    proj_alloc = {}
    for p_id, p_name, p_code in active_projects:
        stats = proj_stats.get(p_id, {"allocated": 0, "total": 0})
        proj_alloc[p_name] = {
            "allocated": stats["allocated"],
            "total_members": stats["total"],
            "code": p_code
        }

    return {
        "total_employees": total_emp,
        "total_seats": total_s,
        "allocated_seats": occ_s,
        "available_seats": avail_s,
        "maintenance_seats": maint_s,
        "total_projects": total_p,
        "remote_employees": rem_emp,
        "new_joiners": nj_emp,
        "utilization_rate": util_rate,
        "floor_utilization": floor_util,
        "project_allocation": proj_alloc
    }


# --- EMPLOYEE ENDPOINTS ---

@app.get("/api/employees")
def list_employees(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    query = db.query(Employee)
    
    if search:
        query = query.filter(
            (Employee.name.ilike(f"%{search}%")) | 
            (Employee.email.ilike(f"%{search}%")) |
            (Employee.role.ilike(f"%{search}%"))
        )
    if project_id is not None:
        query = query.filter(Employee.project_id == project_id)
    if status:
        query = query.filter(Employee.status == status)
        
    total = query.count()
    offset = (page - 1) * limit
    results = query.order_by(Employee.id.desc()).offset(offset).limit(limit).all()
    
    # Format Response with project/seat manually to optimize
    # SQLAlchemy lazy-loads them, but it's fine for small page limits (50)
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": [EmployeeSchema.from_orm(e) for e in results]
    }

@app.get("/api/employees/{employee_id}", response_model=EmployeeSchema)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@app.post("/api/employees", response_model=EmployeeSchema)
def create_employee(employee_in: EmployeeCreate, db: Session = Depends(get_db)):
    # Check email duplicate
    exists = db.query(Employee).filter(Employee.email == employee_in.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    db_employee = Employee(
        name=employee_in.name,
        email=employee_in.email,
        role=employee_in.role,
        join_date=employee_in.join_date,
        status=employee_in.status,
        project_id=employee_in.project_id,
        seat_id=None # Seats must be allocated via the transaction endpoints
    )
    
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@app.put("/api/employees/{employee_id}", response_model=EmployeeSchema)
def update_employee(employee_id: int, employee_in: EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    db_employee.name = employee_in.name
    db_employee.email = employee_in.email
    db_employee.role = employee_in.role
    db_employee.join_date = employee_in.join_date
    db_employee.status = employee_in.status
    db_employee.project_id = employee_in.project_id
    
    # If project changed, seat remains but log warning or release it if required.
    # In this logic, project mapping does not auto-release seats but we can flag it.
    
    db.commit()
    db.refresh(db_employee)
    return db_employee


# --- PROJECT ENDPOINTS ---

@app.get("/api/projects", response_model=List[ProjectSchema])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


# --- SEAT ENDPOINTS ---

@app.get("/api/seats")
def list_seats(
    db: Session = Depends(get_db),
    floor: Optional[int] = None,
    block: Optional[str] = None,
    status: Optional[str] = None
):
    query = db.query(Seat)
    if floor is not None:
        query = query.filter(Seat.floor == floor)
    if block:
        query = query.filter(Seat.block == block.upper())
    if status:
        query = query.filter(Seat.status == status)
        
    seats = query.all()
    
    # Format and join occupant info
    return [SeatSchema.from_orm(s) for s in seats]

@app.post("/api/seats/allocate")
def allocate_seat(req: AllocateRequest, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    seat = db.query(Seat).filter(Seat.id == req.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    if seat.status == "Maintenance":
        raise HTTPException(status_code=400, detail="Seat is in maintenance")

    # If seat is occupied, release the current occupant first
    if seat.status == "Occupied":
        prev_occupant = db.query(Employee).filter(Employee.seat_id == seat.id).first()
        if prev_occupant:
            prev_occupant.seat_id = None
            # If they are Active, they remain Active (but now unallocated/remote queue)
            # Log release
            db.add(AllocationHistory(
                employee_id=prev_occupant.id,
                employee_name=prev_occupant.name,
                seat_id=seat.id,
                seat_number=seat.seat_number,
                project_id=prev_occupant.project_id,
                project_name=prev_occupant.project.name if prev_occupant.project else None,
                action="Release",
                performed_by=req.performed_by
            ))

    # If employee already has a seat, release it first
    if employee.seat_id:
        old_seat = db.query(Seat).filter(Seat.id == employee.seat_id).first()
        if old_seat:
            old_seat.status = "Available"
            db.add(AllocationHistory(
                employee_id=employee.id,
                employee_name=employee.name,
                seat_id=old_seat.id,
                seat_number=old_seat.seat_number,
                project_id=employee.project_id,
                project_name=employee.project.name if employee.project else None,
                action="Release",
                performed_by=req.performed_by
            ))

    # Perform new allocation
    employee.seat_id = seat.id
    # If they were a new joiner, change status to Active
    if employee.status == "New Joiner":
        employee.status = "Active"
    elif employee.status == "Remote":
        employee.status = "Active"
        
    seat.status = "Occupied"
    
    history_entry = AllocationHistory(
        employee_id=employee.id,
        employee_name=employee.name,
        seat_id=seat.id,
        seat_number=seat.seat_number,
        project_id=employee.project_id,
        project_name=employee.project.name if employee.project else None,
        action="Allocate",
        performed_by=req.performed_by
    )
    
    db.add(employee)
    db.add(seat)
    db.add(history_entry)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully allocated seat {seat.seat_number} to {employee.name}",
        "employee_id": employee.id,
        "seat_id": seat.id
    }

@app.post("/api/seats/release")
def release_seat(req: ReleaseRequest, db: Session = Depends(get_db)):
    seat = db.query(Seat).filter(Seat.id == req.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    if seat.status != "Occupied":
        raise HTTPException(status_code=400, detail="Seat is not occupied")
        
    employee = db.query(Employee).filter(Employee.seat_id == seat.id).first()
    if not employee:
        # Database inconsistency, force seat status to Available
        seat.status = "Available"
        db.commit()
        return {"status": "success", "message": "Cleaned up orphaned occupied seat"}
        
    # Release
    employee.seat_id = None
    seat.status = "Available"
    
    history_entry = AllocationHistory(
        employee_id=employee.id,
        employee_name=employee.name,
        seat_id=seat.id,
        seat_number=seat.seat_number,
        project_id=employee.project_id,
        project_name=employee.project.name if employee.project else None,
        action="Release",
        performed_by=req.performed_by
    )
    
    db.add(employee)
    db.add(seat)
    db.add(history_entry)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully released seat {seat.seat_number} occupied by {employee.name}"
    }

@app.post("/api/seats/bulk-release")
def bulk_release_seats(req: BulkReleaseRequest, db: Session = Depends(get_db)):
    seats = db.query(Seat).filter(Seat.id.in_(req.seat_ids), Seat.status == "Occupied").all()
    if not seats:
        raise HTTPException(status_code=400, detail="No occupied seats selected for release")
        
    released_count = 0
    histories = []
    
    for seat in seats:
        employee = db.query(Employee).filter(Employee.seat_id == seat.id).first()
        if employee:
            employee.seat_id = None
            db.add(employee)
            
            histories.append(AllocationHistory(
                employee_id=employee.id,
                employee_name=employee.name,
                seat_id=seat.id,
                seat_number=seat.seat_number,
                project_id=employee.project_id,
                project_name=employee.project.name if employee.project else None,
                action="Release",
                performed_by=req.performed_by
            ))
            
        seat.status = "Available"
        db.add(seat)
        released_count += 1
        
    db.bulk_save_objects(histories)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully released {released_count} seats.",
        "released_count": released_count
    }

@app.post("/api/seats/maintenance")
def toggle_seat_maintenance(req: MaintenanceRequest, db: Session = Depends(get_db)):
    seat = db.query(Seat).filter(Seat.id == req.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    if req.action == "maintenance":
        # Check if occupied, release occupant first
        if seat.status == "Occupied":
            employee = db.query(Employee).filter(Employee.seat_id == seat.id).first()
            if employee:
                employee.seat_id = None
                db.add(employee)
                db.add(AllocationHistory(
                    employee_id=employee.id,
                    employee_name=employee.name,
                    seat_id=seat.id,
                    seat_number=seat.seat_number,
                    project_id=employee.project_id,
                    project_name=employee.project.name if employee.project else None,
                    action="Release (Maintenance)",
                    performed_by=req.performed_by
                ))
        
        seat.status = "Maintenance"
        db.add(seat)
        db.add(AllocationHistory(
            employee_id=0,
            employee_name="SYSTEM",
            seat_id=seat.id,
            seat_number=seat.seat_number,
            action="Maintenance Start",
            performed_by=req.performed_by
        ))
        db.commit()
        return {"status": "success", "message": f"Seat {seat.seat_number} put into maintenance successfully."}
        
    elif req.action == "resolve":
        if seat.status != "Maintenance":
            raise HTTPException(status_code=400, detail="Seat is not in maintenance")
            
        seat.status = "Available"
        db.add(seat)
        db.add(AllocationHistory(
            employee_id=0,
            employee_name="SYSTEM",
            seat_id=seat.id,
            seat_number=seat.seat_number,
            action="Maintenance End",
            performed_by=req.performed_by
        ))
        db.commit()
        return {"status": "success", "message": f"Seat {seat.seat_number} resolved from maintenance successfully."}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.post("/api/seats/auto-allocate")
def auto_allocate_new_joiners(db: Session = Depends(get_db)):
    new_joiners = db.query(Employee).filter(Employee.status == "New Joiner").all()
    available_seats = db.query(Seat).filter(Seat.status == "Available").all()
    
    if not new_joiners:
        raise HTTPException(status_code=400, detail="No new joiners pending allocation")
        
    if not available_seats:
        raise HTTPException(status_code=400, detail="No vacant seats available")
        
    allocated_count = 0
    histories = []
    
    # key: (floor, block)
    seat_map = {}
    for s in available_seats:
        key = (s.floor, s.block)
        if key not in seat_map:
            seat_map[key] = []
        seat_map[key].append(s)
        
    for emp in new_joiners:
        # Check if we have any vacant seats left in seat_map
        has_seats = any(len(seats) > 0 for seats in seat_map.values())
        if not has_seats:
            break
            
        allocated_seat = None
        
        # Try to find a co-located seat if employee has a project
        if emp.project_id:
            # Find where other team members sit
            team_seats = db.query(Seat).join(Employee, Employee.seat_id == Seat.id).filter(
                Employee.project_id == emp.project_id
            ).all()
            
            if team_seats:
                # Group by floor/block
                clusters = {}
                for ts in team_seats:
                    ckey = (ts.floor, ts.block)
                    clusters[ckey] = clusters.get(ckey, 0) + 1
                
                # Sort clusters by counts
                sorted_clusters = sorted(clusters.items(), key=lambda x: x[1], reverse=True)
                
                for ckey, _ in sorted_clusters:
                    if ckey in seat_map and seat_map[ckey]:
                        allocated_seat = seat_map[ckey].pop(0)
                        break
        
        # Fallback: take the first available seat from any floor
        if not allocated_seat:
            for ckey in list(seat_map.keys()):
                if seat_map[ckey]:
                    allocated_seat = seat_map[ckey].pop(0)
                    break
                    
        if allocated_seat:
            # Allocate
            emp.seat_id = allocated_seat.id
            emp.status = "Active"
            allocated_seat.status = "Occupied"
            allocated_count += 1
            
            histories.append(AllocationHistory(
                employee_id=emp.id,
                employee_name=emp.name,
                seat_id=allocated_seat.id,
                seat_number=allocated_seat.seat_number,
                project_id=emp.project_id,
                project_name=emp.project.name if emp.project else None,
                action="Allocate",
                performed_by="Auto Allocator AI"
              ))
              
    db.bulk_save_objects(histories)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully auto-allocated {allocated_count} new joiners.",
        "allocated_count": allocated_count
    }

@app.get("/api/seats/history", response_model=List[AllocationHistoryOut])
def get_allocation_history(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    offset = (page - 1) * limit
    return db.query(AllocationHistory).order_by(AllocationHistory.id.desc()).offset(offset).limit(limit).all()


# --- AI / NATURAL LANGUAGE QUERY ---

@app.post("/api/ai/query", response_model=AIQueryResponse)
def handle_ai_query(req: AIQueryRequest, db: Session = Depends(get_db)):
    result = parse_query(req.query, db)
    return result
