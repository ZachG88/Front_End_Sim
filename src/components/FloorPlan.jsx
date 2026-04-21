import { useMemo } from 'react';
import { LANE_CONFIGS } from '../hooks/useSimulation.js';

// ─── Light-theme colors for floor plan ────────────────────────────────────────
const FP_BG          = '#f0f2f5';   // whole floor
const FP_STORE_BG    = '#1a1a2e';   // store interior (dark accent, matches topbar)
const FP_CHECKOUT_BG = '#ffffff';   // checkout lane area
const FP_EXIT_BG     = '#f8fafc';   // exit walkway
const FP_BELT        = '#dde0e5';   // conveyor belt
const FP_BELT_LINE   = '#c8ccd4';   // belt lines
const FP_REG_EMPTY   = '#e8eaed';   // idle register
const FP_LANE_DIV    = '#e4e7ed';   // lane divider lines
const FP_SEP         = '#d1d5db';   // group separator

// ─── Layout constants ─────────────────────────────────────────────────────────
const LANE_W       = 46;    // px per lane (including half-divider on each side)
const GROUP_GAP    = 22;    // extra gap between lane type groups
const PAD_X        = 28;    // horizontal padding
const HEADER_H     = 52;    // space for group-type labels + top store label
const STORE_H      = 56;    // store interior zone at the very top
const FOOTER_H     = 60;    // zone below registers (exit walkway, labels)
const REGISTER_H   = 22;    // height of register counter block
const REGISTER_W   = 32;    // width of register counter block
const BELT_H       = 10;    // conveyor belt strip just above register
const DOT_R        = 5;     // member dot radius
const DOT_SPACING  = 14;    // center-to-center of stacked dots
const SVG_H        = 520;   // total SVG height

const QUEUE_TOP    = HEADER_H + STORE_H;
const REGISTER_Y   = SVG_H - FOOTER_H - REGISTER_H;
const BELT_Y       = REGISTER_Y - BELT_H;
const QUEUE_BOT    = BELT_Y - DOT_SPACING * 0.5;
const QUEUE_H      = QUEUE_BOT - QUEUE_TOP;
const MAX_DOTS     = Math.floor(QUEUE_H / DOT_SPACING);

// ─── Compute lane layout ──────────────────────────────────────────────────────
function computeLayout(lanes) {
  const groups = [
    { type: 'traditional',   lanes: lanes.filter(l => l.type === 'traditional') },
    { type: 'self-checkout', lanes: lanes.filter(l => l.type === 'self-checkout') },
    { type: 'prescan',       lanes: lanes.filter(l => l.type === 'prescan') },
  ].filter(g => g.lanes.length > 0);

  let x = PAD_X;
  const lanePositions = {}; // laneId -> { cx, lx } (center-x, left-x)
  const groupMeta = [];

  groups.forEach((g, gi) => {
    if (gi > 0) x += GROUP_GAP;
    const startX = x;

    g.lanes.forEach(lane => {
      lanePositions[lane.id] = { cx: x + LANE_W / 2, lx: x };
      x += LANE_W;
    });

    groupMeta.push({
      type: g.type,
      startX,
      endX: x,
      centerX: (startX + x) / 2,
      count: g.lanes.length,
    });
  });

  const totalContentWidth = x;
  const svgWidth = Math.max(totalContentWidth + PAD_X, 360);

  return { groups, groupMeta, lanePositions, svgWidth };
}

// ─── Helper: dot opacity based on queue position ──────────────────────────────
function dotOpacity(index, total) {
  const frac = total > 1 ? index / (total - 1) : 0;
  return 0.95 - frac * 0.35;
}

// ─── Floor tile pattern def ───────────────────────────────────────────────────
function TilePattern({ id }) {
  return (
    <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill={FP_BG} />
      <rect x="0.5" y="0.5" width="39" height="39" fill="none" stroke="#e2e5ea" strokeWidth="0.5" />
    </pattern>
  );
}

