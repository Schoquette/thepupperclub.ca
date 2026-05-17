import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import WelcomePage from '@/pages/WelcomePage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import HomePage from '@/pages/HomePage';
import ProfileSetupPage from '@/pages/ProfileSetupPage';
import DiscoverPage from '@/pages/DiscoverPage';
import NetworkPage from '@/pages/NetworkPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { member, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-taupe text-sm">Loading...</div>;
  }
  if (!member) return <Navigate to="/" replace />;
  return children;
}

function RedirectIfAuthed({ children }: { children: JSX.Element }) {
  const { member, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-taupe text-sm">Loading...</div>;
  }
  if (member) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><WelcomePage /></RedirectIfAuthed>} />
      <Route path="/sign-in" element={<RedirectIfAuthed><SignInPage /></RedirectIfAuthed>} />
      <Route path="/sign-up" element={<RedirectIfAuthed><SignUpPage /></RedirectIfAuthed>} />
      <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/profile-setup" element={<RequireAuth><ProfileSetupPage /></RequireAuth>} />
      <Route path="/discover" element={<RequireAuth><DiscoverPage /></RequireAuth>} />
      <Route path="/network" element={<RequireAuth><NetworkPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
