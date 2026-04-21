export default function Header({ display, running, onToggle, onReset }) {
  const served = display?.stats?.served ?? 0;
  const statusClass = !display ? 'stopped' : display.finished ? 'finished' : running ? 'running' : 'paused';
  const statusLabel = !display ? 'Ready' : display.finished ? 'Complete' : running ? 'Running' : 'Paused';

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 001.97 1.61h9.72a2 2 0 001.97-1.61L23 6H6"/>
        </svg>
      </div>
      <div className="topbar-brand">
        <div className="topbar-title">COSTCO</div>
        <div className="topbar-sub">Checkout Simulator</div>
      </div>
      <div className="topbar-divider"/>
      <div className="status-pill">
        <div className={`status-dot ${statusClass}`}/>
        {statusLabel}
      </div>
      <div className="sim-clock">
        <div className="sim-clock-label">Sim Time</div>
        <div className="sim-clock-val">{display?.simTimeStr ?? '0m 00s'}</div>
      </div>
      <div className="sim-clock">
        <div className="sim-clock-label">Members</div>
        <div className="sim-clock-val">{(display?.stats.totalArrived ?? 0).toLocaleString()}</div>
      </div>
      <div className="topbar-spacer"/>
      <div className="topbar-actions">
        <button className="tbtn tbtn-ghost" onClick={onReset}>↺ Reset</button>
        <button
          className={`tbtn ${running ? 'tbtn-pause' : 'tbtn-run'}`}
          onClick={onToggle}
          disabled={display?.finished}
        >
          {running ? '⏸ Pause' : served > 0 ? '▶ Resume' : '▶ Start'}
        </button>
      </div>
    </header>
  );
}