// ─── Individual lane column rendering ────────────────────────────────────────
function LaneColumn({ lane, pos }) {
  const cfg = LANE_CONFIGS[lane.type];
  const { cx, lx } = pos;
  const color = cfg.color;

  const visibleDots = lane.queueMembers.slice(0, MAX_DOTS);
  const overflowCount = Math.max(0, lane.queueLength - MAX_DOTS);
  const registerX = cx - REGISTER_W / 2;

  return (
    <g>
      {/* Lane background */}
      <rect
        x={lx + 1}
        y={HEADER_H + STORE_H}
        width={LANE_W - 2}
        height={REGISTER_Y - (HEADER_H + STORE_H) + REGISTER_H}
        fill={color} fillOpacity="0.04"
        rx="2"
      />

      {/* Conveyor belt strip */}
      <rect x={registerX} y={BELT_Y} width={REGISTER_W} height={BELT_H} fill={FP_BELT} rx="2" />
      {[0, 1, 2].map(i => (
        <line
          key={i}
          x1={registerX + 6 + i * 9} y1={BELT_Y + 2}
          x2={registerX + 6 + i * 9} y2={BELT_Y + BELT_H - 2}
          stroke={FP_BELT_LINE} strokeWidth="1.5" strokeLinecap="round"
        />
      ))}

      {/* Register counter */}
      <rect
        x={registerX} y={REGISTER_Y}
        width={REGISTER_W} height={REGISTER_H}
        fill={lane.isBusy ? color : FP_REG_EMPTY}
        rx="3"
        style={{ transition: 'fill 0.3s' }}
      />

      {/* Register label */}
      <text
        x={cx} y={REGISTER_Y + REGISTER_H * 0.62}
        textAnchor="middle" fontSize="7" fontWeight="700"
        fill={lane.isBusy ? '#fff' : '#9ca3af'}
        style={{ userSelect: 'none' }}
      >
        {lane.isBusy ? (lane.currentMember?.items ?? '') : 'OPEN'}
      </text>

      {/* Service progress bar */}
      {lane.isBusy && (
        <rect
          x={registerX + 2} y={REGISTER_Y + REGISTER_H - 4}
          width={(REGISTER_W - 4) * lane.serviceProgress} height={3}
          fill="rgba(255,255,255,0.6)" rx="1"
          style={{ transition: 'width 0.1s linear' }}
        />
      )}

      {/* Pulse ring when busy */}
      {lane.isBusy && (
        <circle
          cx={cx} cy={REGISTER_Y + REGISTER_H / 2}
          r={REGISTER_W / 2 + 3}
          fill="none" stroke={color} strokeWidth="1.5" opacity="0.35"
          style={{ animation: 'svgPulse 2s ease-in-out infinite' }}
        />
      )}

      {/* Queue member dots (stacked upward from register) */}
      {visibleDots.map((member, i) => {
        const dotY = QUEUE_BOT - i * DOT_SPACING;
        const op = dotOpacity(visibleDots.length - 1 - i, visibleDots.length);
        return (
          <g key={member.id}>
            <circle cx={cx} cy={dotY} r={DOT_R} fill={color} opacity={op} />
            <text
              x={cx} y={dotY + 3.5}
              textAnchor="middle" fontSize="5.5" fontWeight="700"
              fill="rgba(255,255,255,0.9)"
              style={{ userSelect: 'none' }}
            >
              {member.items > 9 ? '!' : member.items}
            </text>
          </g>
        );
      })}

      {/* Overflow count */}
      {overflowCount > 0 && (
        <text
          x={cx} y={QUEUE_TOP + 14}
          textAnchor="middle" fontSize="8" fontWeight="700"
          fill={color}
          style={{ userSelect: 'none' }}
        >
          +{overflowCount}
        </text>
      )}

      {/* Lane divider line */}
      <line
        x1={lx + LANE_W} y1={HEADER_H + STORE_H + 4}
        x2={lx + LANE_W} y2={SVG_H - FOOTER_H - 4}
        stroke={FP_LANE_DIV} strokeWidth="1"
      />
    </g>
  );
}

