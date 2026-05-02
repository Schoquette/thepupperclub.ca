import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  LayoutDashboard, Calendar, ClipboardList, Users, PawPrint,
  MessageCircle, FileText, Receipt, Car, BarChart3,
  UserCog, Megaphone, Search, Menu, X, FolderOpen,
} from 'lucide-react';

const NAV = [
  { to: '/admin',                  label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/admin/calendar',         label: 'Calendar',   icon: Calendar },
  { to: '/admin/service-requests', label: 'Requests',   icon: ClipboardList },
  { to: '/admin/clients',          label: 'Clients',    icon: Users },
  { to: '/admin/dogs',             label: 'Dogs',       icon: PawPrint },
  { to: '/admin/inbox',            label: 'Messages',   icon: MessageCircle },
  { to: '/admin/report-cards',     label: 'Reports',    icon: FileText },
  { to: '/admin/documents',        label: 'Documents',  icon: FolderOpen },
  { to: '/admin/invoices',         label: 'Invoices',   icon: Receipt },
  { to: '/admin/time-mileage',     label: 'Time & km',  icon: Car },
  { to: '/admin/reports',          label: 'Export',      icon: BarChart3 },
  { to: '/admin/team',             label: 'Team',        icon: UserCog },
  { to: '/admin/broadcast',        label: 'Broadcast',   icon: Megaphone },
  { to: '/admin/audit-logs',       label: 'Audit Log',   icon: Search },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Poll for unread counts
  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard-counts'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
    refetchInterval: 10_000,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex flex-col items-center px-5 py-5 border-b border-cream">
        <img src="/logo.png" alt="The Pupper Club" className={`object-contain ${collapsed && !mobileOpen ? 'w-8 h-8' : 'w-28 h-auto'}`} />
        {(!collapsed || mobileOpen) && (
          <div className="text-xs text-taupe mt-1">Admin Portal</div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cream text-gold font-semibold'
                  : 'text-espresso hover:bg-cream'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            {(!collapsed || mobileOpen) && (
              <span className="flex-1">{label}</span>
            )}
            {(!collapsed || mobileOpen) && label === 'Messages' && (dashboard?.unread_messages || 0) > 0 && (
              <span className="rounded-full bg-gold text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {dashboard?.unread_messages}
              </span>
            )}
            {(!collapsed || mobileOpen) && label === 'Requests' && (dashboard?.pending_service_requests || 0) > 0 && (
              <span className="rounded-full bg-blue text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {dashboard?.pending_service_requests}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-cream">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-gold flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name.charAt(0)}
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-espresso truncate">{user?.name}</div>
              <button onClick={handleLogout} className="text-xs text-taupe hover:text-espresso">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-blue">
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-blue border-b border-blue/80 flex items-center justify-between px-4 py-3 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-white">
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo.png" alt="The Pupper Club" className="h-8 object-contain" />
        <div className="w-6" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} className="text-taupe hover:text-espresso">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col bg-white shadow-card transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
