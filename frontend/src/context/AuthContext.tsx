'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

interface Usuario {
  id: number;
  email: string;
}

interface AuthContextData {
  user: Usuario | null;
  loading: boolean;
  login: (token: string, usuario: Usuario) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('isentidos_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.usuario);
        } catch (err) {
          localStorage.removeItem('isentidos_token');
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = (token: string, usuario: Usuario) => {
    localStorage.setItem('isentidos_token', token);
    setUser(usuario);
  };

  const logout = () => {
    localStorage.removeItem('isentidos_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
