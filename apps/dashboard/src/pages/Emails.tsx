import { useQuery } from '@tanstack/react-query';
import { 
  Mail, 
  AlertCircle, 
  Clock, 
  Archive, 
  Eye,
  User,
  Calendar,
  Tag,
  RefreshCw
} from 'lucide-react';
import { useState } from 'react';
import { cn, apiRequest } from '@/lib/utils';

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

export function Emails() {
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: () => apiRequest<EmailsResponse>('/emails'),
    refetchInterval: 30000,
  });

  const emails = data?.emails || [];
  const filteredEmails = selectedPriority 
    ? emails.filter(e => e.classification.priority === selectedPriority)
    : emails;

  const handleFetchEmails = async () => {
    await apiRequest('/emails/fetch', { method: 'POST' });
    setTimeout(() => refetch(), 2000);
  };

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
        <button
          onClick={handleFetchEmails}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Filters */}
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
          Todos ({emails.length})
        </button>
        {Object.entries(priorityConfig).map(([key, config]) => {
          const count = emails.filter(e => e.classification.priority === key).length;
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
