import Sparkline from './Sparkline.jsx';

export default function Statistics({ display }) {
  if (!display) return null;
  const { stats, waitHistory } = display;

  const waitColor  = stats.avgWait > 300  ? 'var(--crit)' : stats.avgWait > 120  ? 'var(--warn)' : 'var(--ok)';
  const thruColor  = stats.throughput > 200 ? 'var(--ok)' : stats.throughput > 80 ? 'var(--warn)' : 'var(--info)';
  const utilPct    = Math.round(stats.utilization * 100);
  const utilColor  = stats.utilization > 0.9 ? 'var(--crit)' : stats.utilization > 0.7 ? 'var(--warn)' : 'var(--ok)';

  const cards = [
    { label: 'Members Served', value: stats.served.toLocaleString(), sub: `of ${stats.totalArrived.toLocaleString()} arrived`, accent: 'var(--ok)' },
    { label: 'Avg Wait Time',  value: stats.avgWaitStr,              sub: 'time in queue',   accent: waitColor },
    { label: 'Avg Service',    value: stats.avgServiceStr,            sub: 'time at register', accent: 'var(--trad)' },
    { label: 'Throughput',     value: stats.throughput > 0 ? `${stats.throughput}/hr` : '—', sub: 'rolling 5-min', accent: thruColor },
  ];

  return (
    <div className="kpi-row">
      {cards.map((c, i) => (
        <div key={i} className="kpi-card">
          <div className="kpi-accent" style={{ background: c.accent }} />
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}

      {/* Utilization card with bar */}
      <div className="kpi-card">
        <div className="kpi-accent" style={{ background: utilColor }} />
        <div className="kpi-label">Lane Utilization</div>
        <div className="kpi-value">{utilPct}%</div>
        <div className="util-bar-wrap">
          <div className="util-bar-track">
            <div className="util-bar-fill" style={{ width: `${utilPct}%`, background: utilColor }} />
          </div>
        </div>
        <div className="kpi-sub">{stats.totalServing} of {stats.totalLanes} active</div>
      </div>
    </div>
  );
}
