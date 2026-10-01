import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, FileText, Menu, X } from 'lucide-react';

const NAV = [
  { to: '/admin/calendar',     label: 'My Calendar', icon: Calendar },
  { to: '/admin/clients',      label: 'My Clients',  icon: Users },
  { to: '/admin/report-cards', label: 'Report Cards', icon: FileText },
];

export default function TeamMemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      <div className="flex flex-col items-center px-5 py-5 border-b border-cream">
        <img src="/logo.png" alt="The Pupper Club" className="w-28 h-auto object-contain" />
        <div className="text-xs text-taupe mt-1">Team Portal</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-cream text-gold font-semibold' : 'text-espresso hover:bg-cream'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-cream">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="h-8 w-8 rounded-full bg-gold flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-espresso truncate">{user?.name}</div>
            <button onClick={handleLogout} className="text-xs text-taupe hover:text-espresso">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-cream flex items-center justify-between px-4 py-3 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-espresso">
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo.png" alt="The Pupper Club" className="h-8 object-contain" />
        <div className="w-6" />
      </div>

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

      <aside className="hidden md:flex flex-col bg-white shadow-card w-64">
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
