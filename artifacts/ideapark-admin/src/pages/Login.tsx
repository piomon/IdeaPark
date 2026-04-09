import { FormEvent, useState } from 'react';
import { useLocation } from 'wouter';
import { login, storeSession } from '../lib/api';

const DEMO_ACCOUNTS = [
  { email: 'admin@ideapark.local', role: 'Admin systemu' },
  { email: 'operator@ideapark.local', role: 'Operator parkingu' },
  { email: 'anna@ideapark.local', role: 'Mieszkanka (wlascicielka miejsca)' },
  { email: 'jan@ideapark.local', role: 'Mieszkaniec (najemca)' },
];

export function Login() {
  const [email, setEmail] = useState('admin@ideapark.local');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      storeSession(data.accessToken, data.user.fullName);
      navigate('/dashboard');
    } catch {
      setError('Nieprawidlowe dane logowania. Sprawdz e-mail i haslo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="kicker">Panel Administracyjny</div>
        <h1>Zaloguj sie do IdeaPark</h1>
        <p>
          System zarzadzania parkingiem pilotazowym — Osiedle IDEA, Radom. Wszystkie dane sa
          przykladowe i sluza wylacznie do demonstracji.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Adres e-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@ideapark.local"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Haslo</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="demo123"
            />
          </div>

          {error && (
            <div className="inline-note" style={{ color: 'var(--amber)' }}>
              {error}
            </div>
          )}

          <div className="cta-row">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Logowanie...' : 'Zaloguj'}
            </button>
          </div>
        </form>

        <div className="inline-note">
          Konta demo — haslo: <strong>demo123</strong>
        </div>

        <div className="helper-grid">
          {DEMO_ACCOUNTS.map((acc) => (
            <div
              key={acc.email}
              className="helper-item"
              style={{ cursor: 'pointer' }}
              onClick={() => setEmail(acc.email)}
            >
              <strong>{acc.email}</strong>
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{acc.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
