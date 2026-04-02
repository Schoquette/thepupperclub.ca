import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const NAV = [
  { to: '/client',               label: 'Home',     icon: '🏠', end: true },
  { to: '/client/appointments',  label: 'Walks',    icon: '🐕' },
  { to: '/client/messages',      label: 'Messages', icon: '💬' },
  { to: '/client/report-cards',  label: 'Reports',  icon: '📝' },
  { to: '/client/invoices',      label: 'Billing',  icon: '💳' },
  { to: '/client/dogs',          label: 'My Dogs',  icon: '🐾' },
  { to: '/client/documents',     label: 'Documents', icon: '📄' },
  { to: '/client/profile',       label: 'Profile',  icon: '👤' },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Poll for unread message count
  const { data: thread } = useQuery({
    queryKey: ['client-unread', user?.id],
    queryFn: () =>
      api.get(`/conversations/${user?.id}`).then(r => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  const unread = thread?.unread_count_client ?? 0;

  return (
    <div className="flex flex-col h-screen bg-cream">
      {/* Header */}
      <header className="bg-espresso px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="font-display text-cream text-lg tracking-wide">THE PUPPER CLUB</div>
        <button
          onClick={async () => { await logout(); navigate('/login'); }}
          className="text-taupe hover:text-cream text-sm transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-cream px-2 pb-safe">
        <div className="flex justify-around">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors relative ${
                  isActive ? 'text-gold' : 'text-taupe'
                }`
              }
            >
              <span className="text-lg relative">
                {icon}
                {label === 'Messages' && unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gold text-white text-[9px] flex items-center justify-center font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
