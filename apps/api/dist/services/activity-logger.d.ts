/**
 * ActivityLogger - Sistema de logging detalhado para agentes
 *
 * Captura logs em tempo real e salva no banco para exibição na UI.
 */
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
/**
 * Adiciona um log ao buffer e agenda flush.
 */
export declare function logActivity(entry: LogEntry): void;
/**
 * Cria um logger para um agente específico.
 */
export declare function createAgentLogger(userId: string, agentId: string, agentName: string): {
    info: (message: string, emoji?: string) => void;
    success: (message: string, emoji?: string) => void;
    warning: (message: string, emoji?: string) => void;
    error: (message: string, emoji?: string) => void;
    debug: (message: string, emoji?: string) => void;
    detail: (message: string, indent?: number) => void;
};
/**
 * Busca logs de atividade de um usuário.
 */
export declare function getActivityLogs(userId: string, options?: {
    agentId?: string;
    limit?: number;
    since?: Date;
}): Promise<Array<{
    id: number;
    agentId: string;
    agentName: string;
    level: string;
    emoji: string | null;
    message: string;
    details: string | null;
    createdAt: Date | null;
}>>;
/**
 * Limpa logs antigos (mais de 24 horas).
 */
export declare function cleanOldLogs(): Promise<void>;
export {};
//# sourceMappingURL=activity-logger.d.ts.map