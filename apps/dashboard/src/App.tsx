import { Route, Switch } from 'wouter';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Emails } from './pages/Emails';
import { Agents } from './pages/Agents';
import { Settings } from './pages/Settings';

function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/emails" component={Emails} />
        <Route path="/agents" component={Agents} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Página não encontrada</p>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

export default App;
