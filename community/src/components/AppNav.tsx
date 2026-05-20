import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const LINKS: { to: string; label: string; matches: (path: string) => boolean }[] = [
  { to: '/home',       label: 'Home',       matches: (p) => p === '/home' },
  { to: '/discover',   label: 'Discover',   matches: (p) => p.startsWith('/discover') || p.startsWith('/member/') },
  { to: '/network',    label: 'Network',    matches: (p) => p.startsWith('/network') },
  { to: '/broadcasts', label: 'Broadcasts', matches: (p) => p.startsWith('/broadcasts') },
  { to: '/messages',   label: 'Messages',   matches: (p) => p.startsWith('/messages') },
  { to: '/settings',   label: 'Settings',   matches: (p) => p.startsWith('/settings') || p === '/profile-setup' || p === '/verify' },
];

export default function AppNav() {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <header className="max-w-5xl mx-auto flex items-center justify-between gap-6 mb-10 flex-wrap">
      <Link to="/home" className="label-caps text-blue hover:opacity-80 transition-opacity">
        The Pupper Club &mdash; Community
      </Link>
      <nav className="flex items-center gap-5 flex-wrap">
        {LINKS.map((l) => {
          const active = l.matches(location.pathname);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`label-caps transition-colors ${active ? 'text-espresso' : 'text-taupe hover:text-espresso'}`}
            >
              {l.label}
            </Link>
          );
        })}
        <button onClick={signOut} className="label-caps text-taupe hover:text-espresso transition-colors">
          Sign Out
        </button>
      </nav>
    </header>
  );
}
