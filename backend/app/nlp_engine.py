import re
from sqlalchemy.orm import Session
from backend.db.models import Employee, Project, Seat, AllocationHistory

# Regex patterns for matching various intents
PATTERNS = {
    "dashboard_summary": [
        r"^(show|view|get)?\s*(dashboard|summary|analytics|metrics|utilization\s*rate)$",
        r"^how\s*is\s*the\s*(space|seat|office)\s*(utilization|occupancy)$"
    ],
    "list_new_joiners": [
        r"^(show|list|get)?\s*new\s*joiners?(\s*without\s*seats?)?$",
        r"^who\s*is\s*new$"
    ],
    "list_remote_employees": [
        r"^(show|list|get)?\s*remote\s*employees?$",
        r"^who\s*is\s*working\s*remotely$"
    ],
    "find_seats_floor": [
        r"^(find|show|list|get)?\s*(available|empty|free|vacant)?\s*seats\s*on\s*floor\s*([1-5])$",
        r"^floor\s*([1-5])\s*(available|empty|free|vacant)?\s*seats$"
    ],
    "find_employee": [
        r"^(where\s*is|find|show|get|search)\s*employee\s*(.+)$",
        r"^where\s*is\s*(.+)$",
        r"^seat\s*of\s*(.+)$",
        r"^find\s*(.+)$"
    ],
    "project_members": [
        r"^(which\s*employees\s*are\s*in|who\s*is\s*in|list\s*employees\s*in|show\s*members\s*of)\s*(project\s*)?(.+)$",
        r"^project\s*(.+)\s*members$"
    ],
    "project_utilization": [
        r"^(utilization|occupancy)\s*(of|for)\s*(project\s*)?(.+)$",
        r"^how\s*busy\s*is\s*(project\s*)?(.+)$"
    ],
    "seat_info": [
        r"^(who\s*is\s*sitting\s*in|who\s*is\s*in|status\s*of|info\s*on)\s*seat\s*([fF][1-5]-[a-dD]\d{3})$",
        r"^seat\s*([fF][1-5]-[a-dD]\d{3})$",
        r"^who\s*is\s*at\s*([fF][1-5]-[a-dD]\d{3})$"
    ],
    "allocate_action": [
        r"^(allocate|assign|give)\s*(seat\s*)?([fF][1-5]-[a-dD]\d{3})\s*to\s*(.+)$",
        r"^(allocate|assign|give)\s*(.+)\s*(to\s*seat\s*|to\s*)?([fF][1-5]-[a-dD]\d{3})$"
    ],
    "release_action": [
        r"^(release|free|unassign|empty|vacate)\s*(seat\s*)?([fF][1-5]-[a-dD]\d{3})$",
        r"^remove\s*employee\s*from\s*(seat\s*)?([fF][1-5]-[a-dD]\d{3})$"
    ]
}

def parse_query(query_text: str, db: Session) -> dict:
    query_text = query_text.strip().lower()
    
    # Let's loop through the pattern definitions to find a match
    for intent, regex_list in PATTERNS.items():
        for pattern in regex_list:
            match = re.match(pattern, query_text, re.IGNORECASE)
            if match:
                return handle_intent(intent, match, db)
                
    # Fallback search - if we just mention employee name, seat number, or project name
    # Let's see if we can resolve it by parsing common things.
    
    # 1. Check if it looks like a seat number: e.g. F2-A045
    seat_match = re.search(r"([fF][1-5]-[a-dD]\d{3})", query_text)
    if seat_match:
        seat_num = seat_match.group(1).upper()
        return execute_seat_info(seat_num, db)
        
    # 2. Check if it matches a project name/code
    project = db.query(Project).filter(
        (Project.name.ilike(query_text)) | (Project.code.ilike(query_text))
    ).first()
    if project:
        return execute_project_members(project.name, db)
        
    # 3. Check if it matches an employee name
    employee = db.query(Employee).filter(Employee.name.ilike(f"%{query_text}%")).first()
    if employee:
        return execute_find_employee(employee.name, db)
        
    return {
        "response_text": "I'm sorry, I couldn't understand that query. You can ask me things like 'find available seats on floor 2', 'where is John Doe sitting', 'who is in seat F2-B005', or 'allocate seat F1-A010 to Jane Smith'.",
        "query_type": "unknown",
        "data": None,
        "suggested_action": None
    }

