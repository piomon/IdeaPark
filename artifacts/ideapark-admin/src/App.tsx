import { Switch, Route, Redirect } from 'wouter';
import './index.css';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Spaces } from './pages/Spaces';
import { Reservations } from './pages/Reservations';
import { Guests } from './pages/Guests';
import { Reports } from './pages/Reports';
import { ResidentBoard } from './pages/ResidentBoard';
import { AuthGate } from './components/AuthGate';

function isLoggedIn() {
  return Boolean(localStorage.getItem('ideapark_admin_token'));
}

function ProtectedRoute({ component: Comp }: { component: () => React.JSX.Element }) {
  if (!isLoggedIn()) {
    return <Redirect to="/login" />;
  }
  return (
    <AuthGate>
      <Comp />
    </AuthGate>
  );
}

export default function App() {
  return (
    <Switch>
      {/* Resident board — public, no login needed */}
      <Route path="/" component={ResidentBoard} />
      <Route path="/tablica" component={ResidentBoard} />

      {/* Auth */}
      <Route path="/login" component={Login} />

      {/* Admin panel — protected */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/spaces">
        {() => <ProtectedRoute component={Spaces} />}
      </Route>
      <Route path="/reservations">
        {() => <ProtectedRoute component={Reservations} />}
      </Route>
      <Route path="/guests">
        {() => <ProtectedRoute component={Guests} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>

      <Route>
        {() => <Redirect to="/" />}
      </Route>
    </Switch>
  );
}
