import { LANE_CONFIGS } from '../hooks/useSimulation.js';

export default function LaneRow({ lane, laneIndex }) {
  const cfg = LANE_CONFIGS[lane.type];
  const color = cfg.color;
  const utilPct = Math.round(lane.utilization * 100);
  const utilColor = lane.utilization > 0.9 ? 'var(--crit)' : lane.utilization > 0.7 ? 'var(--warn)' : 'var(--ok)';

  return (
    <div className="lane-row">
      <span className="lane-num">#{laneIndex + 1}</span>

      {/* Queue tokens — outlined style */}
      <div className="lane-queue-area">
        {lane.queueLength === 0 && !lane.isBusy && <span className="lane-idle">idle</span>}
        {lane.queueMembers.map(m => (
          <div
            key={m.id}
            className="member-token"
            style={{ background: color + '22', color, border: `1px solid ${color}33` }}
            title={`${m.items} items · waiting ${Math.round(m.waitSoFar)}s`}
          >
            <span style={{ color, fontWeight: 700 }}>{m.items}</span>
          </div>
        ))}
        {lane.hasOverflow && <div className="queue-overflow">+{lane.overflowCount}</div>}
      </div>

      {lane.queueLength > 0 && <span className="lane-arrow">›</span>}

      {/* Register */}
      <div className="register" style={lane.isBusy ? { borderColor: color + '55', color } : {}}>
        {lane.isBusy && lane.currentMember ? (
          <>
            <div className="reg-header">
              <span className="reg-type" style={{ color }}>{cfg.name.split(' ')[0]}</span>
              <span className="reg-member">#{lane.currentMember.id} · {lane.currentMember.items}i</span>
            </div>
            <div className="reg-prog-track">
              <div className="reg-prog-fill" style={{ width: `${lane.serviceProgress * 100}%`, background: color }} />
            </div>
            <div className="reg-prog-meta">
              <span className="reg-meta">{Math.round(lane.serviceProgress * 100)}%</span>
              <span className="reg-meta">{Math.round(lane.currentMember.timeRemaining)}s left</span>
            </div>
          </>
        ) : (
          <div className="reg-open">OPEN</div>
        )}
      </div>

      {/* Mini stats */}
      <div className="lane-mini">
        <span className="mini-label">Served: <strong>{lane.totalServed}</strong></span>
        <span className="mini-label">Queue: <strong>{lane.queueLength}</strong></span>
        <div className="mini-util">
          <div className="mini-util-fill" style={{ width: `${utilPct}%`, background: utilColor }} />
        </div>
        <span className="mini-label">{utilPct}% util</span>
      </div>
    </div>
  );
}
