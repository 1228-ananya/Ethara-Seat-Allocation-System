import React from 'react';
import { LayoutDashboard, Map, Users, FolderKanban, UserPlus, MessageSquare } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, unallocatedCount }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'floorplan', name: 'Interactive Floor Map', icon: Map },
    { id: 'employees', name: 'Employee Directory', icon: Users },
    { id: 'projects', name: 'Project Mapping', icon: FolderKanban },
    { 
      id: 'newjoiners', 
      name: 'New Joiners Allocation', 
      icon: UserPlus, 
      badge: unallocatedCount > 0 ? unallocatedCount : null 
    },
    { id: 'aichat', name: 'AI Assistant', icon: MessageSquare }
  ];

  return (
    <aside className="w-64 bg-ethara-card border-r border-ethara-border flex flex-col h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="h-16 flex items-center px-6 border-b border-ethara-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-white text-lg">E</span>
          </div>
          <div>
            <h1 className="font-bold text-base bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Ethara</h1>
            <p className="text-[10px] text-ethara-muted font-medium uppercase tracking-wider">Seat Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-400 hover:bg-[#1C253C] hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge !== null && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  isActive ? 'bg-white text-blue-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-ethara-border bg-[#0E1321]/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#1C253C] border border-ethara-border flex items-center justify-center font-bold text-blue-400">
            AD
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate text-gray-200">System Admin</p>
            <p className="text-[11px] text-ethara-muted truncate">admin@ethara.ae</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
