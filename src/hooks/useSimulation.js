import { useState, useRef, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICS — same algorithms as costcoSimulator.js, applied per-lane
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(rng) {
  let u, v;
  do { u = rng(); } while (u === 0);
  do { v = rng(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomLognormal(rng, meanLog, sdLog) {
  return Math.exp(meanLog + sdLog * randomNormal(rng));
}

function randomExponential(rng, ratePerSec) {
  let u;
  do { u = rng(); } while (u === 0);
  return -Math.log(u) / ratePerSec;
}

// ─── Service-time parameters ──────────────────────────────────────────────────
const SERVICE_PARAMS = {
  traditional:     { meanLog: 2.9,  sdLog: 0.20, overheadSec: 90  },
  'self-checkout': { meanLog: 2.2,  sdLog: 0.30, overheadSec: 120 },
  prescan:         { meanLog: 3.6,  sdLog: 0.15, overheadSec: 18  },
};

function sampleItems(rng, avgItems) {
  const sdLog  = 0.45;
  const meanLog = Math.log(Math.max(1, avgItems)) - (sdLog * sdLog) / 2;
  return Math.max(1, Math.round(randomLognormal(rng, meanLog, sdLog)));
}

function sampleServiceSec(rng, laneType, items, efficiency) {
  const p      = SERVICE_PARAMS[laneType];
  const logEff = Math.log(Math.max(0.1, efficiency));
  const itemsPerMin = randomLognormal(rng, p.meanLog + logEff, p.sdLog);
  const overheadMin = (p.overheadSec / 60) / efficiency;
  return (items / itemsPerMin + overheadMin) * 60;
}

function expectedServiceSec(laneType, avgItems, efficiency) {
  const p    = SERVICE_PARAMS[laneType];
  const E_rate = Math.exp(p.meanLog + (p.sdLog * p.sdLog) / 2) * efficiency;
  return (avgItems / E_rate + (p.overheadSec / 60) / efficiency) * 60;
}

function sampleInterArrivalSec(rng, ratePerMin) {
  return randomExponential(rng, Math.max(0.001, ratePerMin) / 60);
}

// ─── Routing constants ────────────────────────────────────────────────────────
const SCO_ITEM_LIMIT = 25;

// ─────────────────────────────────────────────────────────────────────────────
// LANE CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

export const LANE_CONFIGS = {
  traditional: {
    name: 'Traditional',
    description: 'Cashier scans items + bagger. Full-service checkout.',
    baseTime: 90,      perItemTime: 3.24,
    color: '#2563EB',  dimColor: '#eff6ff',  cssVar: 'var(--trad)',
  },
  'self-checkout': {
    name: 'Self-Checkout',
    description: 'Member scans own items. Slower per item, no bagger.',
    baseTime: 120,     perItemTime: 6.36,
    color: '#E31837',  dimColor: '#fff0f2',  cssVar: 'var(--sc)',
  },
  prescan: {
    name: 'Prescan',
    description: 'Items scanned via Costco app while shopping. Payment only at kiosk.',
    baseTime: 18,      perItemTime: 1.62,
    color: '#16A34A',  dimColor: '#f0fdf4',  cssVar: 'var(--pre)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIG & PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  traditionalLanes:   8,
  selfCheckoutLanes:  3,
  prescanLanes:       2,
  arrivalRate:        4,
  avgItemsPerCart:    18,
  efficiency:         1.0,
  speedMultiplier:    20,
  memberLimit:        0,
  queuePolicy:        'shortest',
  prescanAdoptionRate: 0.15,
  scoAdoptionRate:    0.25,
};

export const PRESETS = [
  {
    id: 'normal-weekday', label: 'Normal Weekday',
    config: { traditionalLanes: 8, selfCheckoutLanes: 3, prescanLanes: 2, arrivalRate: 4, avgItemsPerCart: 18, efficiency: 1.0, prescanAdoptionRate: 0.15, scoAdoptionRate: 0.25 },
  },
  {
    id: 'busy-saturday', label: 'Busy Saturday',
    config: { traditionalLanes: 16, selfCheckoutLanes: 6, prescanLanes: 3, arrivalRate: 8, avgItemsPerCart: 23, efficiency: 0.88, prescanAdoptionRate: 0.15, scoAdoptionRate: 0.25 },
  },
  {
    id: 'prescan-pilot', label: 'Prescan Pilot',
    config: { traditionalLanes: 6, selfCheckoutLanes: 2, prescanLanes: 8, arrivalRate: 5, avgItemsPerCart: 16, efficiency: 1.0, prescanAdoptionRate: 0.50, scoAdoptionRate: 0.25 },
  },
  {
    id: 'self-checkout', label: 'Self-Checkout Focus',
    config: { traditionalLanes: 6, selfCheckoutLanes: 12, prescanLanes: 0, arrivalRate: 5, avgItemsPerCart: 14, efficiency: 1.0, prescanAdoptionRate: 0.0, scoAdoptionRate: 0.70 },
  },
  {
    id: 'peak-holiday', label: 'Peak Holiday',
    config: { traditionalLanes: 20, selfCheckoutLanes: 8, prescanLanes: 4, arrivalRate: 10, avgItemsPerCart: 26, efficiency: 0.82, prescanAdoptionRate: 0.15, scoAdoptionRate: 0.25 },
  },
  {
    id: 'off-hours', label: 'Off Hours',
    config: { traditionalLanes: 3, selfCheckoutLanes: 2, prescanLanes: 1, arrivalRate: 1.5, avgItemsPerCart: 14, efficiency: 1.1, prescanAdoptionRate: 0.15, scoAdoptionRate: 0.25 },
  },
];

const TICK_MS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION STATE
// ─────────────────────────────────────────────────────────────────────────────

function buildLanes(config) {
  const lanes = [];
  let id = 0;
  const add = (type, count) => {
    for (let i = 0; i < count; i++) {
      lanes.push({
        id: id++, type,
        typeIndex:       i,    // 0-based position within this type (used for scheduled open/close)
        queue:           [],
        currentMemberId: null,
        serviceEndTime:  null,
        totalServed:     0,
        totalBusySec:    0,
        busySince:       null,
      });
    }
  };
  add('traditional',   Math.max(0, config.traditionalLanes  || 0));
  add('self-checkout', Math.max(0, config.selfCheckoutLanes || 0));
  add('prescan',       Math.max(0, config.prescanLanes       || 0));
  return lanes;
}

function initSimState(config) {
  const rng = mulberry32(42);
  return {
    rng,
    time: 0,
    nextMemberId: 1,
    nextArrivalTime: sampleInterArrivalSec(rng, config.arrivalRate),
    members: new Map(),
    lanes: buildLanes(config),
    stats: {
      served: 0, totalArrived: 0, totalWaitSec: 0, totalServiceSec: 0, maxWaitSec: 0,
    },
    completionLog: [],
    waitHistory:   [],
    finished:      false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE HELPERS (advanced mode)
// ─────────────────────────────────────────────────────────────────────────────

// Returns the schedule entry for the current sim time, or null in normal mode.
function getHourEntry(schedule, simTimeSec) {
  if (!schedule) return null;
  const idx = Math.min(Math.floor(simTimeSec / 3600), schedule.schedule.length - 1);
  return schedule.schedule[idx] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING & LANE SELECTION
// ─────────────────────────────────────────────────────────────────────────────

function routeMember(rng, items, config) {
  const hasTrad    = (config.traditionalLanes   || 0) > 0;
  const hasSco     = (config.selfCheckoutLanes  || 0) > 0;
  const hasPrescan = (config.prescanLanes        || 0) > 0;
  const prescanRate = config.prescanAdoptionRate ?? 0.15;
  const scoRate     = config.scoAdoptionRate     ?? 0.25;

  if (hasPrescan && rng() < prescanRate) return 'prescan';
  if (hasSco && items <= SCO_ITEM_LIMIT && rng() < scoRate) return 'self-checkout';
  if (hasTrad)    return 'traditional';
  if (hasPrescan) return 'prescan';
  if (hasSco)     return 'self-checkout';
  return null;
}

function chooseLane(lanes, config, avgItems, simTime) {
  if (!lanes.length) return null;
  if (config.queuePolicy === 'random') {
    return lanes[Math.floor(Math.random() * lanes.length)];
  }
  let best = null, bestScore = Infinity;
  for (const lane of lanes) {
    const remaining = lane.currentMemberId !== null
      ? Math.max(0, lane.serviceEndTime - simTime) : 0;
    const avgSvc = expectedServiceSec(lane.type, avgItems, config.efficiency);
    const score  = remaining + lane.queue.length * avgSvc;
    if (score < bestScore) { bestScore = score; best = lane; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION TICK
// ─────────────────────────────────────────────────────────────────────────────

function tickSim(sim, config, schedule, dt) {
  if (sim.finished) return;
  sim.time += dt;
  const { rng, time, members, lanes, stats } = sim;

  // ── Resolve effective params for this tick ────────────────────────────────
  const entry = getHourEntry(schedule, time);
  const effRate = entry ? entry.arrivalRate      : config.arrivalRate;
  const effEff  = entry ? entry.efficiency       : config.efficiency;
  const effTrad = entry ? entry.traditionalLanes  : (config.traditionalLanes  || 0);
  const effSco  = entry ? entry.selfCheckoutLanes : (config.selfCheckoutLanes || 0);
  const effPre  = entry ? entry.prescanLanes      : (config.prescanLanes      || 0);

  // Open-lane counts by type (for routing + starting service)
  const openCounts = {
    traditional:     effTrad,
    'self-checkout': effSco,
    prescan:         effPre,
  };

  // In schedule mode, stop arrivals after the window ends
  const duration  = schedule ? (schedule.endHour - schedule.startHour) * 3600 : Infinity;
  const pastEnd   = time > duration;
  const atLimit   = config.memberLimit > 0 && stats.totalArrived >= config.memberLimit;

  // ── 1. Generate arrivals ──────────────────────────────────────────────────
  if (!atLimit && !pastEnd) {
    while (sim.nextArrivalTime <= time) {
      const items = sampleItems(rng, config.avgItemsPerCart);

      // Routing uses current-hour open counts to determine available types
      const routeCfg = {
        ...config,
        traditionalLanes: effTrad, selfCheckoutLanes: effSco, prescanLanes: effPre,
      };
      const laneType = routeMember(rng, items, routeCfg);

      if (laneType) {
        // Only route to open lanes (typeIndex < openCount for this hour)
        const eligible = lanes.filter(
          l => l.type === laneType && l.typeIndex < openCounts[laneType]
        );
        const lane = chooseLane(eligible, { ...config, efficiency: effEff }, config.avgItemsPerCart, sim.nextArrivalTime);

        if (lane) {
          const memberId = sim.nextMemberId++;
          members.set(memberId, {
            id: memberId, items,
            arrivalTime:      sim.nextArrivalTime,
            serviceStartTime: null,
          });
          lane.queue.push(memberId);
          stats.totalArrived++;
        }
      }

      if (config.memberLimit > 0 && stats.totalArrived >= config.memberLimit) break;
      sim.nextArrivalTime += sampleInterArrivalSec(rng, effRate);
    }
  }

  // ── 2. Process every lane (all lanes drain, even if now "closed") ─────────
  for (const lane of lanes) {
    // Complete current service if time elapsed
    if (lane.currentMemberId !== null && time >= lane.serviceEndTime) {
      const member  = members.get(lane.currentMemberId);
      const waitSec = member.serviceStartTime - member.arrivalTime;
      const svcSec  = lane.serviceEndTime - member.serviceStartTime;

      stats.served++;
      stats.totalWaitSec    += waitSec;
      stats.totalServiceSec += svcSec;
      if (waitSec > stats.maxWaitSec) stats.maxWaitSec = waitSec;

      lane.totalServed++;
      lane.totalBusySec += lane.serviceEndTime - lane.busySince;
      lane.currentMemberId = null;
      lane.serviceEndTime  = null;
      lane.busySince       = null;

      sim.completionLog.push({ time, waitSec });
      sim.waitHistory.push(waitSec);
      if (sim.waitHistory.length > 80) sim.waitHistory.shift();

      const cutoff = time - 300;
      while (sim.completionLog.length && sim.completionLog[0].time < cutoff) {
        sim.completionLog.shift();
      }
    }

    // Start serving next member (any lane continues serving its own queue)
    if (lane.currentMemberId === null && lane.queue.length > 0) {
      const nextId = lane.queue.shift();
      const member = members.get(nextId);
      member.serviceStartTime = time;
      const svcSec = sampleServiceSec(rng, lane.type, member.items, effEff);
      lane.currentMemberId = nextId;
      lane.serviceEndTime  = time + svcSec;
      lane.busySince       = time;
    }
  }

  // ── 3. Completion checks ──────────────────────────────────────────────────
  const allDrained = lanes.every(l => l.currentMemberId === null && l.queue.length === 0);

  if (config.memberLimit > 0 && stats.totalArrived >= config.memberLimit && allDrained) {
    sim.finished = true;
  }
  if (schedule && pastEnd && allDrained) {
    sim.finished = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(sec) {
  if (sec <= 0) return '0s';
  if (sec < 60)  return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatSimTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatWallClock(simTimeSec, startHour) {
  const totalSec = startHour * 3600 + simTimeSec;
  const h   = Math.floor(totalSec / 3600) % 24;
  const m   = Math.floor((totalSec % 3600) / 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function extractDisplay(sim, config, schedule) {
  const { time, members, lanes, stats, completionLog, waitHistory } = sim;

  // Current hour's open counts (for display — closed lanes shown as "closed")
  const entry = getHourEntry(schedule, time);
  const openCounts = entry
    ? { traditional: entry.traditionalLanes, 'self-checkout': entry.selfCheckoutLanes, prescan: entry.prescanLanes }
    : null;

  const laneDisplays = lanes.map(lane => {
    const current = lane.currentMemberId != null ? members.get(lane.currentMemberId) : null;
    const isOpen  = !openCounts || lane.typeIndex < openCounts[lane.type];

    let serviceProgress = 0;
    if (current) {
      const elapsed = time - current.serviceStartTime;
      const total   = lane.serviceEndTime - current.serviceStartTime;
      serviceProgress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
    }

    const queueMembers = lane.queue.slice(0, 14).map(id => {
      const m = members.get(id);
      return { id: m.id, items: m.items, waitSoFar: time - m.arrivalTime };
    });

    const utilization = time > 0
      ? Math.min(1, (lane.totalBusySec + (lane.busySince != null ? time - lane.busySince : 0)) / time)
      : 0;

    return {
      id: lane.id,
      type: lane.type,
      typeIndex: lane.typeIndex,
      isOpen,
      queueLength:   lane.queue.length,
      queueMembers,
      hasOverflow:   lane.queue.length > 14,
      overflowCount: Math.max(0, lane.queue.length - 14),
      currentMember: current ? {
        id: current.id, items: current.items,
        timeRemaining: Math.max(0, lane.serviceEndTime - time),
      } : null,
      serviceProgress,
      totalServed: lane.totalServed,
      isBusy:      lane.currentMemberId != null,
      utilization,
    };
  });

  const totalInQueue = lanes.reduce((s, l) => s + l.queue.length, 0);
  const totalServing = lanes.filter(l => l.currentMemberId != null).length;
  const totalLanes   = lanes.length;
  const utilization  = totalLanes > 0 ? totalServing / totalLanes : 0;

  const avgWait    = stats.served > 0 ? stats.totalWaitSec    / stats.served : 0;
  const avgService = stats.served > 0 ? stats.totalServiceSec / stats.served : 0;

  const windowSec   = Math.min(time, 300);
  const recentCount = windowSec > 0 ? completionLog.filter(c => c.time >= time - windowSec).length : 0;
  const throughput  = windowSec > 0 ? (recentCount / windowSec) * 3600 : 0;

  const isAdvanced = schedule != null;
  const simTimeStr = isAdvanced
    ? formatWallClock(time, schedule.startHour)
    : formatSimTime(time);

  // Schedule progress (0–1) for header display
  const scheduleProgress = schedule
    ? Math.min(1, time / ((schedule.endHour - schedule.startHour) * 3600))
    : null;

  return {
    time,
    simTimeStr,
    isAdvanced,
    scheduleProgress,
    currentScheduleHour: entry ? entry.hour : null,
    lanes: laneDisplays,
    stats: {
      served:        stats.served,
      totalArrived:  stats.totalArrived,
      totalInQueue,
      totalServing,
      totalLanes,
      utilization,
      avgWait,
      avgWaitStr:    formatDuration(avgWait),
      avgService,
      avgServiceStr: formatDuration(avgService),
      maxWait:       stats.maxWaitSec,
      maxWaitStr:    formatDuration(stats.maxWaitSec),
      throughput:    Math.round(throughput),
      laneCounts: {
        traditional:     lanes.filter(l => l.type === 'traditional').length,
        'self-checkout': lanes.filter(l => l.type === 'self-checkout').length,
        prescan:         lanes.filter(l => l.type === 'prescan').length,
      },
    },
    waitHistory: [...waitHistory],
    finished:    sim.finished,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSimulation() {
  const [config,  setConfig]  = useState(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(null);

  const simRef      = useRef(null);
  const configRef   = useRef(config);
  const scheduleRef = useRef(null); // { startHour, endHour, speedMultiplier, schedule[] }

  useEffect(() => { configRef.current = config; }, [config]);

  // Initialize on mount
  useEffect(() => {
    simRef.current = initSimState(DEFAULT_CONFIG);
    setDisplay(extractDisplay(simRef.current, DEFAULT_CONFIG, null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulation loop
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const sim   = simRef.current;
      const cfg   = configRef.current;
      const sched = scheduleRef.current;
      if (!sim) return;

      const dt = cfg.speedMultiplier * TICK_MS / 1000;
      tickSim(sim, cfg, sched, dt);
      setDisplay(extractDisplay(sim, cfg, sched));

      if (sim.finished) setRunning(false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const reset = useCallback((overrideConfig) => {
    const cfg = overrideConfig ?? configRef.current;
    if (overrideConfig) {
      setConfig(overrideConfig);
      configRef.current = overrideConfig;
    }
    scheduleRef.current = null;
    simRef.current = initSimState(cfg);
    setDisplay(extractDisplay(simRef.current, cfg, null));
    setRunning(false);
  }, []);

  const updateConfig = useCallback((updates) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      configRef.current = next;
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset) => {
    const next = { ...DEFAULT_CONFIG, ...preset.config };
    setConfig(next);
    configRef.current = next;
    scheduleRef.current = null;
    simRef.current = initSimState(next);
    setDisplay(extractDisplay(simRef.current, next, null));
    setRunning(false);
  }, []);

  // Advanced mode: build lanes from max counts, store schedule in ref
  const applyAdvanced = useCallback((advancedCfg) => {
    const { schedule, startHour, endHour, speedMultiplier } = advancedCfg;

    const maxTrad = Math.max(0, ...schedule.map(h => h.traditionalLanes));
    const maxSco  = Math.max(0, ...schedule.map(h => h.selfCheckoutLanes));
    const maxPre  = Math.max(0, ...schedule.map(h => h.prescanLanes));

    const baseConfig = {
      ...DEFAULT_CONFIG,
      traditionalLanes:  maxTrad,
      selfCheckoutLanes: maxSco,
      prescanLanes:      maxPre,
      speedMultiplier,
      memberLimit: 0,
    };

    scheduleRef.current = advancedCfg;
    setConfig(baseConfig);
    configRef.current = baseConfig;
    simRef.current = initSimState(baseConfig);
    setDisplay(extractDisplay(simRef.current, baseConfig, advancedCfg));
    setRunning(true);
  }, []);

  const toggleRunning = useCallback(() => setRunning(r => !r), []);

  return { config, updateConfig, applyPreset, applyAdvanced, running, toggleRunning, display, reset };
}
