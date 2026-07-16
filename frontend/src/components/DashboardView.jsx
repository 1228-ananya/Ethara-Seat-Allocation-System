import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, MapPin, Briefcase, RefreshCw, AlertCircle, ShieldAlert, ArrowRightLeft } from 'lucide-react';

export default function DashboardView({ summaryData, historyData, onRefresh }) {
  const [floorChartData, setFloorChartData] = useState([]);
  const [projectChartData, setProjectChartData] = useState([]);

  useEffect(() => {
    if (summaryData) {
      // Process Floor Data for Recharts
      const floors = Object.keys(summaryData.floor_utilization).map((floorName) => {
        const data = summaryData.floor_utilization[floorName];
        return {
          name: floorName,
          Occupied: data.occupied,
          Available: data.available,
          Maintenance: data.maintenance,
        };
      });
      setFloorChartData(floors.sort());

      // Process Project Data for Recharts
      const projects = Object.keys(summaryData.project_allocation).map((projName) => {
        const data = summaryData.project_allocation[projName];
        return {
          name: data.code || projName,
          fullName: projName,
          Allocated: data.allocated,
          Remote: data.total_members - data.allocated
        };
      });
      // Sort projects by total members, take top 8
      setProjectChartData(projects.sort((a, b) => (b.Allocated + b.Remote) - (a.Allocated + a.Remote)).slice(0, 8));
    }
  }, [summaryData]);

  if (!summaryData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ethara-muted gap-2">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <p>Loading dashboard metrics...</p>
      </div>
    );
  }

  // Curated premium color array for pie chart slices
  const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#374151'];

  const stats = [
    { name: 'Total Employees', value: summaryData.total_employees, subtext: `${summaryData.remote_employees} Remote | ${summaryData.new_joiners} New Joiners`, icon: Users, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    { name: 'Seat Utilization', value: `${summaryData.utilization_rate}%`, subtext: `${summaryData.allocated_seats} of ${summaryData.total_seats - summaryData.maintenance_seats} usable seats occupied`, icon: MapPin, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Active Projects', value: summaryData.total_projects, subtext: 'Spanning 6 corporate divisions', icon: Briefcase, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
    { name: 'Action Required', value: summaryData.new_joiners, subtext: 'New joiners waiting for seats', icon: AlertCircle, color: summaryData.new_joiners > 0 ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* View Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-ethara-muted">Live utilization metrics and seat allocations audit log.</p>
        </div>
        <button 
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-ethara-card border border-ethara-border hover:bg-[#1C253C] hover:border-blue-500/50 text-gray-200 transition-all duration-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-ethara-border flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ethara-muted uppercase tracking-wider">{stat.name}</span>
                <div className={`p-2 rounded-xl border ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white tracking-tight">{stat.value}</span>
                <p className="text-xs text-ethara-muted mt-1 truncate">{stat.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Utilization Bar Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-ethara-border flex flex-col">
          <h3 className="text-base font-bold text-white mb-4">Floor Occupancy Analysis</h3>
          <div className="h-80 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23304D" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" tickLine={false} />
                <YAxis stroke="#9CA3AF" tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161D30', borderColor: '#23304D', borderRadius: '8px', color: '#FFF' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="Occupied" fill="#3B82F6" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Available" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Maintenance" fill="#4B5563" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Co-location Share */}
        <div className="glass-panel rounded-2xl p-6 border border-ethara-border flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Top Projects Mapping</h3>
            <p className="text-xs text-ethara-muted mb-4">Seat allocation vs. remote members</p>
          </div>
          <div className="h-56 w-full text-xs relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="Allocated"
                >
                  {projectChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-ethara-card border border-ethara-border p-2.5 rounded-lg text-xs">
                          <p className="font-bold text-white">{data.fullName}</p>
                          <p className="text-blue-400">Allocated Seats: {data.Allocated}</p>
                          <p className="text-ethara-muted">Remote Members: {data.Remote}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-2xl font-extrabold text-white">{summaryData.allocated_seats}</span>
              <p className="text-[10px] text-ethara-muted uppercase font-semibold">Allocated</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] text-ethara-muted border-t border-ethara-border pt-4">
            {projectChartData.slice(0, 4).map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="font-semibold text-gray-300 truncate">{p.name}</span>
                <span>({p.Allocated})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl p-6 border border-ethara-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Seat Allocation History</h3>
            <p className="text-xs text-ethara-muted">Recent physical seat movements across corporate assets.</p>
          </div>
          <div className="p-2 bg-[#1C253C] rounded-xl border border-ethara-border">
            <ArrowRightLeft className="h-4 w-4 text-blue-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-ethara-muted border-b border-ethara-border uppercase font-semibold">
                <th className="pb-3 pl-2">Employee</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Seat Number</th>
                <th className="pb-3">Project Group</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3 text-right pr-2">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ethara-border text-gray-300 font-medium">
              {historyData && historyData.length > 0 ? (
                historyData.map((log) => (
                  <tr key={log.id} className="hover:bg-[#161D30]/40 transition-colors">
                    <td className="py-3 pl-2 font-semibold text-white">{log.employee_name}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        log.action === 'Allocate' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-blue-400">{log.seat_number || 'N/A'}</td>
                    <td className="py-3">{log.project_name || 'N/A'}</td>
                    <td className="py-3 text-ethara-muted">
                      {new Date(log.performed_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-right pr-2 font-mono text-ethara-muted">{log.performed_by}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-ethara-muted">
                    No recent allocation history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
