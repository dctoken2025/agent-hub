import { Route, Switch } from 'wouter';
import { Layout } from './components/Layout';
import { DialogProvider } from './components/Dialog';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { Emails } from './pages/Emails';
import { Agents } from './pages/Agents';
import { Logs } from './pages/Logs';
import { LegalAnalyses } from './pages/LegalAnalyses';
import Financial from './pages/Financial';
import { Tasks } from './pages/Tasks';
import { StablecoinMonitor } from './pages/StablecoinMonitor';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import AgentConfig from './pages/AgentConfig';
import { AIUsage } from './pages/AIUsage';
import { Users } from './pages/Users';
import { Focus } from './pages/Focus';
import { Loader2, AlertCircle, Clock, Timer } from 'lucide-react';

// Banner de trial expirando/expirado
function TrialBanner({ daysRemaining, isExpired }: { daysRemaining: number | null; isExpired: boolean }) {
  if (isExpired) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 lg:pl-64 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">
            <strong>Período de teste encerrado.</strong> Entre em contato para continuar usando os agentes de IA.
          </p>
        </div>
      </div>
    );
  }

  if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 lg:pl-64 bg-orange-500/10 border-b border-orange-500/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <Timer className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-600 dark:text-orange-400">
            <strong>{daysRemaining === 1 ? 'Último dia' : `${daysRemaining} dias restantes`} do período de teste.</strong> Entre em contato para continuar usando após o trial.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// Banner de conta pendente
function AccountPendingBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 lg:pl-64 bg-yellow-500/10 border-b border-yellow-500/20">
      <div className="flex items-center gap-3 px-4 py-3">
        <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          <strong>Conta pendente de aprovação.</strong> Você pode explorar o sistema, mas os agentes 
          só poderão ser ativados após a liberação pelo administrador.
        </p>
      </div>
    </div>
  );
}

// Banner de conta suspensa
function AccountSuspendedBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 lg:pl-64 bg-red-500/10 border-b border-red-500/20">
      <div className="flex items-center gap-3 px-4 py-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-600 dark:text-red-400">
          <strong>Conta suspensa.</strong> Entre em contato com o administrador para mais informações.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isLoading, isAdmin, isTrialExpired, trialDaysRemaining } = useAuth();

  // Loading inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não autenticado - mostra login ou páginas públicas
  if (!user) {
    return (
      <Switch>
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Verifica se deve mostrar banner (trial expirando, trial expirado, pendente ou suspenso)
  const showTrialBanner = !isAdmin && (isTrialExpired || (trialDaysRemaining !== null && trialDaysRemaining <= 3 && trialDaysRemaining > 0));
  const hasBanner = user.accountStatus === 'pending' || user.accountStatus === 'suspended' || showTrialBanner;

  // Autenticado - mostra app
  return (
    <DialogProvider>
      {/* Banners de status da conta */}
      {!isAdmin && showTrialBanner && <TrialBanner daysRemaining={trialDaysRemaining} isExpired={isTrialExpired} />}
      {user.accountStatus === 'pending' && !showTrialBanner && <AccountPendingBanner />}
      {user.accountStatus === 'suspended' && !showTrialBanner && <AccountSuspendedBanner />}
      
      <Layout hasBanner={hasBanner}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/focus" component={Focus} />
          <Route path="/emails" component={Emails} />
          <Route path="/agents" component={Agents} />
          <Route path="/agent-config" component={AgentConfig} />
          <Route path="/logs" component={Logs} />
          <Route path="/legal" component={LegalAnalyses} />
          <Route path="/financial" component={Financial} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/stablecoins" component={StablecoinMonitor} />
          {isAdmin && <Route path="/users" component={Users} />}
          <Route path="/ai-usage" component={AIUsage} />
          <Route path="/settings" component={Settings} />
          <Route>
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Página não encontrada</p>
            </div>
          </Route>
        </Switch>
      </Layout>
    </DialogProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
