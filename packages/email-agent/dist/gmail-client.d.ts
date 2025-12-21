import type { Email } from './types.js';
/**
 * Cliente para interação com a API do Gmail.
 * Gerencia autenticação OAuth2 e operações de email.
 */
export declare class GmailClient {
    private oauth2Client;
    private gmail;
    private tokenPath;
    constructor(options?: {
        tokenPath?: string;
    });
    /**
     * Inicializa o cliente Gmail com tokens passados diretamente.
     * Usado no modo multi-tenant onde tokens vêm do banco de dados.
     */
    initializeWithTokens(tokens: Record<string, unknown>): Promise<void>;
    /**
     * Inicializa o cliente Gmail com autenticação.
     * Lê tokens de arquivo local (modo desenvolvimento/CLI).
     */
    initialize(): Promise<void>;
    /**
     * Gera URL para autorização OAuth2.
     */
    getAuthUrl(): string;
    /**
     * Troca código de autorização por tokens.
     */
    exchangeCodeForTokens(code: string): Promise<void>;
    /**
     * Autorização interativa via terminal (para desenvolvimento).
     */
    private authorize;
    private promptForCode;
    /**
     * Busca emails da caixa de entrada.
     */
    getEmails(options?: {
        query?: string;
        maxResults?: number;
        labelIds?: string[];
        pageToken?: string;
    }): Promise<{
        emails: Email[];
        nextPageToken?: string;
    }>;
    /**
     * Busca detalhes de um email específico.
     */
    getEmailDetails(messageId: string): Promise<Email | null>;
    /**
     * Marca email como lido.
     */
    markAsRead(messageId: string): Promise<void>;
    /**
     * Adiciona label a um email.
     */
    addLabel(messageId: string, labelId: string): Promise<void>;
    /**
     * Arquiva um email (remove da inbox).
     */
    archive(messageId: string): Promise<void>;
    /**
     * Lista todas as labels.
     */
    getLabels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
    /**
     * Cria uma nova label.
     */
    createLabel(name: string): Promise<string>;
    /**
     * Obtém ou cria um label pelo nome.
     */
    getOrCreateLabel(name: string): Promise<string>;
    /**
     * Marca email como processado (adiciona label).
     */
    markAsProcessed(messageId: string, labelId: string): Promise<void>;
    /**
     * Baixa o conteúdo de um anexo.
     */
    getAttachmentContent(messageId: string, attachmentId: string): Promise<Buffer>;
    /**
     * Envia um email.
     */
    sendEmail(options: {
        to: string;
        subject: string;
        body: string;
        threadId?: string;
    }): Promise<string>;
    private stripHtml;
}
//# sourceMappingURL=gmail-client.d.ts.map