def handle_intent(intent: str, match, db: Session) -> dict:
    if intent == "dashboard_summary":
        return execute_dashboard_summary(db)
    elif intent == "list_new_joiners":
        return execute_list_new_joiners(db)
    elif intent == "list_remote_employees":
        return execute_list_remote_employees(db)
    elif intent == "find_seats_floor":
        floor_num = int(match.group(3) if len(match.groups()) >= 3 else match.group(1))
        return execute_find_seats_floor(floor_num, db)
    elif intent == "find_employee":
        emp_name = match.group(2) if len(match.groups()) >= 2 else match.group(1)
        return execute_find_employee(emp_name.strip(), db)
    elif intent == "project_members":
        proj_name = match.group(3) if len(match.groups()) >= 3 else match.group(1)
        return execute_project_members(proj_name.strip(), db)
    elif intent == "project_utilization":
        proj_name = match.group(4) if len(match.groups()) >= 4 else match.group(2)
        return execute_project_utilization(proj_name.strip(), db)
    elif intent == "seat_info":
        seat_num = match.group(1).upper()
        return execute_seat_info(seat_num, db)
    elif intent == "allocate_action":
        # Group extraction depends on which pattern matched
        # Pattern 1: allocate seat F2-B004 to John Doe (groups: allocate/assign, seat, F2-B004, John Doe)
        # Pattern 2: allocate John Doe to seat F2-B004 (groups: allocate/assign, John Doe, to seat, F2-B004)
        if "to" in match.group(0):
            # Check which group is the seat
            g3 = match.group(3)
            g4 = match.group(4)
            if re.match(r"^[fF][1-5]-[a-dD]\d{3}$", g3):
                seat_num = g3.upper()
                emp_name = g4.strip()
            else:
                seat_num = g4.upper()
                emp_name = match.group(2).strip()
        else:
            seat_num = match.group(3).upper()
            emp_name = match.group(4).strip()
        return execute_allocate_action(seat_num, emp_name, db)
    elif intent == "release_action":
        seat_num = match.group(2).upper()
        return execute_release_action(seat_num, db)

    return {
        "response_text": "Intent understood but not implemented yet.",
        "query_type": intent,
        "data": None,
        "suggested_action": None
    }

# Execution Handlers

def execute_dashboard_summary(db: Session) -> dict:
    total_emp = db.query(Employee).count()
    total_p = db.query(Project).count()
    total_s = db.query(Seat).count()
    occ_s = db.query(Seat).filter(Seat.status == "Occupied").count()
    maint_s = db.query(Seat).filter(Seat.status == "Maintenance").count()
    avail_s = db.query(Seat).filter(Seat.status == "Available").count()
    rem_emp = db.query(Employee).filter(Employee.status == "Remote").count()
    nj_emp = db.query(Employee).filter(Employee.status == "New Joiner").count()
    
    util_rate = round((occ_s / (total_s - maint_s)) * 100, 2) if (total_s - maint_s) > 0 else 0.0

    return {
        "response_text": f"Here is the office dashboard summary: There are {total_emp} total employees, {total_p} active projects, and {total_s} seats. Currently, {occ_s} seats are occupied ({util_rate}% utilization), {avail_s} are available, and {maint_s} are in maintenance. We have {rem_emp} remote employees and {nj_emp} unallocated new joiners.",
        "query_type": "dashboard_summary",
        "data": {
            "total_employees": total_emp,
            "total_projects": total_p,
            "total_seats": total_s,
            "occupied_seats": occ_s,
            "available_seats": avail_s,
            "maintenance_seats": maint_s,
            "remote_employees": rem_emp,
            "new_joiners": nj_emp,
            "utilization_rate": util_rate
        },
        "suggested_action": {
            "type": "view_dashboard",
            "params": {}
        }
    }

