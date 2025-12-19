import { Route, Switch } from 'wouter';
import { Layout } from './components/Layout';
import { DialogProvider } from './components/Dialog';
import { Dashboard } from './pages/Dashboard';
import { Emails } from './pages/Emails';
import { Agents } from './pages/Agents';
import { Logs } from './pages/Logs';
import { LegalAnalyses } from './pages/LegalAnalyses';
import { StablecoinMonitor } from './pages/StablecoinMonitor';
import { Settings } from './pages/Settings';

function App() {
  return (
    <DialogProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/emails" component={Emails} />
          <Route path="/agents" component={Agents} />
          <Route path="/logs" component={Logs} />
          <Route path="/legal" component={LegalAnalyses} />
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

export default App;
