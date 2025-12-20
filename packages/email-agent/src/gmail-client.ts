import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type { Email, EmailAddress, EmailAttachment } from './types.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
];

/**
 * Cliente para interação com a API do Gmail.
 * Gerencia autenticação OAuth2 e operações de email.
 */
export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail | null = null;
  private tokenPath: string;

  constructor(options?: {
    tokenPath?: string;
  }) {
    // Usa caminho absoluto baseado no cwd para garantir consistência
    this.tokenPath = options?.tokenPath || path.join(process.cwd(), 'gmail-tokens.json');

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );
  }

  /**
   * Inicializa o cliente Gmail com tokens passados diretamente.
   * Usado no modo multi-tenant onde tokens vêm do banco de dados.
   */
  async initializeWithTokens(tokens: Record<string, unknown>): Promise<void> {
    console.log('[GmailClient] Inicializando com tokens do banco de dados...');
    
    if (!tokens || !tokens.access_token) {
      throw new Error('Tokens inválidos: access_token não encontrado');
    }

    this.oauth2Client.setCredentials(tokens);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    console.log('[GmailClient] ✅ Inicializado com tokens do banco');
  }

  /**
   * Inicializa o cliente Gmail com autenticação.
   * Lê tokens de arquivo local (modo desenvolvimento/CLI).
   */
  async initialize(): Promise<void> {
    console.log('[GmailClient] Iniciando inicialização...');
    console.log('[GmailClient] Buscando token em:', this.tokenPath);
    console.log('[GmailClient] CWD:', process.cwd());
    
    // Tenta carregar token existente
    if (fs.existsSync(this.tokenPath)) {
      console.log('[GmailClient] Token encontrado, carregando...');
      try {
        const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
        this.oauth2Client.setCredentials(token);
        console.log('[GmailClient] Credenciais configuradas');
      } catch (error) {
        console.error('[GmailClient] Erro ao ler token:', error);
        throw new Error(`Falha ao ler token: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    } else {
      console.log('[GmailClient] Token não encontrado em:', this.tokenPath);
      // Se não tem token, precisa autorizar
      await this.authorize();
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    console.log('[GmailClient] Inicializado com sucesso');
  }

  /**
   * Gera URL para autorização OAuth2.
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  /**
   * Troca código de autorização por tokens.
   */
  async exchangeCodeForTokens(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    // Salva tokens para uso futuro
    fs.writeFileSync(this.tokenPath, JSON.stringify(tokens));
    console.log('[GmailClient] Tokens salvos em', this.tokenPath);

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Autorização interativa via terminal (para desenvolvimento).
   */
  private async authorize(): Promise<void> {
    const authUrl = this.getAuthUrl();
    console.log('\n🔐 Autorize o acesso ao Gmail:');
    console.log(authUrl);
    console.log('\n');

    const code = await this.promptForCode();
    await this.exchangeCodeForTokens(code);
  }

  private promptForCode(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Cole o código de autorização: ', (code) => {
        rl.close();
        resolve(code);
      });
    });
  }

  /**
   * Busca emails da caixa de entrada.
   */
  async getEmails(options?: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }): Promise<{ emails: Email[]; nextPageToken?: string }> {
    if (!this.gmail) {
      throw new Error('Gmail client não inicializado');
    }

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: options?.query,
      maxResults: options?.maxResults || 50,
      labelIds: options?.labelIds,
      pageToken: options?.pageToken,
    });

    const messages = response.data.messages || [];
    const emails: Email[] = [];

    for (const message of messages) {
      const email = await this.getEmailDetails(message.id!);
      if (email) {
        emails.push(email);
      }
    }

    return {
      emails,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Busca detalhes de um email específico.
   */
  async getEmailDetails(messageId: string): Promise<Email | null> {
    if (!this.gmail) {
      throw new Error('Gmail client não inicializado');
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload?.headers || [];

      const getHeader = (name: string): string => {
        return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      };

      const parseAddresses = (header: string): EmailAddress[] => {
        if (!header) return [];
        return header.split(',').map(addr => {
          const match = addr.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
          return {
            name: match?.[1]?.trim(),
            email: match?.[2]?.trim() || addr.trim(),
          };
        });
      };

      // Extrai corpo do email
      let body = '';
      let bodyHtml = '';

      const extractBody = (payload: gmail_v1.Schema$MessagePart): void => {
        if (payload.body?.data) {
          const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          if (payload.mimeType === 'text/plain') {
            body = decoded;
          } else if (payload.mimeType === 'text/html') {
            bodyHtml = decoded;
          }
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            extractBody(part);
          }
        }
      };

      if (message.payload) {
        extractBody(message.payload);
      }

      // Extrai anexos
      const attachments: EmailAttachment[] = [];
      const extractAttachments = (payload: gmail_v1.Schema$MessagePart): void => {
        if (payload.filename && payload.body?.attachmentId) {
          attachments.push({
            id: payload.body.attachmentId,
            filename: payload.filename,
            mimeType: payload.mimeType || 'application/octet-stream',
            size: payload.body.size || 0,
          });
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            extractAttachments(part);
          }
        }
      };

      if (message.payload) {
        extractAttachments(message.payload);
      }

      return {
        id: message.id!,
        threadId: message.threadId!,
        from: parseAddresses(getHeader('From'))[0] || { email: 'unknown' },
        to: parseAddresses(getHeader('To')),
        cc: parseAddresses(getHeader('Cc')),
        subject: getHeader('Subject'),
        snippet: message.snippet || '',
        body: body || this.stripHtml(bodyHtml),
        bodyHtml,
        date: new Date(parseInt(message.internalDate || '0')),
        labels: message.labelIds || [],
        isUnread: message.labelIds?.includes('UNREAD') || false,
        hasAttachments: attachments.length > 0,
        attachments,
      };
    } catch (error) {
      console.error(`[GmailClient] Erro ao buscar email ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Marca email como lido.
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Gmail client não inicializado');

    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Adiciona label a um email.
   */
  async addLabel(messageId: string, labelId: string): Promise<void> {
    if (!this.gmail) throw new Error('Gmail client não inicializado');

    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  /**
   * Arquiva um email (remove da inbox).
   */
  async archive(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Gmail client não inicializado');

    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  }

  /**
   * Lista todas as labels.
   */
  async getLabels(): Promise<Array<{ id: string; name: string }>> {
    if (!this.gmail) throw new Error('Gmail client não inicializado');

    const response = await this.gmail.users.labels.list({ userId: 'me' });
    return (response.data.labels || []).map(l => ({
      id: l.id!,
      name: l.name!,
    }));
  }

  /**
   * Cria uma nova label.
   */
  async createLabel(name: string): Promise<string> {
    if (!this.gmail) throw new Error('Gmail client não inicializado');

    const response = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    return response.data.id!;
  }

  /**
   * Obtém ou cria um label pelo nome.
   */
  async getOrCreateLabel(name: string): Promise<string> {
    const labels = await this.getLabels();
    const existing = labels.find(l => l.name === name);
    
    if (existing) {
      return existing.id;
    }
    
    console.log(`[GmailClient] Criando label: ${name}`);
    return await this.createLabel(name);
  }

  /**
   * Marca email como processado (adiciona label).
   */
  async markAsProcessed(messageId: string, labelId: string): Promise<void> {
    await this.addLabel(messageId, labelId);
  }

  /**
   * Baixa o conteúdo de um anexo.
   */
  async getAttachmentContent(messageId: string, attachmentId: string): Promise<Buffer> {
    if (!this.gmail) {
      throw new Error('Gmail client não inicializado');
    }

    const response = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (!response.data.data) {
      throw new Error('Anexo sem conteúdo');
    }

    // O conteúdo vem em base64 URL-safe, precisamos converter
    const base64 = response.data.data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64');
  }

  /**
   * Envia um email.
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<string> {
    if (!this.gmail) {
      throw new Error('Gmail client não inicializado');
    }

    const { to, subject, body, threadId } = options;

    // Monta o email no formato RFC 2822
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ];

    const email = emailLines.join('\r\n');
    
    // Converte para base64 URL-safe
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody: { raw: string; threadId?: string } = {
      raw: encodedEmail,
    };

    // Se tiver threadId, mantém na mesma conversa
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    console.log(`[GmailClient] Email enviado - ID: ${response.data.id}`);
    return response.data.id || '';
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
