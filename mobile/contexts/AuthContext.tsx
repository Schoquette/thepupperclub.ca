import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '@/lib/api';
import type { User, AuthToken } from '@pupper/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const [stored, storedToken] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('token'),
      ]);
      if (stored) setUserState(JSON.parse(stored));
      if (storedToken) setToken(storedToken);
      setLoading(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { data } = await api.post<AuthToken>('/auth/login', { email, password });
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    setUserState(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    setUserState(null);
    setToken(null);
  }, []);

  const setUser = useCallback(async (u: User) => {
    await SecureStore.setItemAsync('user', JSON.stringify(u));
    setUserState(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
