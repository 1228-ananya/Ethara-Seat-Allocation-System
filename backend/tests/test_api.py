import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime

from backend.db.database import Base, get_db
from backend.main import app
from backend.db.models import Employee, Project, Seat

# Setup SQLite test database
TEST_DATABASE_URL = "sqlite:///./test_ethara.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    # Recreate tables for testing
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed basic items for tests
        proj = Project(name="Project Alpha", code="ALP", manager_name="Test Mgr", department="Engineering")
        seat = Seat(seat_number="F1-A001", floor=1, block="A", status="Available")
        db.add(proj)
        db.add(seat)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_dashboard_summary(client):
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_employees" in data
    assert "total_seats" in data
    assert data["total_seats"] == 1
    assert data["available_seats"] == 1

def test_create_employee(client):
    employee_payload = {
        "name": "Jane Doe",
        "email": "jane.doe@ethara.ae",
        "role": "Software Engineer",
        "join_date": "2026-07-16",
        "status": "New Joiner",
        "project_id": 1
    }
    response = client.post("/api/employees", json=employee_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Jane Doe"
    assert data["status"] == "New Joiner"

def test_allocate_seat(client):
    # Allocate seat F1-A001 (id 1) to Jane Doe (id 1)
    allocate_payload = {
        "employee_id": 1,
        "seat_id": 1,
        "performed_by": "Admin Tester"
    }
    response = client.post("/api/seats/allocate", json=allocate_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

    # Verify status changed on seat and employee
    sum_resp = client.get("/api/dashboard/summary")
    sum_data = sum_resp.json()
    assert sum_data["allocated_seats"] == 1
    assert sum_data["available_seats"] == 0

def test_nlp_query_available_seats(client):
    nlp_payload = {
        "query": "find available seats on floor 1"
    }
    response = client.post("/api/ai/query", json=nlp_payload)
    assert response.status_code == 200
    data = response.json()
    assert "floor" in data["data"]
    assert data["data"]["floor"] == 1

def test_auto_allocate_new_joiners(client):
    # 1. Register a new joiner
    employee_payload = {
        "name": "Bob Smith",
        "email": "bob.smith@ethara.ae",
        "role": "QA Engineer",
        "join_date": "2026-07-16",
        "status": "New Joiner",
        "project_id": 1
    }
    create_res = client.post("/api/employees", json=employee_payload)
    assert create_res.status_code == 200

    # 2. Release seat F1-A001 so it's vacant
    release_payload = {"seat_id": 1, "performed_by": "Tester"}
    res = client.post("/api/seats/release", json=release_payload)
    assert res.status_code == 200
    
    # 3. Trigger auto allocate (Bob Smith is New Joiner, F1-A001 is vacant)
    auto_res = client.post("/api/seats/auto-allocate")
    assert auto_res.status_code == 200
    auto_data = auto_res.json()
    assert auto_data["status"] == "success"
    assert auto_data["allocated_count"] == 1

def test_bulk_release_seats(client):
    # Release seat F1-A001 (id 1) via bulk release
    bulk_release_payload = {
        "seat_ids": [1],
        "performed_by": "Tester"
    }
    res = client.post("/api/seats/bulk-release", json=bulk_release_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["released_count"] == 1

def test_toggle_seat_maintenance(client):
    # 1. Put seat ID 1 (F1-A001, currently vacant Available) into maintenance
    payload = {
        "seat_id": 1,
        "action": "maintenance",
        "performed_by": "Tester"
    }
    res = client.post("/api/seats/maintenance", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Verify status is Maintenance
    sum_resp = client.get("/api/dashboard/summary")
    sum_data = sum_resp.json()
    assert sum_data["maintenance_seats"] == 1
    assert sum_data["available_seats"] == 0

    # 2. Resolve maintenance back to Available
    resolve_payload = {
        "seat_id": 1,
        "action": "resolve",
        "performed_by": "Tester"
    }
    res = client.post("/api/seats/maintenance", json=resolve_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Verify status is back to Available
    sum_resp = client.get("/api/dashboard/summary")
    sum_data = sum_resp.json()
    assert sum_data["maintenance_seats"] == 0
    assert sum_data["available_seats"] == 1
