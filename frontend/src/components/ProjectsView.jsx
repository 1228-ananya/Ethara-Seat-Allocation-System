import React, { useState } from 'react';
import { Search, FolderKanban, Shield, User, Landmark, Users } from 'lucide-react';

export default function ProjectsView({ projects, summaryData }) {
  const [search, setSearch] = useState('');

  const filteredProjects = projects.filter(
    (p) => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase()) ||
      p.manager_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Directory Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Project Maps</h2>
          <p className="text-sm text-ethara-muted">Browse cross-functional workgroups and co-location metrics across floors.</p>
        </div>
        <div className="p-2 bg-[#1C253C] rounded-xl border border-ethara-border">
          <FolderKanban className="h-5 w-5 text-blue-400" />
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative bg-ethara-card p-4 rounded-2xl border border-ethara-border">
        <input
          type="text"
          placeholder="Filter projects by name, code, lead manager, or division..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 pl-9 text-xs bg-[#0B0F19] border border-ethara-border rounded-xl focus:outline-none focus:border-blue-500 text-white"
        />
        <Search className="absolute left-7 top-7 h-4 w-4 text-ethara-muted" />
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((p) => {
            const allocationMetrics = summaryData?.project_allocation[p.name] || {
              allocated: 0,
              total_members: 0,
            };

            const physicalAllocated = allocationMetrics.allocated;
            const totalMembers = allocationMetrics.total_members;
            const remoteMembers = totalMembers - physicalAllocated;
            const utilizationRate = totalMembers > 0 
              ? Math.round((physicalAllocated / totalMembers) * 100) 
              : 0;

            return (
              <div key={p.id} className="glass-panel rounded-2xl p-5 border border-ethara-border flex flex-col justify-between h-64 hover:border-blue-500/40 transition-all duration-300">
                {/* Project Header */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1C253C] text-blue-400 border border-ethara-border">
                      {p.code}
                    </span>
                    <span className="text-[10px] text-ethara-muted uppercase font-bold tracking-wider">
                      {p.department}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base truncate pt-1">{p.name}</h3>
                  <p className="text-[11px] text-ethara-muted line-clamp-2 mt-1">{p.description}</p>
                </div>

                {/* Manager & Department Details */}
                <div className="grid grid-cols-2 gap-2 py-3 border-t border-b border-ethara-border/50 text-[11px] text-gray-300">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="h-3.5 w-3.5 text-ethara-muted shrink-0" />
                    <span className="truncate">{p.manager_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate justify-end">
                    <Landmark className="h-3.5 w-3.5 text-ethara-muted shrink-0" />
                    <span className="truncate">{p.department}</span>
                  </div>
                </div>

                {/* Utilization & Members Count */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-white">{totalMembers}</span>
                      <span className="text-ethara-muted">Members</span>
                    </div>
                    <span className="text-emerald-400">{utilizationRate}% Allocated</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#0B0F19] h-2 rounded-full overflow-hidden border border-ethara-border">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${utilizationRate}%` }}
                    ></div>
                  </div>

                  {/* Breakdown */}
                  <div className="flex justify-between items-center text-[10px] text-ethara-muted pt-1">
                    <span>{physicalAllocated} Mapped Seats</span>
                    <span>{remoteMembers} Remote / Queue</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center text-ethara-muted glass-panel rounded-2xl border border-ethara-border">
            No projects found matching the search query.
          </div>
        )}
      </div>
    </div>
  );
}
