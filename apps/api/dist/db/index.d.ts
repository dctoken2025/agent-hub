import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
export declare function initDatabase(): void;
export declare function getDb(): PostgresJsDatabase<typeof schema> | null;
export declare const db: {
    readonly instance: PostgresJsDatabase<typeof schema> | null;
};
export * from './schema.js';
export declare function isDatabaseConnected(): boolean;
export declare function testConnection(): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map