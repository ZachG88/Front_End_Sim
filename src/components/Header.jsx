function CartIcon() {
  return (
    <svg className="icon-cart" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM5.21 4H2V2H0v2h2l3.6 7.59L4.25 14c-.16.28-.25.61-.25.96C4 16.1 4.9 17 6 17h14v-2H6.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.44 4H5.21z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor">
      <path d="M0 0L11 6L0 12V0Z"/>
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor">
      <rect x="0" y="0" width="3.5" height="12" rx="1"/>
      <rect x="7.5" y="0" width="3.5" height="12" rx="1"/>
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 1.5A3.5 3.5 0 119.5 6H8l1.5 1.5L11 6A5 5 0 006 1z" opacity="0"/>
      <path d="M6 0C2.686 0 0 2.686 0 6s2.686 6 6 6c1.453 0 2.784-.52 3.82-1.376l-1.06-1.06A4.474 4.474 0 016 10.5C3.515 10.5 1.5 8.485 1.5 6S3.515 1.5 6 1.5c1.591 0 2.996.829 3.797 2.078L8.25 5.25H12V1.5l-1.374 1.374A5.969 5.969 0 006 0z"/>
    </svg>
  );
}

export default function Header({ display, running, onToggle, onReset }) {
  const time = display?.simTimeStr ?? '0m 00s';
  const served = display?.stats?.served ?? 0;

  let statusLabel = 'Ready';
  let dotClass = 'stopped';
  if (display?.finished)     { statusLabel = 'Finished'; dotClass = 'finished'; }
  else if (running)          { statusLabel = 'Running';  dotClass = 'running'; }
  else if (served > 0)       { statusLabel = 'Paused';   dotClass = 'paused'; }

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo">
          <CartIcon />
        </div>
        <div>
          <div className="header-title-main">COSTCO</div>
          <div className="header-title-sub">Checkout Flow Simulator</div>
        </div>
      </div>

      <div className="header-center">
        <div className="status-pill">
          <div className={`status-dot ${dotClass}`} />
          {statusLabel}
        </div>
        <div className="sim-clock">
          <span className="sim-clock-label">Sim Time</span>
          <span className="sim-clock-value">{time}</span>
        </div>
      </div>

      <div className="header-controls">
        <button
          className={`btn ${running ? 'btn-pause' : 'btn-run'}`}
          onClick={onToggle}
          disabled={display?.finished}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
          {running ? 'Pause' : served > 0 ? 'Resume' : 'Start'}
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          <ResetIcon />
          Reset
        </button>
      </div>
    </header>
  );
}
