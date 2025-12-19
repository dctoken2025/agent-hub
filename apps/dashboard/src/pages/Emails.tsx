import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Mail, 
  AlertCircle, 
  Clock, 
  Archive, 
  Eye,
  User,
  Calendar,
  Tag,
  RefreshCw,
  CheckCheck,
  ArchiveX,
  Reply,
  Send,
  X,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { cn, apiRequest } from '@/lib/utils';
import { useDialog } from '@/components/Dialog';

interface EmailClassification {
  priority: string;
  action: string;
  confidence: number;
  reasoning: string;
  tags: string[];
  sentiment: string;
  isDirectedToMe: boolean;
  requiresAction: boolean;
}

interface ClassifiedEmail {
  id: string;
  from: { name?: string; email: string };
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  emailDate: string;
  isRead: boolean;
  isArchived: boolean;
  hasAttachments?: boolean;
  classification: EmailClassification;
}

interface EmailsResponse {
  emails: ClassifiedEmail[];
  summary: {
    processedCount: number;
    classifications: Record<string, number>;
  } | null;
}

const priorityConfig = {
  urgent: { label: 'Urgente', color: 'bg-red-500', icon: AlertCircle },
  attention: { label: 'Atenção', color: 'bg-orange-500', icon: Clock },
  informative: { label: 'Informativo', color: 'bg-blue-500', icon: Eye },
  low: { label: 'Baixa', color: 'bg-gray-400', icon: Archive },
  cc_only: { label: 'Apenas CC', color: 'bg-gray-300', icon: Mail },
};

type ReadFilter = 'unread' | 'read' | 'all';