def execute_list_new_joiners(db: Session) -> dict:
    new_joiners = db.query(Employee).filter(Employee.status == "New Joiner").limit(20).all()
    count = db.query(Employee).filter(Employee.status == "New Joiner").count()
    
    names = ", ".join([e.name for e in new_joiners[:10]])
    list_str = f"First few: {names}." if count > 0 else "None found."
    response = f"There are currently {count} new joiners waiting for seat allocation. {list_str}"
    
    return {
        "response_text": response,
        "query_type": "list_new_joiners",
        "data": {
            "count": count,
            "employees": [{"id": e.id, "name": e.name, "email": e.email, "role": e.role, "join_date": str(e.join_date)} for e in new_joiners]
        },
        "suggested_action": {
            "type": "filter_employees",
            "params": {"status": "New Joiner"}
        }
    }

def execute_list_remote_employees(db: Session) -> dict:
    remote_emps = db.query(Employee).filter(Employee.status == "Remote").limit(20).all()
    count = db.query(Employee).filter(Employee.status == "Remote").count()
    
    names = ", ".join([e.name for e in remote_emps[:10]])
    list_str = f"Some of them: {names}." if count > 0 else "None found."
    response = f"There are {count} employees currently working remotely. {list_str}"
    
    return {
        "response_text": response,
        "query_type": "list_remote",
        "data": {
            "count": count,
            "employees": [{"id": e.id, "name": e.name, "email": e.email, "role": e.role} for e in remote_emps]
        },
        "suggested_action": {
            "type": "filter_employees",
            "params": {"status": "Remote"}
        }
    }

def execute_find_seats_floor(floor_num: int, db: Session) -> dict:
    seats = db.query(Seat).filter(Seat.floor == floor_num, Seat.status == "Available").all()
    count = len(seats)
    
    response = f"There are {count} available seats on Floor {floor_num}."
    if count > 0:
        blocks_count = {}
        for s in seats:
            blocks_count[s.block] = blocks_count.get(s.block, 0) + 1
        blocks_str = ", ".join([f"Block {b}: {c} seats" for b, c in sorted(blocks_count.items())])
        response += f" Distribution: {blocks_str}."

    return {
        "response_text": response,
        "query_type": "find_seats_floor",
        "data": {
            "floor": floor_num,
            "available_count": count,
            "seats": [{"id": s.id, "seat_number": s.seat_number, "block": s.block} for s in seats[:30]]
        },
        "suggested_action": {
            "type": "filter_seats",
            "params": {"floor": floor_num, "status": "Available"}
        }
    }

def execute_find_employee(emp_name: str, db: Session) -> dict:
    employees = db.query(Employee).filter(Employee.name.ilike(f"%{emp_name}%")).limit(5).all()
    
    if not employees:
        return {
            "response_text": f"I couldn't find any employee named '{emp_name}'.",
            "query_type": "find_employee",
            "data": None,
            "suggested_action": None
        }
        
    if len(employees) > 1:
        names = ", ".join([e.name for e in employees])
        return {
            "response_text": f"I found multiple matches for '{emp_name}': {names}. Please be more specific.",
            "query_type": "find_employee_multiple",
            "data": {"matches": [e.name for e in employees]},
            "suggested_action": None
        }
        
    emp = employees[0]
    proj_name = emp.project.name if emp.project else "No Project"
    
    if emp.status == "Remote":
        response = f"{emp.name} is a {emp.role} working remotely. They are assigned to project {proj_name} and do not have an office seat."
    elif emp.status == "New Joiner":
        response = f"{emp.name} is a new joiner ({emp.role}). They are assigned to project {proj_name} and are currently waiting for seat allocation."
    elif emp.status == "Resigned":
        response = f"{emp.name} has resigned from their position as {emp.role}."
    elif emp.seat:
        response = f"{emp.name} ({emp.role}) is sitting at seat **{emp.seat.seat_number}** (Floor {emp.seat.floor}, Block {emp.seat.block}) and is mapped to project {proj_name}."
    else:
        response = f"{emp.name} ({emp.role}) is active in project {proj_name} but has no assigned seat."

    return {
        "response_text": response,
        "query_type": "find_employee",
        "data": {
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "email": emp.email,
            "status": emp.status,
            "project": proj_name,
            "seat_number": emp.seat.seat_number if emp.seat else None
        },
        "suggested_action": {
            "type": "view_employee",
            "params": {"id": emp.id}
        }
    }

