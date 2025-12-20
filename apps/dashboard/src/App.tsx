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
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading } = useAuth();

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
