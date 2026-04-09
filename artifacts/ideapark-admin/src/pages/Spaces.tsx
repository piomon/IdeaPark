import { useEffect, useState } from 'react';
import { AdminSpace, getSpaces } from '../lib/api';
import { Shell } from '../components/Shell';
import { Card } from '../components/Card';

function typeLabel(type: string) {
  const map: Record<string, string> = {
    private: 'Prywatne',
    shared: 'Wspolne',
    guest: 'Goscinne',
  };
  return map[type] ?? type;
}

export function Spaces() {
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSpaces().then((d) => {
      setSpaces(d);
      setLoading(false);
    });
  }, []);

  const available = spaces.filter((s) => !s.isBlocked && s.isReservable).length;
  const blocked = spaces.filter((s) => s.isBlocked).length;
  const total = spaces.length;

  return (
    <Shell
      title="Miejsca parkingowe"
      subtitle="Zarzadzaj przestrzeniami — edytuj, blokuj, przegladaj szczegoly"
    >
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          Ladowanie miejsc...
        </div>
      ) : (
        <>
          <div className="grid-4">
            <article className="metric-card accent-neutral">
              <div className="metric-label">Wszystkich miejsc</div>
              <div className="metric-value">{total}</div>
            </article>
            <article className="metric-card accent-emerald">
              <div className="metric-label">Dostepnych</div>
              <div className="metric-value">{available}</div>
            </article>
            <article className="metric-card accent-amber">
              <div className="metric-label">Zablokowanych</div>
              <div className="metric-value">{blocked}</div>
            </article>
            <article className="metric-card accent-blue">
              <div className="metric-label">Prywatnych</div>
              <div className="metric-value">{spaces.filter((s) => s.type === 'private').length}</div>
            </article>
          </div>

          <Card title="Lista miejsc" subtitle="Pelna lista wszystkich zdefiniowanych miejsc">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Strefa</th>
                    <th>Typ</th>
                    <th>Wlasciciel</th>
                    <th>Rezerwowalne</th>
                    <th>Status</th>
                    <th>Uwagi</th>
                  </tr>
                </thead>
                <tbody>
                  {spaces.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <code style={{ color: 'var(--blue)' }}>{s.code}</code>
                      </td>
                      <td>{s.zone}</td>
                      <td>
                        <span
                          className={`badge ${
                            s.type === 'private'
                              ? 'badge-blue'
                              : s.type === 'guest'
                              ? 'badge-emerald'
                              : 'badge-neutral'
                          }`}
                        >
                          {typeLabel(s.type)}
                        </span>
                      </td>
                      <td>{s.ownerName ?? '—'}</td>
                      <td>{s.isReservable ? '✓' : '—'}</td>
                      <td>
                        <span className={`badge ${s.isBlocked ? 'badge-amber' : 'badge-emerald'}`}>
                          {s.isBlocked ? 'Zablokowane' : 'Aktywne'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {s.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Shell>
  );
}
