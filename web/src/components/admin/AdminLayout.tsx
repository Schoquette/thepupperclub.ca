import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const NAV = [
  { to: '/admin',                  label: 'Dashboard',  icon: '🏠', end: true },
  { to: '/admin/calendar',         label: 'Calendar',   icon: '📅' },
  { to: '/admin/service-requests', label: 'Requests',   icon: '📋' },
  { to: '/admin/clients',          label: 'Clients',    icon: '👥' },
  { to: '/admin/inbox',            label: 'Messages',   icon: '💬' },
  { to: '/admin/report-cards',     label: 'Reports',    icon: '📝' },
  { to: '/admin/invoices',         label: 'Invoices',   icon: '💰' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-white shadow-card transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-cream">
          <span className="text-2xl">🐾</span>
          {!collapsed && (
            <div>
              <div className="font-display text-espresso text-sm tracking-wide">THE PUPPER CLUB</div>
              <div className="text-xs text-taupe">Admin Portal</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cream text-gold font-semibold'
                    : 'text-espresso hover:bg-cream'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {!collapsed && (
                <span className="flex-1">{label}</span>
              )}
              {!collapsed && label === 'Messages' && (dashboard?.unread_messages || 0) > 0 && (
                <span className="rounded-full bg-gold text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {dashboard?.unread_messages}
                </span>
              )}
              {!collapsed && label === 'Requests' && (dashboard?.pending_service_requests || 0) > 0 && (
                <span className="rounded-full bg-blue text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {dashboard?.pending_service_requests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-cream">
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
            <div className="h-8 w-8 rounded-full bg-gold flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-espresso truncate">{user?.name}</div>
                <button onClick={handleLogout} className="text-xs text-taupe hover:text-espresso">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
