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
  ArchiveX
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
  date: string;
  isRead: boolean;
  isArchived: boolean;
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

export function Emails() {
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread');
  const queryClient = useQueryClient();
  const dialog = useDialog();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: () => apiRequest<EmailsResponse>('/emails?limit=1000'),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (priority: string) => 
      apiRequest('/emails/mark-read', { 
        method: 'POST',
        body: JSON.stringify({ priority }),
      }),
    onSuccess: (data: any) => {
      dialog.success(`${data.count || 0} emails marcados como lidos!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      dialog.error(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (priority: string) => 
      apiRequest('/emails/archive', { 
        method: 'POST',
        body: JSON.stringify({ priority }),
      }),
    onSuccess: (data: any) => {
      dialog.success(`${data.count || 0} emails arquivados!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      dialog.error(error.message);
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

  const handleRefreshList = () => {
    refetch();
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
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Mail className={`h-4 w-4 ${isRefreshing ? 'animate-pulse' : ''}`} />
            {isRefreshing ? 'Buscando...' : 'Buscar Novos Emails'}
          </button>
        </div>
      </div>

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
            <CheckCheck className="h-4 w-4" />
            {markReadMutation.isPending ? 'Marcando...' : 'Marcar Todos como Lido'}
          </button>
          <button
            onClick={() => archiveMutation.mutate(selectedPriority)}
            disabled={archiveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <ArchiveX className="h-4 w-4" />
            {archiveMutation.isPending ? 'Arquivando...' : 'Arquivar Todos'}
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
                className="p-4 bg-card rounded-xl border hover:shadow-md transition-shadow"
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
                        {new Date(email.date).toLocaleDateString('pt-BR')}
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

                  {/* Action indicator */}
                  <div className="text-right">
                    <span className={cn(
                      "text-xs font-medium",
                      email.classification.requiresAction ? "text-orange-500" : "text-green-500"
                    )}>
                      {email.classification.requiresAction ? "Requer ação" : "Sem ação"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