def execute_project_members(proj_name: str, db: Session) -> dict:
    project = db.query(Project).filter(
        (Project.name.ilike(f"%{proj_name}%")) | (Project.code.ilike(proj_name))
    ).first()
    
    if not project:
        return {
            "response_text": f"I couldn't find any project matching '{proj_name}'.",
            "query_type": "project_members",
            "data": None,
            "suggested_action": None
        }
        
    members = db.query(Employee).filter(Employee.project_id == project.id).all()
    total = len(members)
    
    allocated = sum(1 for m in members if m.seat_id is not None)
    remote = sum(1 for m in members if m.status == "Remote")
    new_joiners = sum(1 for m in members if m.status == "New Joiner")
    
    names_list = ", ".join([m.name for m in members[:10]])
    list_str = f"Some members: {names_list}." if total > 0 else "No members assigned yet."
    
    response = f"Project **{project.name}** ({project.code}) is in the {project.department} department, managed by {project.manager_name}. It has {total} mapped employees: {allocated} allocated in seats, {remote} remote, and {new_joiners} new joiners. {list_str}"

    return {
        "response_text": response,
        "query_type": "project_members",
        "data": {
            "id": project.id,
            "name": project.name,
            "code": project.code,
            "manager": project.manager_name,
            "department": project.department,
            "total_members": total,
            "allocated_seats": allocated,
            "remote_members": remote,
            "new_joiners": new_joiners
        },
        "suggested_action": {
            "type": "view_project",
            "params": {"id": project.id}
        }
    }

def execute_project_utilization(proj_name: str, db: Session) -> dict:
    # This is similar to project members but details space utilization / layouts
    project = db.query(Project).filter(
        (Project.name.ilike(f"%{proj_name}%")) | (Project.code.ilike(proj_name))
    ).first()
    
    if not project:
        return {
            "response_text": f"I couldn't find any project matching '{proj_name}' to calculate utilization.",
            "query_type": "project_utilization",
            "data": None,
            "suggested_action": None
        }
        
    members = db.query(Employee).filter(Employee.project_id == project.id).all()
    total = len(members)
    allocated = sum(1 for m in members if m.seat_id is not None)
    
    # Find floor distribution
    floors = {}
    for m in members:
        if m.seat:
            floors[m.seat.floor] = floors.get(m.seat.floor, 0) + 1
            
    floor_dist_str = ", ".join([f"Floor {f}: {c} seats" for f, c in sorted(floors.items())])
    dist_text = f" Floor distribution: {floor_dist_str}." if floors else " No seats allocated yet."
    
    response = f"Project **{project.name}** has {allocated} allocated physical seats out of {total} total members ({round((allocated/total)*100, 2) if total > 0 else 0}% physical occupancy).{dist_text}"
    
    return {
        "response_text": response,
        "query_type": "project_utilization",
        "data": {
            "id": project.id,
            "name": project.name,
            "total_members": total,
            "allocated_seats": allocated,
            "floors": floors
        },
        "suggested_action": {
            "type": "view_project",
            "params": {"id": project.id}
        }
    }

def execute_seat_info(seat_num: str, db: Session) -> dict:
    seat = db.query(Seat).filter(Seat.seat_number.ilike(seat_num)).first()
    
    if not seat:
        return {
            "response_text": f"Seat '{seat_num}' does not exist in the office layout. Please check the seat format (e.g. F2-A005).",
            "query_type": "seat_info",
            "data": None,
            "suggested_action": None
        }
        
    if seat.status == "Maintenance":
        response = f"Seat **{seat.seat_number}** (Floor {seat.floor}, Block {seat.block}) is currently under **Maintenance**."
    elif seat.status == "Available" or not seat.employee:
        response = f"Seat **{seat.seat_number}** (Floor {seat.floor}, Block {seat.block}) is currently **Available**."
    else:
        emp = seat.employee
        proj_name = emp.project.name if emp.project else "No Project"
        response = f"Seat **{seat.seat_number}** (Floor {seat.floor}, Block {seat.block}) is **Occupied** by **{emp.name}** ({emp.role}), who is mapped to project {proj_name}."

    return {
        "response_text": response,
        "query_type": "seat_info",
        "data": {
            "id": seat.id,
            "seat_number": seat.seat_number,
            "floor": seat.floor,
            "block": seat.block,
            "status": seat.status,
            "employee": {
                "id": seat.employee.id,
                "name": seat.employee.name,
                "role": seat.employee.role,
                "project": seat.employee.project.name if seat.employee.project else None
            } if seat.employee else None
        },
        "suggested_action": {
            "type": "view_seat",
            "params": {"seat_number": seat.seat_number, "floor": seat.floor}
        }
    }

