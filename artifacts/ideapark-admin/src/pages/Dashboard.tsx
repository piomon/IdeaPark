import { useEffect, useState } from 'react';
import { AdminOverview, getOverview, formatDate } from '../lib/api';
import { Shell } from '../components/Shell';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';

function statusBadge(status: string) {
  if (status === 'upcoming' || status === 'active') return 'badge-blue';
  if (status === 'completed') return 'badge-neutral';
  if (status === 'cancelled') return 'badge-amber';
  return 'badge-neutral';
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    upcoming: 'Nadchodzace',
    active: 'Aktywne',
    completed: 'Zakonczone',
    cancelled: 'Anulowane',
  };
  return map[status] ?? status;
}

export function Dashboard() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverview().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return (
    <Shell
      title="Dashboard"
      subtitle="Przeglad stanu systemu — Osiedle IDEA, Radom"
    >
      {loading || !data ? (
        <div className="loading-state">
          <div className="spinner" />
          Ladowanie danych...
        </div>
      ) : (
        <>
          <div className="hero-panel">
            <div>
              <h2>
                Witaj z powrotem w{' '}
                <span style={{ color: 'var(--blue)' }}>{data.tenant.name}</span>
              </h2>
              <p>
                Pilotaz systemu IdeaPark jest aktywny. Monitoruj rezerwacje, miejsca i ruch
                gosci w czasie rzeczywistym — wszystko w jednym miejscu.
              </p>
            </div>
            <div className="hero-stat-grid">
              {data.metrics.slice(0, 2).map((m) => (
                <div key={m.label} className="hero-stat">
                  <div className="hero-stat-label">{m.label}</div>
                  <div className="hero-stat-value">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-4">
            {data.metrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                accent={m.accent}
              />
            ))}
          </div>

          <div className="grid-2">
            <Card
              title="Ostatnie rezerwacje"
              subtitle="Biezace i nadchodzace rezerwacje"
            >
              {data.recentReservations.length === 0 ? (
                <div className="loading-state">Brak rezerwacji</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Uzytkownik</th>
                        <th>Miejsce</th>
                        <th>Poczatek</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentReservations.map((r) => (
                        <tr key={r.id}>
                          <td>{r.userName}</td>
                          <td><code>{r.spaceCode}</code></td>
                          <td>{formatDate(r.startsAt)}</td>
                          <td>
                            <span className={`badge ${statusBadge(r.status)}`}>
                              {translateStatus(r.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Dziennik aktywnosci" subtitle="Ostatnie akcje w systemie">
              {data.recentAudit.length === 0 ? (
                <div className="loading-state">Brak wpisow</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Akcja</th>
                        <th>Aktor</th>
                        <th>Czas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentAudit.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <code style={{ fontSize: '12px', color: 'var(--emerald)' }}>
                              {a.action}
                            </code>
                          </td>
                          <td>{a.actorName}</td>
                          <td>{formatDate(a.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </Shell>
  );
}
