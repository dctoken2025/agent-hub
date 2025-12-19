/**
 * Configuração do Dashboard
 * 
 * Em desenvolvimento, usa localhost:3001
 * Em produção, usa a variável de ambiente VITE_API_URL
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Remove /api se já estiver incluído
export const API_URL = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

