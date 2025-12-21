/**
 * Utilitário para trabalhar com timezone Brasil (America/Sao_Paulo)
 *
 * Todas as datas do sistema devem usar este timezone para consistência.
 */
export declare const BRAZIL_TIMEZONE = "America/Sao_Paulo";
/**
 * Retorna a data/hora atual no timezone do Brasil
 */
export declare function nowBrazil(): Date;
/**
 * Formata uma data para exibição no timezone do Brasil
 */
export declare function formatDateBrazil(date: Date | string, options?: Intl.DateTimeFormatOptions): string;
/**
 * Formata apenas a data (sem hora) no timezone do Brasil
 */
export declare function formatDateOnlyBrazil(date: Date | string): string;
/**
 * Formata apenas a hora no timezone do Brasil
 */
export declare function formatTimeBrazil(date: Date | string): string;
/**
 * Converte uma string de data ISO para o início do dia no timezone do Brasil
 * Útil para comparações de data sem considerar hora
 */
export declare function toStartOfDayBrazil(date: Date | string): Date;
/**
 * Retorna a data/hora atual como string ISO
 */
export declare function nowBrazilISO(): string;
/**
 * Verifica se uma data é hoje no timezone do Brasil
 */
export declare function isTodayBrazil(date: Date | string): boolean;
/**
 * Retorna a diferença em minutos entre agora e uma data
 */
export declare function minutesAgoBrazil(date: Date | string): number;
/**
 * Formata uma data relativa (ex: "há 5 minutos", "ontem")
 */
export declare function formatRelativeBrazil(date: Date | string): string;
//# sourceMappingURL=timezone.d.ts.map