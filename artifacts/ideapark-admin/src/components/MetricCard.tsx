import { Accent } from '../lib/api';

export function MetricCard({
  label,
  value,
  accent = 'neutral',
}: {
  label: string;
  value: string | number;
  accent?: Accent;
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">Aktualizacja w czasie rzeczywistym</div>
    </article>
  );
}
