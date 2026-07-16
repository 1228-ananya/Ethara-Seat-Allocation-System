import React, { useState, useEffect } from 'react';
import { Search, Plus, ArrowLeft, ArrowRight, UserPlus, Filter, X } from 'lucide-react';

export default function EmployeesView({ 
  projects, 
  onAddEmployee, 
  onFetchEmployees,
  employeesResponse 
}) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newJoinDate, setNewJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [newProjId, setNewProjId] = useState('');
  const [newStatus, setNewStatus] = useState('New Joiner');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch employees when search, project, status, or page changes
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      await onFetchEmployees(page, search, selectedProject, selectedStatus);
      setLoading(false);
    };
    fetch();
  }, [page, search, selectedProject, selectedStatus]);

  // Reset page to 1 when filters change
  const handleFilterChange = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const empData = {
        name: newName,
        email: newEmail,
        role: newRole,
        join_date: newJoinDate,
        status: newStatus,
        project_id: newProjId ? parseInt(newProjId) : null
      };
      await onAddEmployee(empData);
      // Reset form
      setNewName('');
      setNewEmail('');
      setNewRole('');
      setNewProjId('');
      setNewStatus('New Joiner');
      setShowAddModal(false);
      // Re-fetch current page
      onFetchEmployees(page, search, selectedProject, selectedStatus);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create employee. Make sure email is unique.');
    } finally {
      setSubmitting(false);
    }
  };

  const results = employeesResponse?.results || [];
  const total = employeesResponse?.total || 0;
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Directory Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Employee Registry</h2>
          <p className="text-sm text-ethara-muted">View roles, projects, and seating details for the entire workforce ({total} total).</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/15"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-ethara-card p-4 rounded-2xl border border-ethara-border">
        {/* Search */}
        <div className="relative md:col-span-2">
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            className="w-full px-3 py-2.5 pl-9 text-xs bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-ethara-muted" />
        </div>

        {/* Project Selector */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => handleFilterChange(setSelectedProject, e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white appearance-none cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Filter className="absolute right-3 top-3.5 h-3.5 w-3.5 text-ethara-muted pointer-events-none" />
        </div>

        {/* Status Selector */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active (Seated)</option>
            <option value="New Joiner">New Joiner</option>
            <option value="Remote">Remote</option>
            <option value="Resigned">Resigned</option>
          </select>
          <Filter className="absolute right-3 top-3.5 h-3.5 w-3.5 text-ethara-muted pointer-events-none" />
        </div>
      </div>

      {/* Directory Table */}
      <div className="glass-panel rounded-2xl border border-ethara-border overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-ethara-muted flex flex-col items-center justify-center gap-2">
            <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent animate-spin rounded-full"></div>
            <span>Fetching registry records...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-ethara-muted border-b border-ethara-border uppercase font-semibold bg-[#1C253C]/20">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3">Email Address</th>
                  <th className="py-3">Role / Title</th>
                  <th className="py-3">Project Group</th>
                  <th className="py-3">Seat</th>
                  <th className="py-3">Join Date</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ethara-border text-gray-300 font-medium">
                {results.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#161D30]/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{emp.name}</td>
                    <td className="py-3 font-mono">{emp.email}</td>
                    <td className="py-3 text-blue-400">{emp.role}</td>
                    <td className="py-3 font-semibold text-gray-200">
                      {emp.project ? (
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/10">
                          {emp.project.name}
                        </span>
                      ) : (
                        <span className="text-ethara-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 font-mono font-bold text-emerald-400">
                      {emp.seat ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {emp.seat.seat_number}
                        </span>
                      ) : (
                        <span className="text-ethara-muted">None</span>
                      )}
                    </td>
                    <td className="py-3 text-ethara-muted">{emp.join_date}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        emp.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        emp.status === 'New Joiner' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        emp.status === 'Remote' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center text-ethara-muted">
            No employee directory matches found.
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-ethara-border bg-[#0E1321]/30">
            <span className="text-xs text-ethara-muted font-semibold">
              Showing <span className="text-white">{(page - 1) * limit + 1}</span> - <span className="text-white">{Math.min(page * limit, total)}</span> of <span className="text-white">{total}</span> records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-2 border border-ethara-border hover:bg-[#1C253C] text-gray-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 border border-ethara-border hover:bg-[#1C253C] text-gray-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Employee Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ethara-card border border-ethara-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white hover:bg-[#1C253C] p-1.5 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-3 border-b border-ethara-border pb-4 mb-5">
              <div className="p-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Register Employee</h3>
                <p className="text-[10px] text-ethara-muted">Create a new profile card in the company directory.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-ethara-muted mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                />
              </div>

              <div>
                <label className="block text-ethara-muted mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.j@ethara.ae"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                />
              </div>

              <div>
                <label className="block text-ethara-muted mb-1.5">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Developer"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-ethara-muted mb-1.5">Join Date</label>
                  <input
                    type="date"
                    required
                    value={newJoinDate}
                    onChange={(e) => setNewJoinDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>

                <div>
                  <label className="block text-ethara-muted mb-1.5">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="New Joiner">New Joiner</option>
                    <option value="Active">Active</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ethara-muted mb-1.5">Project Mapping</label>
                <select
                  value={newProjId}
                  onChange={(e) => setNewProjId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="">No Project Mapping</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/15 disabled:bg-gray-700"
              >
                {submitting ? 'Registering...' : 'Register Employee'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
