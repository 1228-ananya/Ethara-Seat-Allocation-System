import random
import datetime
from sqlalchemy.orm import Session
from backend.db.database import engine, Base, SessionLocal
from backend.db.models import Employee, Project, Seat, AllocationHistory

# Names for generating realistic employees
FIRST_NAMES = [
    "Aaron", "Abby", "Adam", "Adil", "Aisha", "Alan", "Alex", "Alia", "Amir", "Amy",
    "Andrew", "Anna", "Anil", "Anya", "Arjun", "Ashley", "Ben", "Bilal", "Brandon",
    "Chloe", "Daniel", "David", "Divya", "Emily", "Eric", "Faisal", "Farah", "Ganesh",
    "George", "Grace", "Hana", "Hari", "Ian", "Imran", "Jack", "James", "Jane", "John",
    "Jyoti", "Kabir", "Karen", "Kevin", "Kiran", "Layla", "Leo", "Lisa", "Luke", "Maria",
    "Mark", "Maya", "Michael", "Mona", "Nadia", "Nathan", "Neha", "Omar", "Olivia",
    "Peter", "Pooja", "Rahul", "Rania", "Ravi", "Ryan", "Sahar", "Sanjay", "Sara",
    "Sean", "Shreya", "Siddharth", "Sophia", "Tarek", "Tara", "Thomas", "Uma", "Victor",
    "Vikram", "William", "Yasmin", "Yousef", "Zain", "Zara"
]

LAST_NAMES = [
    "Al-Mansoori", "Al-Suwaidi", "Al-Hashimi", "Anderson", "Brown", "Campbell", "Chen",
    "Das", "Davis", "Devi", "El-Amin", "Evans", "Gomez", "Gupta", "Haddad", "Harris",
    "Ibrahim", "Iyer", "Jackson", "Johnson", "Joshi", "Kapoor", "Khan", "Kumar", "Lee",
    "Martin", "Mehta", "Miller", "Murthy", "Nair", "Nguyen", "Patel", "Prasad", "Qureshi",
    "Rao", "Rodriguez", "Roy", "Sani", "Sharma", "Singh", "Smith", "Taylor", "Thomas",
    "Varma", "Williams", "Wilson", "Yousuf", "Zaidi"
]

DEPARTMENTS = [
    ("Engineering", ["Software Engineer", "Senior Software Engineer", "DevOps Engineer", "QA Engineer", "Engineering Manager", "Data Scientist"]),
    ("Design", ["UI/UX Designer", "Senior Designer", "Design Lead"]),
    ("Product", ["Product Manager", "Product Owner", "Director of Product"]),
    ("Operations", ["Operations Coordinator", "Operations Manager"]),
    ("HR", ["HR Generalist", "HR Manager", "Talent Acquisition Specialist"]),
    ("Admin", ["Admin Specialist", "Facility Manager"])
]

PROJECT_NAMES = [
    ("Project Pegasus", "PEG", "Engineering", "F1"),
    ("Project Sirius", "SIR", "Engineering", "F1"),
    ("Project Orion", "ORI", "Engineering", "F2"),
    ("Project Apollo", "APO", "Engineering", "F2"),
    ("Project Phoenix", "PHX", "Engineering", "F3"),
    ("Project Gemini", "GEM", "Engineering", "F3"),
    ("Project Alpha", "ALP", "Engineering", "F4"),
    ("Project Titan", "TTN", "Engineering", "F4"),
    ("Project Genesis", "GEN", "Design", "F5"),
    ("Project Aurora", "AUR", "Design", "F5"),
    ("Project Chronos", "CHR", "Product", "F2"),
    ("Project Aegis", "AEG", "Operations", "F3"),
    ("Project Cosmos", "COS", "Engineering", "F4"),
    ("Project Valkyrie", "VAL", "Engineering", "F5"),
    ("Project Horizon", "HRZ", "Engineering", "F1"),
    ("Project Sentinel", "SNT", "Engineering", "F3"),
    ("Project Odyssey", "ODY", "Design", "F5"),
    ("Project Zenith", "ZNT", "Product", "F1"),
    ("Project Legacy", "LGC", "Operations", "F4"),
    ("Project Nebula", "NEB", "Engineering", "F2"),
]

