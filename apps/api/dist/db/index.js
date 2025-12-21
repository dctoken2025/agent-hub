import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
// Variáveis que serão inicializadas depois
let client = null;
let database = null;
let initialized = false;
// Inicializa conexão com banco (chamado após dotenv carregar)
export function initDatabase() {
    if (initialized)
        return;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.warn('[DB] DATABASE_URL não configurada - banco de dados desabilitado');
        initialized = true;
        return;
    }
    try {
        client = postgres(connectionString, { max: 10 });
        database = drizzle(client, { schema });
        console.log('[DB] Conexão com PostgreSQL configurada');
        initialized = true;
    }
    catch (error) {
        console.error('[DB] Erro ao configurar banco:', error);
        initialized = true;
    }
}
// Getter para o banco
export function getDb() {
    if (!initialized) {
        initDatabase();
    }
    return database;
}
// Alias para compatibilidade
export const db = {
    get instance() {
        return getDb();
    }
};
// Exporta schema para uso externo
export * from './schema.js';
// Função helper para verificar se DB está disponível
export function isDatabaseConnected() {
    return getDb() !== null;
}
// Testa conexão
export async function testConnection() {
    const db = getDb();
    if (!db)
        return false;
    try {
        await db.execute('SELECT 1');
        console.log('[DB] Conexão com PostgreSQL OK');
        return true;
    }
    catch (error) {
        console.error('[DB] Erro ao conectar:', error);
        return false;
    }
}
//# sourceMappingURL=index.js.map