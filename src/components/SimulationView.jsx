import { LANE_CONFIGS } from '../hooks/useSimulation.js';
import LaneRow from './LaneRow.jsx';

function LaneGroup({ type, lanes }) {
  const cfg = LANE_CONFIGS[type];
  if (!lanes.length) return null;

  const totalServed = lanes.reduce((s, l) => s + l.totalServed, 0);
  const totalQueued = lanes.reduce((s, l) => s + l.queueLength, 0);
  const busyCount   = lanes.filter(l => l.isBusy).length;

  return (
    <div className="lane-group">
      <div className="lane-group-header">
        <div className="lane-group-type-bar" style={{ background: cfg.color }} />
        <div>
          <div className="lane-group-name" style={{ color: cfg.color }}>
            {cfg.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 1 }}>
            {cfg.description}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-lo)' }}>
            {busyCount} / {lanes.length} active
          </span>
          <span
            className="lane-group-badge"
            style={{
              background: cfg.dimColor,
              color: cfg.color,
            }}
          >
            {totalServed} served · {totalQueued} queued
          </span>
        </div>
      </div>

      {lanes.map((lane, i) => (
        <LaneRow key={lane.id} lane={lane} laneIndex={i} />
      ))}
    </div>
  );
}

export default function SimulationView({ display }) {
  if (!display) {
    return (
      <div className="sim-view">
        <div className="empty-state">
          <div style={{ fontSize: 28, opacity: 0.4 }}>—</div>
          <span>Press Start to begin the simulation</span>
        </div>
      </div>
    );
  }

  const { lanes, finished, stats } = display;

  const byType = {
    traditional:    lanes.filter(l => l.type === 'traditional'),
    'self-checkout': lanes.filter(l => l.type === 'self-checkout'),
    prescan:        lanes.filter(l => l.type === 'prescan'),
  };

  const totalLanes = lanes.length;

  if (totalLanes === 0) {
    return (
      <div className="sim-view">
        <div className="empty-state">
          <span>Add lanes in the control panel to begin</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-view">
      {finished && (
        <div className="finished-banner">
          <div style={{ flex: 1 }}>
            <div className="finished-banner-title">Simulation Complete</div>
            <div className="finished-banner-sub">
              {stats.served} members served · avg wait {display.stats.avgWaitStr} · peak wait {display.stats.maxWaitStr}
            </div>
          </div>
        </div>
      )}

      <LaneGroup type="traditional"    lanes={byType['traditional']} />
      <LaneGroup type="self-checkout"  lanes={byType['self-checkout']} />
      <LaneGroup type="prescan"        lanes={byType['prescan']} />

      <div className="sim-footer">
        <span>{totalLanes} lanes total · {totalLanes - stats.totalServing} idle</span>
        <span>
          {[
            { key: 'traditional', label: 'Traditional' },
            { key: 'self-checkout', label: 'Self-Checkout' },
            { key: 'prescan', label: 'Prescan' },
          ]
            .filter(t => byType[t.key].length > 0)
            .map(t => `${byType[t.key].length} ${t.label}`)
            .join(' · ')}
        </span>
        <span>Queue policy: {display.stats ? 'Shortest Queue' : '—'}</span>
      </div>
    </div>
  );
}
