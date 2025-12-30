'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Tentar recuperar o usuário da sessão/cookies ao carregar a página
    const checkUser = async () => {
      // Não verificar se já estiver na página de login
      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me').catch(() => null);
        if (response?.data) {
          setUser(response.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        // Silenciosamente falha se não houver sessão válida
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log(`[AUTH] Tentando login para ${email}...`);
      const response = await api.post('/auth/login', { email, password });
      console.log('[AUTH] Login bem-sucedido!', response.data);
      setUser(response.data.user);
      toast.success('Bem-vindo ao MedFlow!');
      
      // Pequeno delay para garantir que o cookie foi gravado pelo navegador
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao realizar login';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      router.push('/login');
    } catch (error) {
      toast.error('Erro ao sair do sistema');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