def execute_allocate_action(seat_num: str, emp_name: str, db: Session) -> dict:
    # 1. Lookup Seat
    seat = db.query(Seat).filter(Seat.seat_number.ilike(seat_num)).first()
    if not seat:
        return {
            "response_text": f"Seat '{seat_num}' does not exist in our system.",
            "query_type": "allocate_action_failed",
            "data": None,
            "suggested_action": None
        }
        
    # 2. Lookup Employee
    employees = db.query(Employee).filter(Employee.name.ilike(f"%{emp_name}%")).limit(5).all()
    if not employees:
        return {
            "response_text": f"I couldn't find any employee matching '{emp_name}' to allocate to seat {seat_num}.",
            "query_type": "allocate_action_failed",
            "data": None,
            "suggested_action": None
        }
        
    if len(employees) > 1:
        names = ", ".join([e.name for e in employees])
        return {
            "response_text": f"I found multiple employees matching '{emp_name}' ({names}). Please write the full name to allocate to seat {seat_num}.",
            "query_type": "allocate_action_ambiguous",
            "data": {"matches": [e.name for e in employees], "seat_number": seat.seat_number, "seat_id": seat.id},
            "suggested_action": None
        }
        
    emp = employees[0]
    
    # Create the action proposal
    response = f"I've found employee **{emp.name}** and seat **{seat.seat_number}** ({seat.status}). Would you like to allocate this seat? Click the action below to confirm."
    if seat.status == "Occupied":
        curr_occupant = db.query(Employee).filter(Employee.seat_id == seat.id).first()
        curr_name = curr_occupant.name if curr_occupant else "someone"
        response = f"Seat **{seat.seat_number}** is currently occupied by **{curr_name}**. Allocating it to **{emp.name}** will release it from the current occupant first. Would you like to proceed?"

    return {
        "response_text": response,
        "query_type": "allocate_action_proposal",
        "data": {
            "employee_id": emp.id,
            "employee_name": emp.name,
            "seat_id": seat.id,
            "seat_number": seat.seat_number,
            "current_status": seat.status
        },
        "suggested_action": {
            "type": "allocate",
            "params": {
                "employee_id": emp.id,
                "employee_name": emp.name,
                "seat_id": seat.id,
                "seat_number": seat.seat_number
            }
        }
    }

def execute_release_action(seat_num: str, db: Session) -> dict:
    seat = db.query(Seat).filter(Seat.seat_number.ilike(seat_num)).first()
    if not seat:
        return {
            "response_text": f"Seat '{seat_num}' does not exist in the office plan.",
            "query_type": "release_action_failed",
            "data": None,
            "suggested_action": None
        }
        
    if seat.status != "Occupied":
        return {
            "response_text": f"Seat **{seat.seat_number}** is already **{seat.status}**; there is no occupant to release.",
            "query_type": "release_action_failed",
            "data": None,
            "suggested_action": None
        }
        
    emp = db.query(Employee).filter(Employee.seat_id == seat.id).first()
    emp_name = emp.name if emp else "its occupant"
    
    response = f"Would you like to release seat **{seat.seat_number}** from **{emp_name}**? Click the button below to confirm."
    
    return {
        "response_text": response,
        "query_type": "release_action_proposal",
        "data": {
            "seat_id": seat.id,
            "seat_number": seat.seat_number,
            "occupant_name": emp_name
        },
        "suggested_action": {
            "type": "release",
            "params": {
                "seat_id": seat.id,
                "seat_number": seat.seat_number,
                "occupant_name": emp_name
            }
        }
    }
