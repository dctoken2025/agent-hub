/**
 * Funções de compatibilidade com o código legado.
 * Serão removidas após a migração completa para multi-tenant.
 */

import { eq } from 'drizzle-orm';
import { getDb, appConfig } from '../db/index.js';

/**
 * @deprecated Use saveGlobalConfigValue ou saveUserConfigValue
 * Mantido para compatibilidade com código existente
 */
export async function saveConfigValue(key: string, value: string, isSecret = false): Promise<void> {
  const db = getDb();
  if (!db) {
    console.warn('[Config-Legacy] Banco não disponível');
    return;
  }

  try {
    const existing = await db.select().from(appConfig).where(eq(appConfig.key, key));

    if (existing.length > 0) {
      await db.update(appConfig)
        .set({ value, isSecret, updatedAt: new Date() })
        .where(eq(appConfig.key, key));
    } else {
      await db.insert(appConfig).values({ key, value, isSecret });
    }

    // Também atualiza env var em runtime
    const envKey = key.replace('.', '_').toUpperCase();
    process.env[envKey] = value;
  } catch (error) {
    console.error('[Config-Legacy] Erro ao salvar:', error);
    throw error;
  }
}
