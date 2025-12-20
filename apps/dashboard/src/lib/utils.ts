import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// URL base da API - em produção usa variável de ambiente
const API_BASE = import.meta.env.VITE_API_URL || '';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;
  const method = options?.method || 'GET';
  
  // Se for POST/PUT/PATCH sem body, adiciona body vazio
  const needsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const body = options?.body ?? (needsBody ? '{}' : undefined);
  
  // Obtém o token do localStorage
  const token = localStorage.getItem('token');
  
  // Configura headers
  const headers: Record<string, string> = {
    ...options?.headers as Record<string, string>,
  };
  
  // Adiciona Authorization se tiver token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Adiciona Content-Type se houver body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...options,
    body,
    headers,
  });

  // Se token expirou ou inválido, faz logout
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    
    // Se for erro de token (não de credenciais inválidas no login)
    if (data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN' || data.code === 'NO_TOKEN') {
      localStorage.removeItem('token');
      window.location.href = '/';
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    
    throw new Error(data.error || 'Não autorizado');
  }

  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Mantém mensagem padrão
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Helper para verificar se está autenticado
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

// Helper para fazer logout
export function logout(): void {
  localStorage.removeItem('token');
  window.location.href = '/';
}