// ─── Main FloorPlan component ─────────────────────────────────────────────────
export default function FloorPlan({ display }) {
  const layout = useMemo(() => {
    if (!display) return null;
    return computeLayout(display.lanes);
  }, [display?.lanes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!display || !layout) {
    return (
      <div className="floor-plan-wrap">
        <div className="empty-state">Press Start to begin the simulation</div>
      </div>
    );
  }

  if (display.lanes.length === 0) {
    return (
      <div className="floor-plan-wrap">
        <div className="empty-state">Add lanes in the control panel to begin</div>
      </div>
    );
  }

  const { groupMeta, lanePositions, svgWidth } = layout;

  return (
    <div className="floor-plan-wrap">
      <div className="floor-plan-svg-container">
        <svg
          viewBox={`0 0 ${svgWidth} ${SVG_H}`}
          style={{ width: svgWidth, height: SVG_H, maxWidth: '100%', display: 'block', borderRadius: 10, overflow: 'hidden' }}
        >
          <defs>
            <TilePattern id="floor-tile" />
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Background floor ── */}
          <rect width={svgWidth} height={SVG_H} fill="url(#floor-tile)" />

          {/* ── Checkout area background (white card zone) ── */}
          <rect x={0} y={HEADER_H + STORE_H} width={svgWidth} height={SVG_H - HEADER_H - STORE_H} fill={FP_CHECKOUT_BG} />

          {/* ── Checkout area group tints ── */}
          {groupMeta.map(g => (
            <rect
              key={`bg-${g.type}`}
              x={g.startX} y={HEADER_H + STORE_H}
              width={g.endX - g.startX}
              height={SVG_H - (HEADER_H + STORE_H) - FOOTER_H}
              fill={LANE_CONFIGS[g.type].color} fillOpacity="0.04"
            />
          ))}

          {/* ── Store interior zone ── */}
          <rect x={0} y={0} width={svgWidth} height={HEADER_H + STORE_H} fill={FP_STORE_BG} />
          <text
            x={svgWidth / 2} y={HEADER_H + STORE_H / 2 + 5}
            textAnchor="middle" fontSize="10" fontWeight="700"
            fill="rgba(255,255,255,0.18)" letterSpacing="0.3em"
            style={{ userSelect: 'none' }}
          >
            STORE INTERIOR
          </text>
          <line x1={0} y1={HEADER_H + STORE_H} x2={svgWidth} y2={HEADER_H + STORE_H} stroke="#e4e7ed" strokeWidth="1.5" />

          {/* ── Group type label bars ── */}
          {groupMeta.map(g => {
            const cfg = LANE_CONFIGS[g.type];
            const barY = 10;
            return (
              <g key={g.type}>
                <rect x={g.startX} y={barY} width={g.endX - g.startX - 2} height={26} rx="4" fill={cfg.dimColor} />
                <text
                  x={g.centerX} y={barY + 17}
                  textAnchor="middle" fontSize="9.5" fontWeight="700"
                  fill={cfg.color} letterSpacing="0.08em"
                  style={{ userSelect: 'none' }}
                >
                  {cfg.name.toUpperCase()}
                </text>
                <text
                  x={g.endX - 5} y={barY + 17}
                  textAnchor="end" fontSize="8" fill={cfg.color} opacity="0.6"
                  style={{ userSelect: 'none' }}
                >
                  {g.count}L
                </text>
              </g>
            );
          })}

          {/* ── Group separators ── */}
          {groupMeta.slice(0, -1).map((g, i) => (
            <line
              key={`sep-${i}`}
              x1={g.endX + GROUP_GAP / 2} y1={HEADER_H + STORE_H + 8}
              x2={g.endX + GROUP_GAP / 2} y2={SVG_H - FOOTER_H - 8}
              stroke={FP_SEP} strokeWidth="1.5" strokeDasharray="4 5"
            />
          ))}

          {/* ── Lanes ── */}
          {display.lanes.map(lane => {
            const pos = lanePositions[lane.id];
            if (!pos) return null;
            return <LaneColumn key={lane.id} lane={lane} pos={pos} />;
          })}

          {/* ── Register row label ── */}
          <text
            x={PAD_X - 4} y={REGISTER_Y + REGISTER_H / 2 + 4}
            textAnchor="end" fontSize="8" fontWeight="700"
            fill="#c8ccd4" letterSpacing="0.08em"
            style={{ userSelect: 'none' }}
          >
            REG
          </text>

          {/* ── Bottom exit zone ── */}
          <rect x={0} y={SVG_H - FOOTER_H} width={svgWidth} height={FOOTER_H} fill={FP_EXIT_BG} />
          <line x1={0} y1={SVG_H - FOOTER_H} x2={svgWidth} y2={SVG_H - FOOTER_H} stroke="#e4e7ed" strokeWidth="1.5" />

          {/* Exit arrows */}
          {[0.25, 0.5, 0.75].map((frac, i) => {
            const ax = svgWidth * frac;
            const ay = SVG_H - FOOTER_H / 2;
            return (
              <g key={i} opacity="0.3">
                <line x1={ax} y1={ay - 8} x2={ax} y2={ay + 8} stroke="#9ca3af" strokeWidth="1.5" />
                <line x1={ax - 5} y1={ay + 3} x2={ax} y2={ay + 8} stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
                <line x1={ax + 5} y1={ay + 3} x2={ax} y2={ay + 8} stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            );
          })}
          <text
            x={svgWidth / 2} y={SVG_H - FOOTER_H / 2 + 4}
            textAnchor="middle" fontSize="9" fontWeight="600"
            fill="#9ca3af" letterSpacing="0.2em"
            style={{ userSelect: 'none' }}
          >
            EXIT
          </text>

          {/* ── Legend ── */}
          {(() => {
            const types = Object.entries(LANE_CONFIGS).filter(([type]) =>
              display.lanes.some(l => l.type === type)
            );
            const legendW = 110;
            const legendH = types.length * 18 + 14;
            const lx = svgWidth - legendW - 8;
            const ly = SVG_H - FOOTER_H - legendH - 8;
            return (
              <g>
                <rect x={lx} y={ly} width={legendW} height={legendH} rx="5" fill="white" opacity="0.92" stroke="#e4e7ed" strokeWidth="1" />
                {types.map(([type, cfg], i) => (
                  <g key={type}>
                    <circle cx={lx + 12} cy={ly + 11 + i * 18} r={4} fill={cfg.color} />
                    <text x={lx + 22} y={ly + 15 + i * 18} fontSize="8.5" fontWeight="500" fill="#6b7280" style={{ userSelect: 'none' }}>
                      {cfg.name}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
