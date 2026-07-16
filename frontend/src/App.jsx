import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import FloorPlanView from './components/FloorPlanView';
import EmployeesView from './components/EmployeesView';
import ProjectsView from './components/ProjectsView';
import NewJoinersView from './components/NewJoinersView';
import AIChatbox from './components/AIChatbox';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [summaryData, setSummaryData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [seatsData, setSeatsData] = useState([]);
  const [unallocatedEmployees, setUnallocatedEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employeesResponse, setEmployeesResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // External highlight bridges for NLP and Wizards
  const [selectedSeatFromQuery, setSelectedSeatFromQuery] = useState(null);
  const [selectedEmployeeFromNewJoiners, setSelectedEmployeeFromNewJoiners] = useState(null);

  // Global notifications toast state
  const [toast, setToast] = useState(null);

  const toastTimeoutRef = React.useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  // Helper fetch function
  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // 1. Dashboard summary
      const sumRes = await fetch(`${API_BASE}/dashboard/summary`);
      const sumVal = await sumRes.json();
      setSummaryData(sumVal);

      // 2. Audit history log
      const histRes = await fetch(`${API_BASE}/seats/history?limit=10`);
      const histVal = await histRes.json();
      setHistoryData(histVal);

      // 3. Seats (all floor maps)
      const seatsRes = await fetch(`${API_BASE}/seats`);
      const seatsVal = await seatsRes.json();
      setSeatsData(seatsVal);

      // 4. Projects
      const projRes = await fetch(`${API_BASE}/projects`);
      const projVal = await projRes.json();
      setProjects(projVal);

      // 5. Unallocated Employees (both New Joiner and Remote statuses)
      const unallocRes = await fetch(`${API_BASE}/employees?status=New%20Joiner&limit=100`);
      const unallocVal = await unallocRes.json();
      setUnallocatedEmployees(unallocVal.results);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching Ethara API:", err);
      showToast("Unable to connect to the backend server.", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch employees for directory view (paginated + search)
  const handleFetchEmployees = async (page = 1, search = '', projId = '', status = '') => {
    try {
      let url = `${API_BASE}/employees?page=${page}&limit=50`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (projId) url += `&project_id=${projId}`;
      if (status) url += `&status=${encodeURIComponent(status)}`;

      const res = await fetch(url);
      const data = await res.json();
      setEmployeesResponse(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch employee directory.", "error");
    }
  };

  // Add a new employee
  const handleAddEmployee = async (employeeData) => {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employeeData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw { response: { data: err } };
    }
    showToast(`Registered employee: ${employeeData.name}`);
    fetchAllData();
  };

  // Seat allocation transaction
  const handleAllocate = async (employeeId, seatId, actor = "Admin Specialist") => {
    const res = await fetch(`${API_BASE}/seats/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, seat_id: seatId, performed_by: actor })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Allocation failed.", "error");
      throw err;
    }
    showToast("Seat allocation successful!");
    fetchAllData();
  };

  // Seat release transaction
  const handleRelease = async (seatId, actor = "Admin Specialist") => {
    const res = await fetch(`${API_BASE}/seats/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_id: seatId, performed_by: actor })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Release failed.", "error");
      throw err;
    }
    showToast("Seat occupant released.");
    fetchAllData();
  };

  // Bulk release occupants from a list of seat IDs
  const handleBulkRelease = async (seatIds, actor = "Admin Specialist") => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/seats/bulk-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_ids: seatIds, performed_by: actor })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.detail || "Bulk release failed.", "error");
        setLoading(false);
        return;
      }
      showToast("Selected occupants released successfully!");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to run bulk seat release.", "error");
      setLoading(false);
    }
  };

  // Toggle seat maintenance status
  const handleToggleMaintenance = async (seatId, action, actor = "Admin Specialist") => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/seats/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id: seatId, action, performed_by: actor })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.detail || "Maintenance action failed.", "error");
        setLoading(false);
        return;
      }
      const val = await res.json();
      showToast(val.message || "Seat status updated successfully.");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to update seat maintenance status.", "error");
      setLoading(false);
    }
  };

  // Bulk auto-allocate unallocated new joiners to vacant seats
  const handleBulkAutoAllocate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/seats/auto-allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.detail || "Bulk auto-allocation failed.", "error");
        setLoading(false);
        return;
      }
      const val = await res.json();
      showToast(val.message || "Bulk auto-allocation completed!");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to run bulk auto-allocation.", "error");
      setLoading(false);
    }
  };

  // AI assistant query API call
  const handleAIChatQuery = async (queryText) => {
    const res = await fetch(`${API_BASE}/ai/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText })
    });
    if (!res.ok) {
      throw new Error("API call error");
    }
    return await res.json();
  };

  // Execute NLP action triggers (e.g. allocating, filtering maps, etc.)
  const handleTriggerAction = async (action) => {
    if (action.type === 'allocate') {
      try {
        await handleAllocate(action.params.employee_id, action.params.seat_id, "AI Assistant");
        showToast(`AI executed allocation for ${action.params.employee_name}`);
      } catch (e) {
        // error handled in toast
      }
    } else if (action.type === 'release') {
      try {
        await handleRelease(action.params.seat_id, "AI Assistant");
        showToast(`AI released seat occupants`);
      } catch (e) {
        // error
      }
    } else if (action.type === 'filter_seats') {
      setSelectedSeatFromQuery({
        floor: action.params.floor,
        block: 'A', // default block
        seat_number: `F${action.params.floor}-A001`
      });
      setActiveView('floorplan');
      showToast(`Navigated to Floor ${action.params.floor} layout map.`);
    } else if (action.type === 'view_seat') {
      setSelectedSeatFromQuery({
        floor: action.params.floor,
        block: action.params.seat_number.split('-')[1][0], // extract block letter
        seat_number: action.params.seat_number
      });
      setActiveView('floorplan');
    } else if (action.type === 'view_employee') {
      // Find employee's details and redirect to directory with search filter
      setActiveView('employees');
      handleFetchEmployees(1, action.params.id.toString(), '', '');
    } else if (action.type === 'view_project') {
      setActiveView('projects');
    } else if (action.type === 'view_dashboard') {
      setActiveView('dashboard');
    }
  };

  // Bridge navigation from new joiners portal to floor layout map
  const handleGoToAllocateFromWizard = (employee, recommendedSpot) => {
    setSelectedEmployeeFromNewJoiners(employee);
    setSelectedSeatFromQuery({
      floor: recommendedSpot.floor,
      block: recommendedSpot.block,
      seat_number: recommendedSpot.seat_number
    });
    setActiveView('floorplan');
    showToast(`Loaded ${employee.name} allocation card. Select a highlighted seat.`);
  };

  return (
    <div className="flex bg-ethara-dark min-h-screen text-gray-100 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 flex items-center gap-2.5 px-4.5 py-3 rounded-xl border shadow-2xl z-[999] animate-bounce ${
          toast.type === 'error' 
            ? 'bg-red-500/10 border-red-500/25 text-red-400' 
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="h-4.5 w-4.5 shrink-0" /> : <CheckCircle className="h-4.5 w-4.5 shrink-0" />}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/10 rounded p-0.5"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        unallocatedCount={unallocatedEmployees.length}
      />

      {/* Main View Area */}
      <main className="flex-1 p-8 overflow-y-auto h-screen max-w-[1400px] mx-auto">
        {activeView === 'dashboard' && (
          <DashboardView 
            summaryData={summaryData} 
            historyData={historyData}
            onRefresh={fetchAllData}
          />
        )}

        {activeView === 'floorplan' && (
          <FloorPlanView 
            seatsData={seatsData}
            unallocatedEmployees={unallocatedEmployees}
            onAllocate={handleAllocate}
            onRelease={handleRelease}
            onBulkRelease={handleBulkRelease}
            onToggleMaintenance={handleToggleMaintenance}
            onRefresh={fetchAllData}
            loading={loading}
            selectedSeatFromQuery={selectedSeatFromQuery}
            selectedEmployeeFromNewJoiners={selectedEmployeeFromNewJoiners}
          />
        )}

        {activeView === 'employees' && (
          <EmployeesView 
            projects={projects}
            onAddEmployee={handleAddEmployee}
            onFetchEmployees={handleFetchEmployees}
            employeesResponse={employeesResponse}
          />
        )}

        {activeView === 'projects' && (
          <ProjectsView 
            projects={projects}
            summaryData={summaryData}
          />
        )}

        {activeView === 'newjoiners' && (
          <NewJoinersView 
            unallocatedEmployees={unallocatedEmployees}
            seatsData={seatsData}
            projects={projects}
            onAddEmployee={handleAddEmployee}
            onGoToAllocate={handleGoToAllocateFromWizard}
            onBulkAutoAllocate={handleBulkAutoAllocate}
            loading={loading}
          />
        )}

        {activeView === 'aichat' && (
          <AIChatbox 
            onSendQuery={handleAIChatQuery}
            onTriggerAction={handleTriggerAction}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}
