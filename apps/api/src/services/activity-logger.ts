/**
 * ActivityLogger - Sistema de logging detalhado para agentes
 * 
 * Captura logs em tempo real e salva no banco para exibição na UI.
 */

import { getDb, agentActivityLogs } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogEntry {
  userId: string;
  agentId: string;
  agentName: string;
  level: LogLevel;
  emoji?: string;
  message: string;
  details?: string;
}

// Buffer de logs para inserção em batch
const logBuffer: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

/**
 * Adiciona um log ao buffer e agenda flush.
 */
export function logActivity(entry: LogEntry): void {
  logBuffer.push(entry);
  
  // Agenda flush se não houver um pendente
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, 1000); // Flush a cada 1 segundo
  }
}

/**
 * Flush dos logs no buffer para o banco.
 */
async function flushLogs(): Promise<void> {
  flushTimeout = null;
  
  if (logBuffer.length === 0) return;
  
  const db = getDb();
  if (!db) return;
  
  // Pega todos os logs do buffer
  const logsToInsert = [...logBuffer];
  logBuffer.length = 0;
  
  try {
    await db.insert(agentActivityLogs).values(logsToInsert);
  } catch (error) {
    console.error('[ActivityLogger] Erro ao salvar logs:', error);
  }
}

/**
 * Cria um logger para um agente específico.
 */
export function createAgentLogger(userId: string, agentId: string, agentName: string) {
  return {
    info: (message: string, emoji?: string) => {
      console.log(`[${agentName}] ${emoji || 'ℹ️'} ${message}`);
      logActivity({ userId, agentId, agentName, level: 'info', emoji: emoji || 'ℹ️', message });
    },
    success: (message: string, emoji?: string) => {
      console.log(`[${agentName}] ${emoji || '✅'} ${message}`);
      logActivity({ userId, agentId, agentName, level: 'success', emoji: emoji || '✅', message });
    },
    warning: (message: string, emoji?: string) => {
      console.log(`[${agentName}] ${emoji || '⚠️'} ${message}`);
      logActivity({ userId, agentId, agentName, level: 'warning', emoji: emoji || '⚠️', message });
    },
    error: (message: string, emoji?: string) => {
      console.error(`[${agentName}] ${emoji || '❌'} ${message}`);
      logActivity({ userId, agentId, agentName, level: 'error', emoji: emoji || '❌', message });
    },
    debug: (message: string, emoji?: string) => {
      console.log(`[${agentName}] ${emoji || '🔍'} ${message}`);
      logActivity({ userId, agentId, agentName, level: 'debug', emoji: emoji || '🔍', message });
    },
    detail: (message: string, indent = 3) => {
      const prefix = ' '.repeat(indent);
      console.log(`[${agentName}] ${prefix}${message}`);
      logActivity({ userId, agentId, agentName, level: 'info', message: `${prefix}${message}` });
    },
  };
}

/**
 * Busca logs de atividade de um usuário.
 */
export async function getActivityLogs(
  userId: string,
  options?: {
    agentId?: string;
    limit?: number;
    since?: Date;
  }
): Promise<Array<{
  id: number;
  agentId: string;
  agentName: string;
  level: string;
  emoji: string | null;
  message: string;
  details: string | null;
  createdAt: Date | null;
}>> {
  const db = getDb();
  if (!db) return [];
  
  const limit = options?.limit || 100;
  
  try {
    let query = db
      .select()
      .from(agentActivityLogs)
      .where(eq(agentActivityLogs.userId, userId))
      .orderBy(desc(agentActivityLogs.createdAt))
      .limit(limit);
    
    const results = await query;
    return results;
  } catch (error) {
    console.error('[ActivityLogger] Erro ao buscar logs:', error);
    return [];
  }
}

/**
 * Limpa logs antigos (mais de 24 horas).
 */
export async function cleanOldLogs(): Promise<void> {
  const db = getDb();
  if (!db) return;
  
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.execute(`DELETE FROM agent_activity_logs WHERE created_at < '${oneDayAgo.toISOString()}'`);
    console.log('[ActivityLogger] Logs antigos limpos');
  } catch (error) {
    console.error('[ActivityLogger] Erro ao limpar logs:', error);
  }
}
