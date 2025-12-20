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
import { StablecoinMonitor } from './pages/StablecoinMonitor';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import AgentConfig from './pages/AgentConfig';
import { AIUsage } from './pages/AIUsage';
import { Users } from './pages/Users';
import { Loader2, AlertCircle, Clock } from 'lucide-react';

// Banner de conta pendente
function AccountPendingBanner() {
  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
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
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-600 dark:text-red-400">
          <strong>Conta suspensa.</strong> Entre em contato com o administrador para mais informações.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isLoading, isAdmin, isAccountActive } = useAuth();

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

  // Não autenticado - mostra login
  if (!user) {
    return <Login />;
  }

  // Autenticado - mostra app
  return (
    <DialogProvider>
      {/* Banners de status da conta */}
      {user.accountStatus === 'pending' && <AccountPendingBanner />}
      {user.accountStatus === 'suspended' && <AccountSuspendedBanner />}
      
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/emails" component={Emails} />
          <Route path="/agents" component={Agents} />
          <Route path="/agent-config" component={AgentConfig} />
          <Route path="/logs" component={Logs} />
          <Route path="/legal" component={LegalAnalyses} />
          <Route path="/financial" component={Financial} />
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
