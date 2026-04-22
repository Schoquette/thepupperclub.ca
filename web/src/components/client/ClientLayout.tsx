import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Home, Calendar, MessageCircle, ClipboardList,
  CreditCard, FileText, User, Menu, X,
} from 'lucide-react';
import { PawIcon } from '@/components/ui/PawIcon';

const NAV_ALL = [
  { to: '/client',               label: 'Home',      icon: Home,           end: true },
  { to: '/client/appointments',  label: 'Calendar',  icon: Calendar,       requiresProfile: true },
  { to: '/client/messages',      label: 'Messages',  icon: MessageCircle },
  { to: '/client/report-cards',  label: 'Reports',   icon: ClipboardList,  requiresProfile: true },
  { to: '/client/invoices',      label: 'Billing',   icon: CreditCard },
  { to: '/client/dogs',          label: 'My Dogs',   icon: PawIcon },
  { to: '/client/documents',     label: 'Documents', icon: FileText },
  { to: '/client/profile',       label: 'Profile',   icon: User },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });
  const profileConfirmed = !!profile?.client_profile?.profile_confirmed_at;
  const NAV = NAV_ALL.filter(item => !item.requiresProfile || profileConfirmed);

  // Poll for unread message count
  const { data: thread } = useQuery({
    queryKey: ['client-unread', user?.id],
    queryFn: () =>
      api.get(`/conversations/${user?.id}`).then(r => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  const unread = thread?.unread_count_client ?? 0;

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
          <div className="text-xs text-taupe mt-1">Client Portal</div>
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
            {(!collapsed || mobileOpen) && label === 'Messages' && unread > 0 && (
              <span className="rounded-full bg-gold text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-cream">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
          <Link to="/client/settings" onClick={() => setMobileOpen(false)} className="h-8 w-8 rounded-full bg-gold flex items-center justify-center text-white text-sm font-bold flex-shrink-0 hover:bg-gold/80 transition-colors">
            {user?.name.charAt(0)}
          </Link>
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <Link to="/client/settings" onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-espresso truncate block hover:text-gold transition-colors">
                {user?.name}
              </Link>
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
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-cream flex items-center justify-between px-4 py-3 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-espresso">
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
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
