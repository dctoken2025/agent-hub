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
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(method);
  const body = options?.body ?? (needsBody ? '{}' : undefined);
  
  // Só adiciona Content-Type se houver body
  const headers: Record<string, string> = {
    ...options?.headers as Record<string, string>,
  };
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...options,
    body,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      // API pode retornar { error: "msg" } ou { message: "msg" }
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Se não conseguir parsear JSON, tenta texto
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
