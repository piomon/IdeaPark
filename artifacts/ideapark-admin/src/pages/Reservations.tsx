import { useEffect, useState } from 'react';
import { AdminReservation, getReservations, formatDate } from '../lib/api';
import { Shell } from '../components/Shell';
import { Card } from '../components/Card';

function statusBadge(s: string) {
  if (s === 'upcoming') return 'badge-blue';
  if (s === 'active') return 'badge-emerald';
  if (s === 'completed') return 'badge-neutral';
  if (s === 'cancelled') return 'badge-amber';
  return 'badge-neutral';
}

function translateStatus(s: string) {
  const map: Record<string, string> = {
    upcoming: 'Nadchodzace',
    active: 'Aktywne',
    completed: 'Zakonczone',
    cancelled: 'Anulowane',
  };
  return map[s] ?? s;
}

export function Reservations() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReservations().then((d) => {
      setReservations(d);
      setLoading(false);
    });
  }, []);

  const upcoming = reservations.filter((r) => r.status === 'upcoming').length;
  const active = reservations.filter((r) => r.status === 'active').length;
  const completed = reservations.filter((r) => r.status === 'completed').length;
  const cancelled = reservations.filter((r) => r.status === 'cancelled').length;

  return (
    <Shell
      title="Rezerwacje"
      subtitle="Historia i biezace rezerwacje miejsc parkingowych"
    >
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          Ladowanie rezerwacji...
        </div>
      ) : (
        <>
          <div className="grid-4">
            <article className="metric-card accent-neutral">
              <div className="metric-label">Lacznie</div>
              <div className="metric-value">{reservations.length}</div>
            </article>
            <article className="metric-card accent-blue">
              <div className="metric-label">Nadchodzace</div>
              <div className="metric-value">{upcoming}</div>
            </article>
            <article className="metric-card accent-emerald">
              <div className="metric-label">Aktywne</div>
              <div className="metric-value">{active}</div>
            </article>
            <article className="metric-card accent-amber">
              <div className="metric-label">Anulowane</div>
              <div className="metric-value">{cancelled}</div>
            </article>
          </div>

          <Card title="Historia rezerwacji" subtitle="Wszystkie rezerwacje posortowane od najnowszych">
            {reservations.length === 0 ? (
              <div className="loading-state">Brak rezerwacji</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Uzytkownik</th>
                      <th>Tablice</th>
                      <th>Miejsce</th>
                      <th>Poczatek</th>
                      <th>Koniec</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr key={r.id}>
                        <td>{r.userName}</td>
                        <td>
                          <code style={{ color: 'var(--emerald)' }}>{r.vehiclePlate}</code>
                        </td>
                        <td>
                          <code style={{ color: 'var(--blue)' }}>{r.spaceCode}</code>
                        </td>
                        <td>{formatDate(r.startsAt)}</td>
                        <td>{formatDate(r.endsAt)}</td>
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
        </>
      )}
    </Shell>
  );
}