def seed_db():
    print("Re-creating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        print("Generating projects...")
        projects = []
        for name, code, dept, floor in PROJECT_NAMES:
            mgr_first = random.choice(FIRST_NAMES)
            mgr_last = random.choice(LAST_NAMES)
            proj = Project(
                name=name,
                code=code,
                description=f"Core initiative mapping {name} development milestones and deliverables in the {dept} division.",
                manager_name=f"{mgr_first} {mgr_last}",
                department=dept,
                status="Active"
            )
            db.add(proj)
            projects.append((proj, floor)) # keep track of target floor for project co-location
        db.commit()

        # Refresh project instances to get their IDs
        for p, _ in projects:
            db.refresh(p)

        print("Generating seats...")
        # 5 Floors, 4 Blocks (A, B, C, D), 150 Seats per Block = 3,000 Seats total
        floors = [1, 2, 3, 4, 5]
        blocks = ["A", "B", "C", "D"]
        seats_by_floor = {f: [] for f in floors}

        seats_to_insert = []
        for floor in floors:
            for block in blocks:
                for seat_idx in range(1, 151):
                    seat_num = f"F{floor}-{block}{seat_idx:03d}"
                    # Mark 2% of seats as in maintenance for realism
                    status = "Maintenance" if random.random() < 0.02 else "Available"
                    seat = Seat(
                        seat_number=seat_num,
                        floor=floor,
                        block=block,
                        status=status
                    )
                    seats_to_insert.append(seat)
        
        # Bulk save seats
        db.bulk_save_objects(seats_to_insert)
        db.commit()

        # Query all seats to map them locally for fast allocation
        db_seats = db.query(Seat).all()
        # Group seats by floor and availability
        available_seats_by_floor = {f: [] for f in floors}
        for s in db_seats:
            if s.status == "Available":
                available_seats_by_floor[s.floor].append(s)

        print("Generating 5,000 employees and allocating seats...")
        employees = []
        histories = []

        start_date = datetime.date(2023, 1, 1)
        end_date = datetime.date(2026, 6, 30)
        time_range = (end_date - start_date).days

        # We will split 5,000 employees:
        # - 2,200 assigned to active projects, allocated to seats.
        # - 1,500 assigned to active projects, marked as Remote (no seats).
        # - 800 Active or New Joiners with no project and/or no seat.
        # - 300 Resigned (no seat, project unassigned).
        # - 200 Maintenance seats (already handled, but we will make some employees former holders).

        total_employees = 5000
        allocated_count = 2200
        remote_count = 1500
        new_joiner_count = 800
        resigned_count = 500

        # Unique email generator helper
        used_emails = set()

        for idx in range(total_employees):
            # Choose Department and Role
            dept_name, roles = random.choice(DEPARTMENTS)
            role = random.choice(roles)

            # Generate Name
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            email_base = f"{name.lower().replace(' ', '.')}"
            email = email_base
            email_counter = 1
            while email in used_emails:
                email = f"{email_base}{email_counter}"
                email_counter += 1
            used_emails.add(email)
            email = f"{email}@ethara.ae"

            # Generate Join Date
            join_days = random.randint(0, time_range)
            join_date = start_date + datetime.timedelta(days=join_days)

            # Assign Status
            if idx < allocated_count:
                status = "Active"
                # Assign to project
                proj, target_floor = random.choice(projects)
                proj_id = proj.id
                
                # Seat allocation using target floor preference (co-location)
                pref_floor = int(target_floor[1])
                allocated_seat = None
                
                # Check preferred floor first
                if available_seats_by_floor[pref_floor]:
                    allocated_seat = available_seats_by_floor[pref_floor].pop(0)
                else:
                    # Fallback to any other floor
                    for f in floors:
                        if available_seats_by_floor[f]:
                            allocated_seat = available_seats_by_floor[f].pop(0)
                            break
                
                if allocated_seat:
                    seat_id = allocated_seat.id
                    allocated_seat.status = "Occupied"
                    
                    employees.append({
                        "name": name,
                        "email": email,
                        "role": role,
                        "join_date": join_date,
                        "status": status,
                        "project_id": proj_id,
                        "seat_id": seat_id
                    })
                    
                    # Create allocation history log
                    histories.append({
                        "employee_id": idx + 1,  # SQLite/Postgre auto-increment starts at 1
                        "employee_name": name,
                        "seat_id": seat_id,
                        "seat_number": allocated_seat.seat_number,
                        "project_id": proj_id,
                        "project_name": proj.name,
                        "action": "Allocate",
                        "performed_at": datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=random.randint(0, 100)),
                        "performed_by": "System Seeder"
                    })
                else:
                    # No seats left! fallback to Remote
                    status = "Remote"
                    employees.append({
                        "name": name,
                        "email": email,
                        "role": role,
                        "join_date": join_date,
                        "status": status,
                        "project_id": proj_id,
                        "seat_id": None
                    })

            elif idx < (allocated_count + remote_count):
                # Remote employees (have projects, no seats)
                status = "Remote"
                proj, _ = random.choice(projects)
                employees.append({
                    "name": name,
                    "email": email,
                    "role": role,
                    "join_date": join_date,
                    "status": status,
                    "project_id": proj.id,
                    "seat_id": None
                })

            elif idx < (allocated_count + remote_count + new_joiner_count):
                # Active/New joiners without seats or projects yet
                # Join dates are recent
                recent_join_days = random.randint(time_range - 90, time_range) # past 90 days
                join_date = start_date + datetime.timedelta(days=recent_join_days)
                
                # Some are assigned a project but need a seat, some have neither
                has_proj = random.random() < 0.6
                proj_id = None
                if has_proj:
                    proj, _ = random.choice(projects)
                    proj_id = proj.id

                status = "New Joiner"
                employees.append({
                    "name": name,
                    "email": email,
                    "role": role,
                    "join_date": join_date,
                    "status": status,
                    "project_id": proj_id,
                    "seat_id": None
                })

            else:
                # Resigned employees (no project, no seat)
                status = "Resigned"
                employees.append({
                    "name": name,
                    "email": email,
                    "role": role,
                    "join_date": join_date,
                    "status": status,
                    "project_id": None,
                    "seat_id": None
                })

        print(f"Saving {len(employees)} employees...")
        db.bulk_insert_mappings(Employee, employees)
        db.commit()

        # Update seat statuses in db for those that got occupied
        print("Saving seat occupancy updates...")
        occupied_seat_ids = [s.id for s in db_seats if s.status == "Occupied"]
        if occupied_seat_ids:
            db.query(Seat).filter(Seat.id.in_(occupied_seat_ids)).update({"status": "Occupied"}, synchronize_session=False)
            db.commit()

        print(f"Saving {len(histories)} allocation history logs...")
        db.bulk_insert_mappings(AllocationHistory, histories)
        db.commit()

        print("Verification of seeded data:")
        total_emp = db.query(Employee).count()
        total_p = db.query(Project).count()
        total_s = db.query(Seat).count()
        occ_s = db.query(Seat).filter(Seat.status == "Occupied").count()
        maint_s = db.query(Seat).filter(Seat.status == "Maintenance").count()
        avail_s = db.query(Seat).filter(Seat.status == "Available").count()
        rem_emp = db.query(Employee).filter(Employee.status == "Remote").count()
        nj_emp = db.query(Employee).filter(Employee.status == "New Joiner").count()
        
        print(f"  - Total Employees: {total_emp}")
        print(f"  - Total Projects: {total_p}")
        print(f"  - Total Seats: {total_s} (Occupied: {occ_s}, Available: {avail_s}, Maintenance: {maint_s})")
        print(f"  - Remote Employees: {rem_emp}")
        print(f"  - New Joiner Employees: {nj_emp}")
        print("Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