// Formata data e hora
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Emails() {
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread');
  const [replyingTo, setReplyingTo] = useState<ClassifiedEmail | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [bulkActionProgress, setBulkActionProgress] = useState<{ action: string; count: number; total: number } | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ClassifiedEmail | null>(null);
  const queryClient = useQueryClient();
  const dialog = useDialog();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: () => apiRequest<EmailsResponse>('/emails?limit=1000'),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (priority: string) => {
      const total = emails.filter(e => e.classification.priority === priority && !e.isRead).length;
      setBulkActionProgress({ action: 'Marcando como lido', count: 0, total });
      
      const result = await apiRequest('/emails/mark-read', { 
        method: 'POST',
        body: JSON.stringify({ priority }),
      });
      
      return result;
    },
    onSuccess: (data: any) => {
      setBulkActionProgress(null);
      dialog.success(`${data.count || 0} emails marcados como lidos!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      setBulkActionProgress(null);
      dialog.error(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (priority: string) => {
      const total = emails.filter(e => e.classification.priority === priority && !e.isRead).length;
      setBulkActionProgress({ action: 'Arquivando', count: 0, total });
      
      const result = await apiRequest('/emails/archive', { 
        method: 'POST',
        body: JSON.stringify({ priority }),
      });
      
      return result;
    },
    onSuccess: (data: any) => {
      setBulkActionProgress(null);
      dialog.success(`${data.count || 0} emails arquivados!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      setBulkActionProgress(null);
      dialog.error(error.message);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ emailId, to, subject, body }: { emailId: string; to: string; subject: string; body: string }) => {
      return apiRequest('/emails/reply', { 
        method: 'POST',
        body: JSON.stringify({ emailId, to, subject, body }),
      });
    },
    onSuccess: () => {
      dialog.success('Email enviado com sucesso!');
      setReplyingTo(null);
      setReplyMessage('');
    },
    onError: (error: any) => {
      dialog.error(error.message || 'Erro ao enviar email');
    },
  });

  const emails = data?.emails || [];
  
  // Aplica filtros: primeiro por lido/não lido, depois por prioridade
  const filteredEmails = emails.filter(e => {
    // Filtro de lido/não lido
    if (readFilter === 'unread' && e.isRead) return false;
    if (readFilter === 'read' && !e.isRead) return false;
    
    // Filtro de prioridade
    if (selectedPriority && e.classification.priority !== selectedPriority) return false;
    
    return true;
  });
  
  // Conta emails por status de leitura (para os badges)
  const unreadCount = emails.filter(e => !e.isRead).length;
  const readCount = emails.filter(e => e.isRead).length;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleFetchEmails = async () => {
    try {
      setIsRefreshing(true);
      await apiRequest('/emails/fetch', { method: 'POST' });
      // Aguarda o agente processar e depois atualiza
      setTimeout(() => {
        refetch();
        setIsRefreshing(false);
      }, 5000);
    } catch (error) {
      console.error('Erro ao buscar emails:', error);
      setIsRefreshing(false);
      dialog.error('Erro ao buscar emails. Verifique o console.');
    }
  };

  const handleSyncFromGmail = async () => {
    try {
      setIsSyncing(true);
      setBulkActionProgress({ action: 'Sincronizando do Gmail', count: 0, total: 0 });
      
      const result = await apiRequest<{ synced: number; found: number; alreadyInDb: number }>('/emails/sync-from-gmail', { 
        method: 'POST',
        body: JSON.stringify({ limit: 500 }),
      });
      
      setBulkActionProgress(null);
      
      if (result.synced > 0) {
        dialog.success(`${result.synced} emails sincronizados! (${result.alreadyInDb} já estavam no banco)`);
        refetch();
      } else {
        dialog.success(`Todos os ${result.found} emails do Gmail já estão sincronizados!`);
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      dialog.error(error.message || 'Erro ao sincronizar do Gmail.');
    } finally {
      setIsSyncing(false);
      setBulkActionProgress(null);
    }
  };

  const handleRefreshList = () => {
    refetch();
  };

  const handleReply = (email: ClassifiedEmail) => {
    setReplyingTo(email);
    setReplyMessage('');
  };

  const handleSendReply = () => {
    if (!replyingTo || !replyMessage.trim()) return;
    
    replyMutation.mutate({
      emailId: replyingTo.id,
      to: replyingTo.from.email,
      subject: replyingTo.subject.startsWith('Re:') ? replyingTo.subject : `Re: ${replyingTo.subject}`,
      body: replyMessage,
    });
  };

  // Verifica se a prioridade selecionada permite ações em massa
  // Só mostra ações em massa se houver emails não lidos da prioridade selecionada
  const unreadInPriority = selectedPriority 
    ? emails.filter(e => e.classification.priority === selectedPriority && !e.isRead).length 
    : 0;
  const canBulkAction = selectedPriority && 
    ['low', 'informative', 'cc_only'].includes(selectedPriority) && 
    unreadInPriority > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Emails Classificados</h2>
          <p className="text-muted-foreground">
            {emails.length} emails processados
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshList}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar Lista
          </button>
          <button
            onClick={handleFetchEmails}
            disabled={isRefreshing || isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Mail className={`h-4 w-4 ${isRefreshing ? 'animate-pulse' : ''}`} />
            {isRefreshing ? 'Buscando...' : 'Buscar Novos Emails'}
          </button>
          <button
            onClick={handleSyncFromGmail}
            disabled={isSyncing || isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            title="Sincroniza emails marcados no Gmail que não estão no banco"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar do Gmail'}
          </button>
        </div>
      </div>

      {/* Bulk Action Progress */}
      {bulkActionProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card p-6 rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">{bulkActionProgress.action}...</p>
                <p className="text-sm text-muted-foreground">
                  Processando {bulkActionProgress.total} emails
                </p>
                <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 animate-pulse"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Isso pode levar alguns segundos...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card p-6 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Reply className="h-5 w-5" />
                Responder Email
              </h3>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Para:</p>
                <p className="font-medium">{replyingTo.from.name || replyingTo.from.email}</p>
                <p className="text-sm text-muted-foreground">&lt;{replyingTo.from.email}&gt;</p>
              </div>

              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Assunto:</p>
                <p className="font-medium">
                  {replyingTo.subject.startsWith('Re:') ? replyingTo.subject : `Re: ${replyingTo.subject}`}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Sua resposta:</label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full mt-1 p-3 border rounded-lg bg-background min-h-[200px] resize-y"
                  placeholder="Digite sua resposta..."
                  autoFocus
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Email original:</p>
                <p className="text-sm italic">{replyingTo.snippet}</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setReplyingTo(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || replyMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {replyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Resposta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {canBulkAction && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Ações em massa para {unreadInPriority} email(s) "{priorityConfig[selectedPriority as keyof typeof priorityConfig]?.label}" não lido(s):
          </span>
          <button
            onClick={() => markReadMutation.mutate(selectedPriority)}
            disabled={markReadMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {markReadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCheck className="h-4 w-4" />
                Marcar Todos como Lido
              </>
            )}
          </button>
          <button
            onClick={() => archiveMutation.mutate(selectedPriority)}
            disabled={archiveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {archiveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <ArchiveX className="h-4 w-4" />
                Arquivar Todos
              </>
            )}
          </button>
        </div>
      )}

      {/* Filtro de Lido/Não Lido */}
      <div className="flex items-center gap-4">
        <div className="flex bg-secondary rounded-lg p-1">
          <button
            onClick={() => setReadFilter('unread')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              readFilter === 'unread'
                ? "bg-white dark:bg-gray-800 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            📬 Não Lidos ({unreadCount})
          </button>
          <button
            onClick={() => setReadFilter('read')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              readFilter === 'read'
                ? "bg-white dark:bg-gray-800 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ✅ Lidos ({readCount})
          </button>
          <button
            onClick={() => setReadFilter('all')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              readFilter === 'all'
                ? "bg-white dark:bg-gray-800 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            📧 Todos ({emails.length})
          </button>
        </div>
      </div>

      {/* Filtros de Prioridade */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedPriority(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            !selectedPriority 
              ? "bg-primary text-primary-foreground" 
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          Todas Prioridades
        </button>
        {Object.entries(priorityConfig).map(([key, config]) => {
          // Conta apenas emails que passam pelo filtro de lido/não lido
          const count = emails.filter(e => {
            if (readFilter === 'unread' && e.isRead) return false;
            if (readFilter === 'read' && !e.isRead) return false;
            return e.classification.priority === key;
          }).length;
          return (
            <button
              key={key}
              onClick={() => setSelectedPriority(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5",
                selectedPriority === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <span className={`h-2 w-2 rounded-full ${config.color}`} />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum email encontrado</p>
          <button
            onClick={handleFetchEmails}
            className="mt-4 text-primary hover:underline"
          >
            Buscar emails agora
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmails.map((email) => {
            const priority = priorityConfig[email.classification.priority as keyof typeof priorityConfig];
            const PriorityIcon = priority?.icon || Mail;
            
            return (
              <div 
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className="p-4 bg-card rounded-xl border hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
              >
                <div className="flex items-start gap-4">
                  {/* Priority indicator */}
                  <div className={cn(
                    "p-2 rounded-lg",
                    priority?.color.replace('bg-', 'bg-opacity-20 bg-')
                  )}>
                    <PriorityIcon className={cn(
                      "h-5 w-5",
                      priority?.color.replace('bg-', 'text-').replace('-500', '-600').replace('-400', '-500').replace('-300', '-400')
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        priority?.color,
                        "text-white"
                      )}>
                        {priority?.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {email.classification.confidence}% confiança
                      </span>
                    </div>

                    <h3 className="font-medium truncate">{email.subject}</h3>
                    
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {email.from.name || email.from.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(email.date)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {email.snippet}
                    </p>

                    {/* Tags */}
                    {email.classification.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        {email.classification.tags.map(tag => (
                          <span 
                            key={tag}
                            className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reasoning */}
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      💡 {email.classification.reasoning}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn(
                      "text-xs font-medium",
                      email.classification.requiresAction ? "text-orange-500" : "text-green-500"
                    )}>
                      {email.classification.requiresAction ? "Requer ação" : "Sem ação"}
                    </span>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReply(email);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Responder
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de visualização do email */}
      {selectedEmail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedEmail(null)}
        >
          <div 
            className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded-full text-white",
                      priorityConfig[selectedEmail.classification.priority as keyof typeof priorityConfig]?.color || 'bg-gray-500'
                    )}>
                      {priorityConfig[selectedEmail.classification.priority as keyof typeof priorityConfig]?.label || selectedEmail.classification.priority}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(selectedEmail.classification.confidence * 100)}% confiança
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground truncate">
                    {selectedEmail.subject || '(Sem assunto)'}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Metadata */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedEmail.from.name || selectedEmail.from.email}</span>
                  <span className="text-muted-foreground">&lt;{selectedEmail.from.email}&gt;</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{formatDateTime(selectedEmail.emailDate)}</span>
                </div>
                {selectedEmail.classification.tags && selectedEmail.classification.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {selectedEmail.classification.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-muted rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Analysis */}
            {selectedEmail.classification.reasoning && (
              <div className="p-4 border-b bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-400">Análise da IA: </span>
                    <span className="text-blue-600 dark:text-blue-300">{selectedEmail.classification.reasoning}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Email Body */}
            <div className="flex-1 overflow-auto p-6">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {selectedEmail.body || selectedEmail.snippet || '(Sem conteúdo)'}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedEmail.hasAttachments && (
                  <span className="flex items-center gap-1">
                    📎 Este email possui anexos
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedEmail(null);
                    handleReply(selectedEmail);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Reply className="h-4 w-4" />
                  Responder
                </button>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
