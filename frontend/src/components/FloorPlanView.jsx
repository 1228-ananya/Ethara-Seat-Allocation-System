import React, { useState, useEffect } from 'react';
import { ShieldAlert, User, Search, RefreshCw, UserCheck, X, Award, MapPin } from 'lucide-react';

export default function FloorPlanView({ 
  seatsData, 
  unallocatedEmployees, 
  onAllocate, 
  onRelease, 
  onBulkRelease,
  onToggleMaintenance,
  onRefresh, 
  loading,
  selectedSeatFromQuery, // support external highlights
  selectedEmployeeFromNewJoiners // support linking from New Joiner portal
}) {
  const [activeFloor, setActiveFloor] = useState(1);
  const [activeBlock, setActiveBlock] = useState('A');
  const [selectedSeat, setSelectedSeat] = useState(null);
  
  // Search query inside employee allocation dropdown
  const [empSearch, setEmpSearch] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState('single'); // 'single' | 'bulk'
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  // Auto-focus seat if passed from AI query or external view
  useEffect(() => {
    if (selectedSeatFromQuery) {
      setActiveFloor(selectedSeatFromQuery.floor);
      setActiveBlock(selectedSeatFromQuery.block);
      
      // Find seat object in seatsData
      const foundSeat = seatsData.find(s => s.seat_number === selectedSeatFromQuery.seat_number);
      if (foundSeat) {
        setSelectedSeat(foundSeat);
      }
    }
  }, [selectedSeatFromQuery, seatsData]);

  // Set default target employee if passed from New Joiner wizard
  useEffect(() => {
    if (selectedEmployeeFromNewJoiners) {
      setTargetEmployeeId(selectedEmployeeFromNewJoiners.id);
    }
  }, [selectedEmployeeFromNewJoiners]);

  // Sync selectedSeat details when seatsData changes (e.g. after release or allocate)
  useEffect(() => {
    if (selectedSeat) {
      const freshSeat = seatsData.find(s => s.id === selectedSeat.id);
      if (freshSeat) {
        setSelectedSeat(freshSeat);
      }
    }
  }, [seatsData]);

  // Filter seats based on current floor and block
  const filteredSeats = seatsData
    .filter((s) => s.floor === activeFloor && s.block === activeBlock)
    .sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true, sensitivity: 'base' }));

  // Recommendation logic: If we have selected a target employee, check if they have team members.
  // We want to highlight seats on blocks where their project members are sitting.
  const [recommendedBlocks, setRecommendedBlocks] = useState([]);
  const [recommendedFloors, setRecommendedFloors] = useState([]);
  
  useEffect(() => {
    if (targetEmployeeId && unallocatedEmployees) {
      const emp = unallocatedEmployees.find(e => e.id === parseInt(targetEmployeeId));
      if (emp && emp.project) {
        // Let's call the recommend algorithm: find where members sit
        // In local state, we can scan all seats occupied by team members
        const projectTeamSeats = seatsData.filter(
          s => s.employee && s.employee.project && s.employee.project === emp.project.name
        );
        
        if (projectTeamSeats.length > 0) {
          const floors = [...new Set(projectTeamSeats.map(s => s.floor))];
          const blocks = [...new Set(projectTeamSeats.map(s => s.block))];
          setRecommendedFloors(floors);
          setRecommendedBlocks(blocks);
        } else {
          // If no team members have seats, recommend floors with most available seats
          setRecommendedFloors([2, 3]); // fallback
          setRecommendedBlocks(['A', 'B']);
        }
      } else {
        setRecommendedFloors([]);
        setRecommendedBlocks([]);
      }
    } else {
      setRecommendedFloors([]);
      setRecommendedBlocks([]);
    }
  }, [targetEmployeeId, unallocatedEmployees, seatsData]);

  // Filter unallocated employees in dropdown based on search
  const filteredEmployeesList = unallocatedEmployees
    ? unallocatedEmployees.filter(
        (e) => 
          e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
          e.role.toLowerCase().includes(empSearch.toLowerCase()) ||
          (e.project && e.project.name.toLowerCase().includes(empSearch.toLowerCase()))
      )
    : [];

  const handleSeatClick = (seat) => {
    if (isMultiSelectMode) {
      if (seat.status !== 'Occupied') return;
      setSelectedSeatIds(prev => 
        prev.includes(seat.id)
          ? prev.filter(id => id !== seat.id)
          : [...prev, seat.id]
      );
    } else {
      setSelectedSeat(seat);
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeat || !targetEmployeeId) return;
    setAllocating(true);
    try {
      await onAllocate(parseInt(targetEmployeeId), selectedSeat.id);
      // Reset state and select the newly allocated seat to show update
      const updatedSeat = { 
        ...selectedSeat, 
        status: 'Occupied', 
        employee: unallocatedEmployees.find(e => e.id === parseInt(targetEmployeeId)) 
      };
      setSelectedSeat(updatedSeat);
      setTargetEmployeeId('');
      setEmpSearch('');
    } catch (err) {
      console.error(err);
    } finally {
      setAllocating(false);
    }
  };

  const handleReleaseClick = () => {
    setConfirmModalType('single');
    setShowReleaseConfirm(true);
  };

  const handleBulkReleaseClick = () => {
    setConfirmModalType('bulk');
    setShowReleaseConfirm(true);
  };

  const handleReleaseConfirm = async () => {
    if (confirmModalType === 'bulk') {
      await handleBulkReleaseConfirm();
      return;
    }
    if (confirmModalType === 'maintenance') {
      await handleMaintenanceConfirm('maintenance');
      return;
    }
    if (!selectedSeat) return;
    setShowReleaseConfirm(false);
    setAllocating(true);
    try {
      await onRelease(selectedSeat.id);
      const updatedSeat = { ...selectedSeat, status: 'Available', employee: null };
      setSelectedSeat(updatedSeat);
    } catch (err) {
      console.error(err);
    } finally {
      setAllocating(false);
    }
  };

  const handleMaintenanceClick = () => {
    if (!selectedSeat) return;
    if (selectedSeat.status === 'Occupied') {
      setConfirmModalType('maintenance');
      setShowReleaseConfirm(true);
    } else {
      const action = selectedSeat.status === 'Maintenance' ? 'resolve' : 'maintenance';
      handleMaintenanceConfirm(action);
    }
  };

  const handleMaintenanceConfirm = async (action = 'maintenance') => {
    if (!selectedSeat) return;
    setShowReleaseConfirm(false);
    setAllocating(true);
    try {
      await onToggleMaintenance(selectedSeat.id, action);
      const targetStatus = action === 'resolve' ? 'Available' : 'Maintenance';
      const updatedSeat = { ...selectedSeat, status: targetStatus, employee: null };
      setSelectedSeat(updatedSeat);
    } catch (err) {
      console.error(err);
    } finally {
      setAllocating(false);
    }
  };

  const handleBulkReleaseConfirm = async () => {
    const selectedSeats = seatsData.filter(s => selectedSeatIds.includes(s.id));
    const occupiedSeats = selectedSeats.filter(s => s.status === 'Occupied');
    const occupiedIds = occupiedSeats.map(s => s.id);
    if (occupiedIds.length === 0) return;
    
    setShowReleaseConfirm(false);
    setAllocating(true);
    try {
      await onBulkRelease(occupiedIds);
      setSelectedSeatIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setAllocating(false);
    }
  };

  // Organize seats in grid rows (10 rows, 15 columns for 150 seats)
  const rows = [];
  const colsCount = 15;
  const rowsCount = 10;
  for (let r = 0; r < rowsCount; r++) {
    const rowSeats = filteredSeats.slice(r * colsCount, (r + 1) * colsCount);
    // Sort seats numerically in the row, e.g., F1-A001 to F1-A015
    rowSeats.sort((a, b) => a.seat_number.localeCompare(b.seat_number));
    rows.push(rowSeats);
  }

  // Check if a seat is recommended based on team co-location
  const isRecommendedSeat = (seat) => {
    return (
      targetEmployeeId && 
      seat.status === 'Available' && 
      recommendedFloors.includes(seat.floor) && 
      recommendedBlocks.includes(seat.block)
    );
  };

  return (
    <div className="space-y-6">
      {/* Floor and Block Navigation Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Office Layout</h2>
          <p className="text-sm text-ethara-muted">Select floors and zones to inspect seat occupants, map resources, and coordinate seating allocations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onRefresh}
            disabled={loading}
            className="p-2 bg-ethara-card border border-ethara-border hover:bg-[#1C253C] rounded-xl text-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-ethara-card p-4 rounded-2xl border border-ethara-border">
        {/* Floor Selection */}
        <div className="flex items-center gap-1 bg-[#0B0F19] p-1 rounded-xl border border-ethara-border">
          {[1, 2, 3, 4, 5].map((fl) => (
            <button
              key={fl}
              onClick={() => { setActiveFloor(fl); setSelectedSeat(null); }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeFloor === fl 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Floor {fl}
            </button>
          ))}
        </div>

        {/* Block Selection */}
        <div className="flex items-center gap-1 bg-[#0B0F19] p-1 rounded-xl border border-ethara-border">
          {['A', 'B', 'C', 'D'].map((bl) => (
            <button
              key={bl}
              onClick={() => { setActiveBlock(bl); setSelectedSeat(null); }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeBlock === bl 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Block {bl}
            </button>
          ))}
        </div>

        {/* Legend Indicator */}
        <div className="flex items-center gap-4 text-xs font-semibold text-ethara-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500 shadow shadow-emerald-500/20"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-500 shadow shadow-red-500/20"></span>
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-gray-600"></span>
            <span>Maintenance</span>
          </div>
          {targetEmployeeId && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-blue-500 animate-pulse border-2 border-white"></span>
              <span className="text-blue-400">Team Zone (Recommended)</span>
            </div>
          )}
        </div>

        {/* Multi-Select Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none bg-[#0B0F19] px-3.5 py-2 rounded-xl border border-ethara-border hover:border-blue-500/30 transition-all">
            <input
              type="checkbox"
              checked={isMultiSelectMode}
              onChange={(e) => {
                setIsMultiSelectMode(e.target.checked);
                setSelectedSeatIds([]);
                setSelectedSeat(null);
              }}
              className="rounded border-ethara-border text-blue-600 focus:ring-blue-500 bg-[#161D30] h-4 w-4 cursor-pointer"
            />
            <span>Bulk Selection Mode</span>
          </label>
        </div>
      </div>

      {/* Main Grid & Detail Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Seats Map Layout Grid */}
        <div className="xl:col-span-3 glass-panel rounded-2xl p-6 border border-ethara-border overflow-auto flex flex-col justify-center items-center min-h-[500px] relative">
          {loading && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0E1321]/90 border border-blue-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-400 z-10 shadow-lg shadow-black/40">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}

          <div className="space-y-3 min-w-[760px]">
            {rows.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-2 justify-center">
                {row.map((seat) => {
                  const isSelected = isMultiSelectMode 
                    ? selectedSeatIds.includes(seat.id) 
                    : selectedSeat && selectedSeat.id === seat.id;
                  const isRecommended = isRecommendedSeat(seat);
                  
                  let bgClass = 'bg-[#1F293D] hover:bg-[#2A374E] text-gray-400'; // fallback
                  if (seat.status === 'Available') {
                    bgClass = isRecommended 
                      ? 'bg-blue-600/40 text-blue-200 border-2 border-blue-400 animate-pulse' 
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20';
                  } else if (seat.status === 'Occupied') {
                    bgClass = 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20';
                  } else if (seat.status === 'Maintenance') {
                    bgClass = 'bg-[#181D29] hover:bg-[#202736] text-gray-500 cursor-pointer border border-dashed border-gray-700/65';
                  }

                  if (isSelected) {
                    bgClass += ' ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0B0F19] scale-105';
                  }

                  // Extract index number for grid label (e.g. 045 from F1-A045)
                  const label = seat.seat_number.split('-')[1].substring(1);

                  return (
                    <button
                      key={seat.id}
                      onClick={() => handleSeatClick(seat)}
                      title={`Seat: ${seat.seat_number} - Status: ${seat.status}`}
                      className={`h-9 w-11 rounded-lg flex flex-col items-center justify-center font-mono text-[10px] font-bold transition-all duration-150 relative shrink-0 ${bgClass}`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            
            {/* Layout Helper Indicator */}
            <div className="flex justify-between items-center text-[10px] text-ethara-muted uppercase font-bold pt-4 px-10 border-t border-ethara-border mt-6">
              <span>← Front Entrance / Reception</span>
              <span>Server Room / Elevators →</span>
            </div>
          </div>
        </div>

        {/* Allocation Detail Side Panel */}
        <div className="glass-panel rounded-2xl border border-ethara-border p-6 h-fit min-h-[500px]">
          {isMultiSelectMode ? (
            <div className="space-y-6">
              {/* Bulk Header */}
              <div className="flex items-center justify-between border-b border-ethara-border pb-4">
                <div>
                  <span className="text-[10px] text-ethara-muted font-bold uppercase tracking-wider">Bulk Actions</span>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-blue-500" />
                    Bulk Selection
                  </h3>
                </div>
                {selectedSeatIds.length > 0 && (
                  <button 
                    onClick={() => setSelectedSeatIds([])}
                    className="text-[10px] text-red-400 hover:text-red-300 font-semibold transition-all cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Status and Action Panel */}
              <div className="space-y-5">
                <div className="bg-[#0E1321] rounded-xl p-4 border border-ethara-border text-center space-y-4">
                  <div className="h-16 w-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xl mx-auto">
                    {selectedSeatIds.length}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Seats Selected</h4>
                    <p className="text-xs text-ethara-muted font-medium mt-1">
                      Click occupied seats (red) in the map to select or deselect them for bulk release.
                    </p>
                  </div>
                  
                  {selectedSeatIds.length > 0 && (
                    <div className="pt-3 border-t border-ethara-border text-left space-y-1.5 text-xs">
                      <p className="text-gray-300 font-semibold">Selected seats to release:</p>
                      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {seatsData.filter(s => selectedSeatIds.includes(s.id)).map(s => (
                          <span key={s.id} className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                            {s.seat_number}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedSeatIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleBulkReleaseClick}
                    disabled={allocating}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/15 disabled:opacity-50 select-none cursor-pointer"
                  >
                    Release {selectedSeatIds.length} Occupant(s)
                  </button>
                ) : (
                  <div className="text-center py-6 text-ethara-muted text-xs font-medium">
                    No seats selected.
                  </div>
                )}
              </div>
            </div>
          ) : selectedSeat ? (
            <div className="space-y-6">
              {/* Seat Header */}
              <div className="flex items-center justify-between border-b border-ethara-border pb-4">
                <div>
                  <span className="text-[10px] text-ethara-muted font-bold uppercase tracking-wider">Asset Details</span>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    {selectedSeat.seat_number}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedSeat(null)}
                  className="p-1.5 hover:bg-[#1C253C] rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Occupancy Info */}
              {selectedSeat.status === 'Occupied' && selectedSeat.employee ? (
                <div className="space-y-5">
                  {/* User Profile Card */}
                  <div className="bg-[#0E1321] rounded-xl p-4 border border-ethara-border text-center space-y-3">
                    <div className="h-16 w-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xl mx-auto">
                      {selectedSeat.employee.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">{selectedSeat.employee.name}</h4>
                      <p className="text-xs text-blue-400 font-medium">{selectedSeat.employee.role}</p>
                    </div>
                    <div className="pt-2 border-t border-ethara-border text-left space-y-1.5 text-xs">
                      <p className="text-ethara-muted truncate"><span className="font-semibold text-gray-300">Email:</span> {selectedSeat.employee.email}</p>
                      <p className="text-ethara-muted"><span className="font-semibold text-gray-300">Project:</span> {selectedSeat.employee.project ? (typeof selectedSeat.employee.project === 'object' ? selectedSeat.employee.project.name : selectedSeat.employee.project) : 'No Project Assigned'}</p>
                      <p className="text-ethara-muted"><span className="font-semibold text-gray-300">Join Date:</span> {selectedSeat.employee.join_date}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={handleReleaseClick}
                      disabled={allocating}
                      className="w-full py-2.5 bg-red-600/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      {allocating ? 'Processing...' : 'Release Occupant'}
                    </button>
                    <button
                      onClick={handleMaintenanceClick}
                      disabled={allocating}
                      className="w-full py-2.5 bg-amber-600/10 border border-amber-500/20 hover:bg-amber-600 hover:text-white text-amber-400 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer animate-pulse"
                    >
                      Put in Maintenance
                    </button>
                  </div>
                </div>
              ) : selectedSeat.status === 'Maintenance' ? (
                <div className="space-y-4">
                  <div className="bg-[#0E1321] rounded-xl p-4 border border-amber-500/20 border-dashed text-center text-xs space-y-3 py-6">
                    <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-400">Under Maintenance</h4>
                      <p className="text-ethara-muted mt-1 leading-relaxed text-[11px]">This station is flagged for hardware or facility repairs and cannot accept allocations.</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleMaintenanceClick}
                    disabled={allocating}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                  >
                    {allocating ? 'Processing...' : 'Resolve & Make Available'}
                  </button>
                </div>
              ) : (
                // Vacant seat allocation form
                <div className="space-y-4">
                  <div className="bg-[#0E1321] rounded-xl p-4 border border-emerald-500/20 border-dashed text-center text-xs space-y-3 py-5">
                    <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-400">Available Seat</h4>
                      <p className="text-[10px] text-ethara-muted mt-0.5">No employee is currently mapped to this station.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleMaintenanceClick}
                      disabled={allocating}
                      className="px-3 py-1.5 bg-amber-600/10 hover:bg-amber-600 hover:text-white border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Put in Maintenance
                    </button>
                  </div>

                  <form onSubmit={handleAllocateSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-ethara-muted uppercase tracking-wider mb-2">Allocate Employee</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search unallocated..."
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          className="w-full px-3 py-2 pl-8 text-xs bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                        />
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ethara-muted" />
                      </div>
                    </div>

                    <select
                      value={targetEmployeeId}
                      onChange={(e) => setTargetEmployeeId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-[#0E1321] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                    >
                      <option value="">-- Select Employee --</option>
                      {filteredEmployeesList.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.role}) {e.project ? `[${e.project.code}]` : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      disabled={allocating || !targetEmployeeId}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/15"
                    >
                      {allocating ? 'Allocating...' : 'Assign Selected Employee'}
                    </button>
                  </form>
                  
                  {/* Co-location Recommendation info */}
                  {targetEmployeeId && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-400 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Award className="h-4 w-4 shrink-0" />
                        <span>Smart Seating Guide</span>
                      </div>
                      <p>Team members for this project sit on floors highlighted in blue. Mapping this candidate nearby boosts integration.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-ethara-muted space-y-3 h-full">
              <div className="p-4 bg-[#161D30] rounded-full border border-ethara-border">
                <User className="h-8 w-8 text-ethara-muted" />
              </div>
              <div>
                <h4 className="font-bold text-gray-300">No Seat Selected</h4>
                <p className="text-xs max-w-[200px] mx-auto mt-1">Click any active seat station in the grid plan to manage occupancy details.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ethara-card border border-ethara-border rounded-2xl w-full max-w-sm p-6 relative shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-ethara-border pb-3">
              <div className="p-2 bg-red-600/10 border border-red-500/20 text-red-400 rounded-xl">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {confirmModalType === 'maintenance' ? 'Put Seat in Maintenance?' : confirmModalType === 'bulk' ? `Release ${selectedSeatIds.length} Occupants?` : 'Release Occupant?'}
                </h3>
                <p className="text-[10px] text-ethara-muted">Confirm seat status modification.</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-semibold">
              {confirmModalType === 'maintenance' && selectedSeat ? (
                <span>
                  Putting seat <span className="font-mono font-bold text-amber-400">{selectedSeat.seat_number}</span> into maintenance will automatically release occupant <span className="font-bold text-white">{selectedSeat.employee?.name || 'Anya Varma'}</span>. Are you sure you want to proceed?
                </span>
              ) : confirmModalType === 'bulk' ? (
                `Are you sure you want to release the occupants from all ${selectedSeatIds.length} selected seats? This action is immediate and will log seat release records.`
              ) : selectedSeat ? (
                <span>
                  Are you sure you want to release the occupant from seat <span className="font-mono font-bold text-blue-400">{selectedSeat.seat_number}</span>? This action is immediate and will log a seat release log.
                </span>
              ) : (
                'Are you sure you want to proceed with the action?'
              )}
            </p>

            <div className="flex gap-3 justify-end pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowReleaseConfirm(false)}
                className="px-4 py-2 border border-ethara-border hover:bg-[#1C253C] rounded-xl text-gray-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReleaseConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-lg shadow-red-500/15 cursor-pointer"
              >
                Confirm Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
