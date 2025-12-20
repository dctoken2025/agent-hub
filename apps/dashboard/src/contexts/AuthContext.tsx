import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/config';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  hasGmailConnected?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Busca dados do usuário com o token
  const fetchUser = useCallback(async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      } else {
        // Token inválido ou expirado
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      return false;
    }
  }, []);

  // Verifica token na URL (callback do Google OAuth) e no localStorage
  useEffect(() => {
    async function initAuth() {
      // 1. Verifica se há token na URL (retorno do OAuth)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const isWelcome = params.get('welcome') === 'true';

      if (urlToken) {
        // Salva o token e limpa a URL
        localStorage.setItem('token', urlToken);
        setToken(urlToken);
        
        // Limpa parâmetros da URL mantendo o path
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        // Busca dados do usuário
        const success = await fetchUser(urlToken);
        
        if (success && isWelcome) {
          // Primeiro acesso - poderia mostrar um toast de boas-vindas
          console.log('Bem-vindo ao Agent Hub!');
        }
        
        setIsLoading(false);
        return;
      }

      // 2. Verifica token no localStorage
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        await fetchUser(storedToken);
      }
      
      setIsLoading(false);
    }

    initAuth();
  }, [fetchUser]);

  // Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // Refresh user data
  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin: user?.role === 'admin',
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

