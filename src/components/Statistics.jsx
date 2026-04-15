import Sparkline from './Sparkline.jsx';

function StatCard({ label, value, sub, accentColor = 'var(--border-2)' }) {
  return (
    <div className="stat-card" style={{ '--accent-color': accentColor }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function UtilCard({ value, serving, total }) {
  const pct = Math.round(value * 100);
  const barColor = value > 0.9 ? 'var(--crit)' : value > 0.7 ? 'var(--warn)' : 'var(--ok)';

  return (
    <div className="stat-card" style={{ '--accent-color': barColor }}>
      <div className="stat-label">Lane Utilization</div>
      <div className="stat-value">{pct}%</div>
      <div className="util-wrap">
        <div className="util-track">
          <div className="util-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      <div className="stat-sub">{serving} of {total} lanes active</div>
    </div>
  );
}

export default function Statistics({ display }) {
  if (!display) return null;

  const { stats, waitHistory } = display;

  const waitColor = stats.avgWait > 300 ? 'var(--crit)'
    : stats.avgWait > 120 ? 'var(--warn)'
    : 'var(--ok)';

  const throughputColor = stats.throughput > 200 ? 'var(--ok)'
    : stats.throughput > 80 ? 'var(--warn)'
    : 'var(--info)';

  return (
    <div className="stats-panel">

      {/* Primary row */}
      <div className="stats-row stats-row-5">
        <StatCard
          label="Members Served"
          value={stats.served.toLocaleString()}
          sub={`of ${stats.totalArrived} arrived`}
          accentColor="var(--ok)"
        />
        <StatCard
          label="Avg Wait Time"
          value={stats.avgWaitStr}
          sub="time in queue"
          accentColor={waitColor}
        />
        <StatCard
          label="Avg Service Time"
          value={stats.avgServiceStr}
          sub="time at register"
          accentColor="var(--trad)"
        />
        <StatCard
          label="Throughput"
          value={stats.throughput > 0 ? `${stats.throughput} / hr` : '—'}
          sub="rolling 5-min window"
          accentColor={throughputColor}
        />
        <UtilCard
          value={stats.utilization}
          serving={stats.totalServing}
          total={stats.totalLanes}
        />
      </div>

      {/* Secondary row */}
      <div className="stats-row stats-row-4">
        <div className="sparkline-card">
          <div className="sparkline-label">
            Wait Time Trend — last {waitHistory.length} completions
          </div>
          <Sparkline data={waitHistory} color="var(--info)" height={34} />
        </div>

        <StatCard
          label="In Queue"
          value={stats.totalInQueue.toLocaleString()}
          sub="waiting now"
          accentColor="var(--warn)"
        />
        <StatCard
          label="Being Served"
          value={stats.totalServing}
          sub="at registers"
          accentColor="var(--info)"
        />
        <StatCard
          label="Peak Wait"
          value={stats.maxWaitStr}
          sub="longest recorded"
          accentColor={stats.maxWait > 600 ? 'var(--crit)' : 'var(--warn)'}
        />
      </div>
    </div>
  );
}
