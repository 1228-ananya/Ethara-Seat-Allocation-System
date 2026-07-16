import React, { useState, useEffect } from 'react';
import { UserPlus, Award, Navigation, Briefcase, RefreshCw, Calendar, CheckCircle, Sparkles, AlertTriangle, X } from 'lucide-react';

export default function NewJoinersView({ 
  unallocatedEmployees, 
  seatsData, 
  projects = [],
  onAddEmployee,
  onGoToAllocate, 
  onBulkAutoAllocate,
  loading 
}) {
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  
  // Registration form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [projectId, setProjectId] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().substring(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedEmp = unallocatedEmployees.find(e => e.id === selectedEmpId);

  useEffect(() => {
    if (selectedEmp) {
      calculateRecommendation(selectedEmp);
    } else {
      setRecommendation(null);
    }
  }, [selectedEmpId, unallocatedEmployees, seatsData]);

  // If list changes, reset selected
  useEffect(() => {
    if (unallocatedEmployees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(unallocatedEmployees[0].id);
    }
  }, [unallocatedEmployees]);

  const calculateRecommendation = (emp) => {
    if (!emp.project) {
      // No project, suggest floor with highest vacant seats
      const vacantByFloor = {};
      seatsData.forEach(s => {
        if (s.status === 'Available') {
          vacantByFloor[s.floor] = (vacantByFloor[s.floor] || 0) + 1;
        }
      });
      let bestFloor = 1;
      let maxVacant = 0;
      Object.keys(vacantByFloor).forEach(f => {
        if (vacantByFloor[f] > maxVacant) {
          maxVacant = vacantByFloor[f];
          bestFloor = parseInt(f);
        }
      });

      setRecommendation({
        floor: bestFloor,
        block: 'A',
        reason: `Suggested Floor ${bestFloor} because it currently has the highest general availability (${maxVacant} open seats).`,
        teamCount: 0,
        availableCount: maxVacant
      });
      return;
    }

    // Has project, find co-location spots
    const teamSeats = seatsData.filter(
      s => s.employee && s.employee.project && s.employee.project === emp.project.name
    );

    if (teamSeats.length === 0) {
      // Project is active but has no seats allocated yet. Recommend floor 1.
      setRecommendation({
        floor: 1,
        block: 'A',
        reason: `Project ${emp.project.name} has no seated members yet. Floor 1 Block A is suggested as the starting project cluster.`,
        teamCount: 0,
        availableCount: seatsData.filter(s => s.floor === 1 && s.block === 'A' && s.status === 'Available').length
      });
      return;
    }

    // Group team seats by floor and block
    const counts = {};
    teamSeats.forEach(s => {
      const key = `${s.floor}-${s.block}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    // Find the floor/block with the maximum team members
    let bestKey = '';
    let maxTeam = 0;
    Object.keys(counts).forEach(k => {
      if (counts[k] > maxTeam) {
        maxTeam = counts[k];
        bestKey = k;
      }
    });

    const [floor, block] = bestKey.split('-');
    const floorInt = parseInt(floor);

    // Count available seats in that block
    const availableCount = seatsData.filter(
      s => s.floor === floorInt && s.block === block && s.status === 'Available'
    ).length;

    setRecommendation({
      floor: floorInt,
      block: block,
      reason: `Highly recommended: Cluster near project team. There are ${maxTeam} members of ${emp.project.name} sitting on Floor ${floor} Block ${block}. Assigning nearby boosts project synergy.`,
      teamCount: maxTeam,
      availableCount: availableCount
    });
  };
  const handleGoToAllocate = () => {
    if (!selectedEmp || !recommendation) return;
    onGoToAllocate(selectedEmp, {
      floor: recommendation.floor,
      block: recommendation.block,
      seat_number: `F${recommendation.floor}-${recommendation.block}`
    });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        name,
        email,
        role,
        join_date: joinDate,
        status: 'New Joiner',
        project_id: projectId ? parseInt(projectId) : null
      };
      await onAddEmployee(payload);
      setName('');
      setEmail('');
      setRole('');
      setProjectId('');
      setJoinDate(new Date().toISOString().substring(0, 10));
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to register new joiner.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const vacantSeats = seatsData.filter(s => s.status === 'Available').length;
  const newJoinersCount = unallocatedEmployees.length;
  const isBulkEnabled = newJoinersCount > 0 && vacantSeats > 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">New Joiner Seating Portal</h2>
          <p className="text-sm text-ethara-muted">Process onboarding unallocated new joiners and resolve seat bottlenecks using team clustering AI.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow shadow-blue-500/10 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Add New Joiner
          </button>
          <div className="p-2 bg-[#1C253C] rounded-xl border border-ethara-border hidden sm:block">
            <UserPlus className="h-5 w-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employee List (col-span-2) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-ethara-border flex flex-col justify-between min-h-[500px]">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ethara-border pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Pending Onboarding Queue ({unallocatedEmployees.length})</h3>
                <p className="text-[10px] text-ethara-muted font-medium mt-0.5">Vacant office seats available: {vacantSeats}</p>
              </div>

              {isBulkEnabled && (
                <button
                  type="button"
                  onClick={onBulkAutoAllocate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow shadow-blue-500/10 hover:shadow-lg disabled:opacity-50 select-none cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  {newJoinersCount <= vacantSeats 
                    ? `Bulk Auto-Allocate All (${newJoinersCount})` 
                    : `Fill Vacant Seats (${vacantSeats})`}
                </button>
              )}
            </div>

            {newJoinersCount > vacantSeats && vacantSeats > 0 && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-medium leading-normal">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Partial Allocation:</span> Pending new joiners ({newJoinersCount}) exceed vacant seats ({vacantSeats}). Clicking auto-allocate will fill all available seats, leaving {newJoinersCount - vacantSeats} in the queue.
                </div>
              </div>
            )}

            {vacantSeats === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] font-medium leading-normal animate-pulse">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">No Vacant Seats:</span> The office is at 100% capacity. Please release some seated employees first to run auto-allocation.
                </div>
              </div>
            )}

            <div className="divide-y divide-ethara-border overflow-y-auto max-h-[380px] pr-2 space-y-1.5">
              {loading ? (
                <div className="py-20 text-center text-ethara-muted flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  <span>Loading onboarding queue...</span>
                </div>
              ) : unallocatedEmployees.length > 0 ? (
                unallocatedEmployees.map((emp) => {
                  const isSelected = selectedEmpId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                        isSelected 
                          ? 'bg-blue-600/10 border-blue-500 text-white shadow-md' 
                          : 'bg-[#161D30]/40 border-ethara-border hover:bg-[#1C253C] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-[#1C253C] border border-ethara-border text-blue-400'
                        }`}>
                          {emp.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">{emp.name}</h4>
                          <p className="text-xs text-ethara-muted font-medium">{emp.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        {emp.project ? (
                          <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {emp.project.code}
                          </span>
                        ) : (
                          <span className="text-[10px] text-ethara-muted font-semibold bg-gray-700/30 px-2 py-0.5 rounded">No Project</span>
                        )}
                        <span className="text-[10px] text-ethara-muted flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          {emp.join_date}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-20 text-center text-ethara-muted flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="h-10 w-10 text-emerald-400" />
                  <span className="font-bold text-white text-sm">Onboarding Queue Clear</span>
                  <p className="text-xs max-w-sm">All new joiners and active employees are currently assigned to physical seat layouts.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Smart Allocation Guide */}
        <div className="glass-panel rounded-2xl border border-ethara-border p-6 flex flex-col justify-between h-fit min-h-[500px]">
          {selectedEmp && recommendation ? (
            <div className="space-y-6 flex flex-col h-full justify-between">
              <div className="space-y-5">
                {/* Heading */}
                <div className="border-b border-ethara-border pb-4">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" />
                    Allocation Analyzer
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">Seating Guide: {selectedEmp.name}</h3>
                </div>

                {/* Info Card */}
                <div className="bg-[#0E1321] rounded-xl p-4 border border-ethara-border space-y-3.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <div>
                      <span className="text-ethara-muted block text-[10px]">Project Assignment</span>
                      <span className="font-bold text-white">{selectedEmp.project ? selectedEmp.project.name : 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <div>
                      <span className="text-ethara-muted block text-[10px]">Date of Onboarding</span>
                      <span className="font-semibold text-gray-200">{selectedEmp.join_date}</span>
                    </div>
                  </div>
                </div>

                {/* Analyzer Output */}
                <div className="p-4 bg-gradient-to-tr from-blue-600/10 to-indigo-600/5 border border-blue-500/25 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-white">
                    <span>Target Destination:</span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">Floor {recommendation.floor} Block {recommendation.block}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-300">
                    {recommendation.reason}
                  </p>
                  <div className="flex justify-between text-[11px] pt-2 border-t border-ethara-border/50 text-ethara-muted font-semibold">
                    <span>Vacant seats in block:</span>
                    <span className="text-emerald-400">{recommendation.availableCount} available</span>
                  </div>
                </div>
              </div>

              {/* Action Trigger */}
              <button
                onClick={handleGoToAllocate}
                disabled={recommendation.availableCount === 0}
                className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Navigation className="h-4 w-4" />
                Go to Layout & Allocate Seat
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-ethara-muted space-y-3 h-full">
              <div className="p-4 bg-[#161D30] rounded-full border border-ethara-border">
                <Award className="h-8 w-8 text-ethara-muted" />
              </div>
              <div>
                <h4 className="font-bold text-gray-300">Analyzer Offline</h4>
                <p className="text-xs max-w-[200px] mx-auto mt-1">Select an unallocated new joiner from the queue to run clustering recomendations.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Add New Joiner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-ethara-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ethara-border pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Add New Joiner</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-[#1C253C] rounded-lg text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-ethara-muted uppercase tracking-wider mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-ethara-muted uppercase tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john.doe@ethara.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-ethara-muted uppercase tracking-wider mb-2">Role / Designation</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-ethara-muted uppercase tracking-wider mb-2">Project Assignment</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white font-medium"
                >
                  <option value="">-- No Project Assignment --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ethara-muted uppercase tracking-wider mb-2">Join Date</label>
                <input
                  type="date"
                  required
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white font-medium font-mono"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 font-bold">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-ethara-border hover:bg-[#1C253C] rounded-xl text-gray-300 transition-all cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/15 cursor-pointer font-bold"
                >
                  {submitting ? 'Registering...' : 'Register Joiner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
