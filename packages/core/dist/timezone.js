/**
 * Utilitário para trabalhar com timezone Brasil (America/Sao_Paulo)
 *
 * Todas as datas do sistema devem usar este timezone para consistência.
 */
// Timezone do Brasil (Brasília)
export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
/**
 * Retorna a data/hora atual no timezone do Brasil
 */
export function nowBrazil() {
    return new Date();
}
/**
 * Formata uma data para exibição no timezone do Brasil
 */
export function formatDateBrazil(date, options) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions = {
        timeZone: BRAZIL_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    };
    return d.toLocaleString('pt-BR', { ...defaultOptions, ...options });
}
/**
 * Formata apenas a data (sem hora) no timezone do Brasil
 */
export function formatDateOnlyBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', {
        timeZone: BRAZIL_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
/**
 * Formata apenas a hora no timezone do Brasil
 */
export function formatTimeBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('pt-BR', {
        timeZone: BRAZIL_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}
/**
 * Converte uma string de data ISO para o início do dia no timezone do Brasil
 * Útil para comparações de data sem considerar hora
 */
export function toStartOfDayBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    // Formata para obter a data no timezone Brasil
    const brazilDate = d.toLocaleDateString('en-CA', {
        timeZone: BRAZIL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }); // formato YYYY-MM-DD
    // Cria uma nova data no início do dia (00:00:00) no timezone Brasil
    // Adiciona o offset de Brasília (UTC-3)
    return new Date(`${brazilDate}T00:00:00-03:00`);
}
/**
 * Retorna a data/hora atual como string ISO
 */
export function nowBrazilISO() {
    return new Date().toISOString();
}
/**
 * Verifica se uma data é hoje no timezone do Brasil
 */
export function isTodayBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE });
    const nowStr = now.toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE });
    return dateStr === nowStr;
}
/**
 * Retorna a diferença em minutos entre agora e uma data
 */
export function minutesAgoBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
}
/**
 * Formata uma data relativa (ex: "há 5 minutos", "ontem")
 */
export function formatRelativeBrazil(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 1)
        return 'agora';
    if (diffMinutes < 60)
        return `há ${diffMinutes} min`;
    if (diffHours < 24)
        return `há ${diffHours}h`;
    if (diffDays === 1)
        return 'ontem';
    if (diffDays < 7)
        return `há ${diffDays} dias`;
    return formatDateOnlyBrazil(d);
}
//# sourceMappingURL=timezone.js.map