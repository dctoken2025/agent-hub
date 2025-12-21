/**
 * Funções de compatibilidade com o código legado.
 * Serão removidas após a migração completa para multi-tenant.
 */
/**
 * @deprecated Use saveGlobalConfigValue ou saveUserConfigValue
 * Mantido para compatibilidade com código existente
 */
export declare function saveConfigValue(key: string, value: string, isSecret?: boolean): Promise<void>;
//# sourceMappingURL=config-legacy.d.ts.map