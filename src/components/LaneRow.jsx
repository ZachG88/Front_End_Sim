import { LANE_CONFIGS } from '../hooks/useSimulation.js';

// Deterministic but visually varied colors per member ID
const TOKEN_COLORS = [
  '#1D4ED8', '#6D28D9', '#BE185D', '#B45309',
  '#0F766E', '#7C3AED', '#C2410C', '#1E40AF',
  '#15803D', '#9333EA',
];

function MemberToken({ member }) {
  const bg = TOKEN_COLORS[member.id % TOKEN_COLORS.length];
  const waitSecs = Math.round(member.waitSoFar);
  const waitStr = waitSecs < 60
    ? `${waitSecs}s`
    : `${Math.floor(waitSecs / 60)}m ${waitSecs % 60}s`;

  return (
    <div
      className="member-token"
      style={{ background: bg }}
      title={`#${member.id}  ·  ${member.items} items  ·  waiting ${waitStr}`}
    >
      {member.items}
    </div>
  );
}

export default function LaneRow({ lane, laneIndex }) {
  const cfg = LANE_CONFIGS[lane.type];
  const { currentMember, serviceProgress, queueMembers, hasOverflow, overflowCount } = lane;
  const progressPct = Math.round(serviceProgress * 100);
  const color = cfg.color;

  return (
    <div className="lane-row">
      <span className="lane-num">#{laneIndex + 1}</span>

      {/* Queue */}
      <div className="lane-queue-area">
        {queueMembers.length === 0 && !currentMember && (
          <span className="lane-idle-text">idle</span>
        )}
        {queueMembers.map(m => (
          <MemberToken key={m.id} member={m} />
        ))}
        {hasOverflow && (
          <div className="queue-overflow" title={`${overflowCount} more waiting`}>
            +{overflowCount}
          </div>
        )}
      </div>

      <span className="lane-flow-arrow">›</span>

      {/* Register */}
      <div
        className={`register-box ${currentMember ? 'busy' : ''}`}
        style={{ '--lane-color': color }}
      >
        {currentMember ? (
          <>
            <div className="reg-top">
              <span className="reg-label" style={{ color }}>
                {cfg.name}
              </span>
              <span className="reg-member">
                #{currentMember.id} · {currentMember.items} items
              </span>
            </div>
            <div className="reg-progress-track">
              <div
                className="reg-progress-fill"
                style={{ width: `${progressPct}%`, background: color }}
              />
            </div>
            <div className="reg-progress-meta">
              <span className="reg-meta-text">{Math.ceil(currentMember.timeRemaining)}s left</span>
              <span className="reg-meta-text" style={{ color }}>{progressPct}%</span>
            </div>
          </>
        ) : (
          <div className="reg-idle">Available</div>
        )}
      </div>

      {/* Mini stats */}
      <div className="lane-mini-stats">
        <span className="mini-stat"><strong>{lane.totalServed}</strong> served</span>
        <span className="mini-stat">Q: <strong>{lane.queueLength}</strong></span>
        <div className="mini-util-track">
          <div
            className="mini-util-fill"
            style={{ width: `${Math.round(lane.utilization * 100)}%`, background: color }}
          />
        </div>
        <span className="mini-stat">{Math.round(lane.utilization * 100)}% util</span>
      </div>
    </div>
  );
}
