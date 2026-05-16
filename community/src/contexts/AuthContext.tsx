import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '@/lib/api';

export interface CommunityMember {
  id: number;
  name: string;
  email: string;
  status: 'pending_verification' | 'verified' | 'suspended' | 'closed';
  introduction: string | null;
  radius_meters: number;
  verified_at: string | null;
  created_at: string;
}

interface AuthContextValue {
  member: CommunityMember | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<CommunityMember>;
  signUp: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<CommunityMember>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<CommunityMember | null>(() => {
    const raw = localStorage.getItem('community_member');
    return raw ? (JSON.parse(raw) as CommunityMember) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('community_token'));
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('community_token'));

  // Re-hydrate the member from /me on boot so suspension and verification
  // status are always fresh, not whatever was cached at last sign-in.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api.get('/community/me')
      .then((res) => {
        if (cancelled) return;
        const m = res.data?.data as CommunityMember;
        setMember(m);
        localStorage.setItem('community_member', JSON.stringify(m));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const persist = (m: CommunityMember, t: string) => {
    localStorage.setItem('community_token', t);
    localStorage.setItem('community_member', JSON.stringify(m));
    setMember(m);
    setToken(t);
  };

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const res = await api.post('/community/auth/login', { email, password });
    persist(res.data.member, res.data.token);
    return res.data.member as CommunityMember;
  };

  const signUp: AuthContextValue['signUp'] = async (name, email, password, passwordConfirmation) => {
    const res = await api.post('/community/auth/register', {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });
    persist(res.data.member, res.data.token);
    return res.data.member as CommunityMember;
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    try { await api.post('/community/auth/logout'); } catch { /* swallow */ }
    localStorage.removeItem('community_token');
    localStorage.removeItem('community_member');
    setMember(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ member, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
