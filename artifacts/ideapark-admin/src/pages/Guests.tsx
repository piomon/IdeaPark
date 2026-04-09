import { useEffect, useState } from 'react';
import { AdminGuest, getGuests, formatDate } from '../lib/api';
import { Shell } from '../components/Shell';
import { Card } from '../components/Card';

export function Guests() {
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGuests().then((d) => {
      setGuests(d);
      setLoading(false);
    });
  }, []);

  const active = guests.filter((g) => g.status === 'active').length;

  return (
    <Shell
      title="Goscie"
      subtitle="Przepustki goscinne — zarzadzaj dostepem dla odwiedzajacych"
    >
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          Ladowanie danych gosci...
        </div>
      ) : (
        <>
          <div className="grid-4">
            <article className="metric-card accent-neutral">
              <div className="metric-label">Lacznie przepustek</div>
              <div className="metric-value">{guests.length}</div>
            </article>
            <article className="metric-card accent-emerald">
              <div className="metric-label">Aktywnych</div>
              <div className="metric-value">{active}</div>
            </article>
            <article className="metric-card accent-neutral">
              <div className="metric-label">Wygaslych</div>
              <div className="metric-value">{guests.filter((g) => g.status === 'expired').length}</div>
            </article>
            <article className="metric-card accent-amber">
              <div className="metric-label">Anulowanych</div>
              <div className="metric-value">{guests.filter((g) => g.status === 'cancelled').length}</div>
            </article>
          </div>

          <Card title="Lista przepustek goscinnych" subtitle="Kod QR + informacje o gosciu i goszczacym">
            {guests.length === 0 ? (
              <div className="loading-state">Brak przepustek goscinnych</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gosc</th>
                      <th>Tablice</th>
                      <th>Goszczacy</th>
                      <th>Wazna od</th>
                      <th>Wazna do</th>
                      <th>Status</th>
                      <th>Kod QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((g) => (
                      <tr key={g.id}>
                        <td>{g.guestName}</td>
                        <td>
                          <code style={{ color: 'var(--emerald)' }}>{g.plate}</code>
                        </td>
                        <td>{g.hostName}</td>
                        <td>{formatDate(g.validFrom)}</td>
                        <td>{formatDate(g.validTo)}</td>
                        <td>
                          <span
                            className={`badge ${
                              g.status === 'active'
                                ? 'badge-emerald'
                                : g.status === 'expired'
                                ? 'badge-neutral'
                                : 'badge-amber'
                            }`}
                          >
                            {g.status === 'active'
                              ? 'Aktywna'
                              : g.status === 'expired'
                              ? 'Wygasla'
                              : 'Anulowana'}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', color: 'var(--muted)' }}>{g.qrCode}</code>
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
