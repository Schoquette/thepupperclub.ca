import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const LOGO_URL = 'https://images.squarespace-cdn.com/content/v1/698c986abec1646881b9843f/409f84f0-c68e-45a8-a1f6-1e9c6c9f3a23/Espresso+-+One+line+-+No+tagline.png?format=750w';

const LINKS: { to: string; label: string; matches: (path: string) => boolean }[] = [
  { to: '/discover',   label: 'Discover',   matches: (p) => p.startsWith('/discover') || p.startsWith('/member/') },
  { to: '/network',    label: 'My Network', matches: (p) => p.startsWith('/network') },
  { to: '/broadcasts', label: 'Broadcasts', matches: (p) => p.startsWith('/broadcasts') },
  { to: '/messages',   label: 'Messages',   matches: (p) => p.startsWith('/messages') },
  { to: '/settings',   label: 'Settings',   matches: (p) => p.startsWith('/settings') || p === '/profile-setup' || p === '/verify' },
];

export default function AppNav() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-cream border-b border-taupe/30 sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-3 flex items-center justify-between gap-6">
        <Link to="/home" className="block shrink-0" aria-label="The Pupper Club Community — Home">
          <img src={LOGO_URL} alt="The Pupper Club" className="h-12 lg:h-16 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {LINKS.map((l) => {
            const active = l.matches(location.pathname);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`nav-link ${active ? 'is-active' : ''}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          className="hidden lg:inline-block bg-espresso text-cream border-2 border-espresso uppercase tracking-[0.1em] text-[0.75rem] font-bold px-5 py-2 rounded-full hover:bg-transparent hover:text-espresso transition-colors"
        >
          Sign Out
        </button>

        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="lg:hidden relative w-7 h-5"
        >
          <span className={`absolute left-0 right-0 h-px bg-espresso transition-all duration-300 ${mobileOpen ? 'top-1/2 rotate-45' : 'top-1'}`} />
          <span className={`absolute left-0 right-0 h-px bg-espresso transition-all duration-300 ${mobileOpen ? 'bottom-1/2 -rotate-45' : 'bottom-1'}`} />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-[64px] bg-cream z-30">
          <nav className="flex flex-col items-center gap-6 py-12">
            {LINKS.map((l) => {
              const active = l.matches(location.pathname);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`font-display text-2xl ${active ? 'text-blue' : 'text-espresso'}`}
                >
                  {l.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); void signOut(); }}
              className="mt-4 bg-espresso text-cream border-2 border-espresso uppercase tracking-[0.1em] text-[0.75rem] font-bold px-6 py-3 rounded-full"
            >
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
