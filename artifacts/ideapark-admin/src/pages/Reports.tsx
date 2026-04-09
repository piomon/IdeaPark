import { useEffect, useState } from 'react';
import { AdminReports, getReports } from '../lib/api';
import { Shell } from '../components/Shell';
import { Card } from '../components/Card';

export function Reports() {
  const [data, setData] = useState<AdminReports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReports().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const maxBar = data ? Math.max(...data.monthlyBars.map((b) => b.value), 1) : 1;

  return (
    <Shell
      title="Raporty"
      subtitle="Wskazniki efektywnosci i rekomendacje operacyjne"
    >
      {loading || !data ? (
        <div className="loading-state">
          <div className="spinner" />
          Ladowanie raportow...
        </div>
      ) : (
        <>
          <div className="grid-4">
            {data.kpis.map((kpi) => (
              <article key={kpi.label} className="metric-card accent-blue">
                <div className="metric-label">{kpi.label}</div>
                <div className="metric-value" style={{ fontSize: '26px' }}>{kpi.value}</div>
                <div className="metric-caption">{kpi.helper}</div>
              </article>
            ))}
          </div>

          <div className="grid-2">
            <Card
              title="Trend rezerwacji"
              subtitle="Liczba rezerwacji miesiecznie"
            >
              <div className="bar-stack">
                {data.monthlyBars.map((bar) => (
                  <div className="bar-row" key={bar.label}>
                    <div className="bar-label">
                      <span>{bar.label}</span>
                      <span>{bar.value}</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(bar.value / maxBar) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Rekomendacje"
              subtitle="Sugerowane kolejne kroki operacyjne"
            >
              <ul className="list">
                {data.actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </Shell>
  );
}
