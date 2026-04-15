import { useState, useRef, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & LANE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 100; // real milliseconds between simulation ticks

export const LANE_CONFIGS = {
  traditional: {
    name: 'Traditional',
    description: 'Cashier scans items + bagger. Full-service checkout.',
    baseTime: 48,      // seconds of overhead (greet, payment, receipt)
    perItemTime: 3.8,  // seconds per item scanned
    color: '#2563EB',
    dimColor: '#0F2760',
    cssVar: 'var(--trad)',
  },
  'self-checkout': {
    name: 'Self-Checkout',
    description: 'Member scans own items. Slower per item, no bagger.',
    baseTime: 65,
    perItemTime: 7.5,
    color: '#C8102E',
    dimColor: '#3E0810',
    cssVar: 'var(--sc)',
  },
  prescan: {
    name: 'Prescan',
    description: 'Items scanned via Costco app while shopping. Payment only at kiosk.',
    baseTime: 18,
    perItemTime: 0.4,
    color: '#16A34A',
    dimColor: '#0A3320',
    cssVar: 'var(--pre)',
  },
};

export const DEFAULT_CONFIG = {
  traditionalLanes: 5,
  selfCheckoutLanes: 3,
  prescanLanes: 2,
  arrivalRate: 6,         // members arriving per sim-minute
  avgItemsPerCart: 18,    // average items per cart
  efficiency: 1.0,        // cashier/system efficiency multiplier (0.5–1.5)
    speedMultiplier: 20,    // sim-seconds per real-second
  memberLimit: 0,         // 0 = run until stopped; N = stop after N members arrive
  queuePolicy: 'shortest',// 'shortest' | 'random'
};

export const PRESETS = [
  {
    id: 'normal-weekday',
    label: 'Normal Weekday',
    config: {
      traditionalLanes: 5,
      selfCheckoutLanes: 4,
      prescanLanes: 2,
      arrivalRate: 5,
      avgItemsPerCart: 17,
      efficiency: 1.0,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
  {
    id: 'busy-saturday',
    label: 'Busy Saturday',
    config: {
      traditionalLanes: 10,
      selfCheckoutLanes: 6,
      prescanLanes: 2,
      arrivalRate: 15,
      avgItemsPerCart: 23,
      efficiency: 0.88,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
  {
    id: 'prescan-pilot',
    label: 'Prescan Pilot',
    config: {
      traditionalLanes: 3,
      selfCheckoutLanes: 2,
      prescanLanes: 10,
      arrivalRate: 8,
      avgItemsPerCart: 16,
      efficiency: 1.0,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
  {
    id: 'self-checkout',
    label: 'Self-Checkout Focus',
    config: {
      traditionalLanes: 2,
      selfCheckoutLanes: 14,
      prescanLanes: 0,
      arrivalRate: 8,
      avgItemsPerCart: 14,
      efficiency: 1.0,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
  {
    id: 'peak-holiday',
    label: 'Peak Holiday',
    config: {
      traditionalLanes: 14,
      selfCheckoutLanes: 8,
      prescanLanes: 4,
      arrivalRate: 22,
      avgItemsPerCart: 26,
      efficiency: 0.82,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
  {
    id: 'off-hours',
    label: 'Off Hours',
    config: {
      traditionalLanes: 3,
      selfCheckoutLanes: 2,
      prescanLanes: 1,
      arrivalRate: 2,
      avgItemsPerCart: 14,
      efficiency: 1.1,
      speedMultiplier: 20,
      memberLimit: 0,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function gaussianRandom() {
  const u1 = Math.max(Math.random(), 1e-10);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getItemCount(avg) {
  // Items are Gaussian around avg with ~35% std dev, minimum 1
  return Math.max(1, Math.round(avg + gaussianRandom() * avg * 0.35));
}

function getServiceTime(laneType, items, efficiency) {
  const cfg = LANE_CONFIGS[laneType];
  const base = cfg.baseTime + items * cfg.perItemTime;
  const jitter = 0.85 + Math.random() * 0.30; // ±15% random variation
  return (base * jitter) / efficiency;
}

function getInterArrivalTime(arrivalRate) {
  // arrivalRate in members/minute → exponential inter-arrival in seconds
  const ratePerSec = Math.max(arrivalRate, 0.01) / 60;
  return -Math.log(Math.max(Math.random(), 1e-10)) / ratePerSec;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION STATE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

function buildLanes(config) {
  const lanes = [];
  let id = 0;
  const add = (type, count) => {
    for (let i = 0; i < count; i++) {
      lanes.push({
        id: id++,
        type,
        queue: [],             // ordered array of member IDs
        currentMemberId: null,
        serviceEndTime: null,
        totalServed: 0,
        idleSince: null,
        totalIdleTime: 0,
      });
    }
  };
  add('traditional', Math.max(0, config.traditionalLanes || 0));
  add('self-checkout', Math.max(0, config.selfCheckoutLanes || 0));
  add('prescan', Math.max(0, config.prescanLanes || 0));
  return lanes;
}

function initSimState(config) {
  return {
    time: 0,
    nextMemberId: 1,
    nextArrivalTime: getInterArrivalTime(config.arrivalRate),
    members: new Map(),
    lanes: buildLanes(config),
    stats: {
      served: 0,
      totalArrived: 0,
      totalWaitTime: 0,
      totalServiceTime: 0,
      maxWaitTime: 0,
      abandonedCount: 0,
    },
    completionLog: [], // { time, waitTime } for throughput window
    waitHistory: [],   // last 80 completed wait times for sparkline
    running: false,
    finished: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

function chooseLane(lanes, config, simTime) {
  if (lanes.length === 0) return null;

  if (config.queuePolicy === 'random') {
    return lanes[Math.floor(Math.random() * lanes.length)];
  }

  // Shortest-queue heuristic: minimize estimated wait
  let bestLane = null;
  let bestScore = Infinity;

  for (const lane of lanes) {
    const qLen = lane.queue.length;
    const remaining = lane.currentMemberId !== null
      ? Math.max(0, lane.serviceEndTime - simTime)
      : 0;
    // Score = current remaining + queue depth × avg service for this type
    const avgSvc = LANE_CONFIGS[lane.type].baseTime + config.avgItemsPerCart * LANE_CONFIGS[lane.type].perItemTime;
    const score = remaining + qLen * avgSvc;

    if (score < bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  return bestLane;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION TICK (mutates sim in place for performance)
// ─────────────────────────────────────────────────────────────────────────────

function tickSim(sim, config, dt) {
  if (sim.finished) return;

  sim.time += dt;
  const { time, members, lanes, stats } = sim;

  // ── 1. Generate new arrivals ────────────────────────────────────────────
  const atLimit = config.memberLimit > 0 && stats.totalArrived >= config.memberLimit;

  if (!atLimit) {
    while (sim.nextArrivalTime <= time) {
      const memberId = sim.nextMemberId++;
      const items = getItemCount(config.avgItemsPerCart);
      const member = {
        id: memberId,
        items,
        arrivalTime: sim.nextArrivalTime,
        queueEnterTime: sim.nextArrivalTime,
        serviceStartTime: null,
        completionTime: null,
        laneId: null,
        status: 'queued',
      };

      const lane = chooseLane(lanes, config, sim.nextArrivalTime);
      if (lane) {
        lane.queue.push(memberId);
        member.laneId = lane.id;
        // Track idle end
        if (lane.currentMemberId === null && lane.idleSince !== null) {
          lane.totalIdleTime += sim.nextArrivalTime - lane.idleSince;
          lane.idleSince = null;
        }
      }

      members.set(memberId, member);
      stats.totalArrived++;

      // Schedule next arrival
      if (config.memberLimit > 0 && stats.totalArrived >= config.memberLimit) break;
      sim.nextArrivalTime += getInterArrivalTime(config.arrivalRate);
    }
  }

  // ── 2. Process each lane ────────────────────────────────────────────────
  for (const lane of lanes) {
    // Complete current service if time has passed
    if (lane.currentMemberId !== null && time >= lane.serviceEndTime) {
      const member = members.get(lane.currentMemberId);
      const waitTime = member.serviceStartTime - member.queueEnterTime;
      const svcTime = lane.serviceEndTime - member.serviceStartTime;

      member.completionTime = lane.serviceEndTime;
      member.status = 'done';

      stats.served++;
      stats.totalWaitTime += waitTime;
      stats.totalServiceTime += svcTime;
      if (waitTime > stats.maxWaitTime) stats.maxWaitTime = waitTime;

      lane.totalServed++;
      lane.currentMemberId = null;
      lane.serviceEndTime = null;

      sim.completionLog.push({ time: lane.serviceEndTime ?? time, waitTime });
      sim.waitHistory.push(waitTime);
      if (sim.waitHistory.length > 80) sim.waitHistory.shift();

      // Prune completion log (keep rolling 5-minute window)
      const cutoff = time - 300;
      while (sim.completionLog.length > 0 && sim.completionLog[0].time < cutoff) {
        sim.completionLog.shift();
      }
    }

    // Start serving next member from queue
    if (lane.currentMemberId === null && lane.queue.length > 0) {
      const nextId = lane.queue.shift();
      const member = members.get(nextId);
      member.status = 'serving';
      member.serviceStartTime = time;

      const svcTime = getServiceTime(lane.type, member.items, config.efficiency);
      lane.currentMemberId = nextId;
      lane.serviceEndTime = time + svcTime;
      lane.idleSince = null;

    } else if (lane.currentMemberId === null && lane.idleSince === null) {
      // Lane just became idle
      lane.idleSince = time;
    }
  }

  // ── 3. Check for simulation completion (limited-member mode) ────────────
  if (config.memberLimit > 0 && stats.totalArrived >= config.memberLimit) {
    const allIdle = lanes.every(l => l.currentMemberId === null && l.queue.length === 0);
    if (allIdle) sim.finished = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT DISPLAY SNAPSHOT (pure, no mutation)
// ─────────────────────────────────────────────────────────────────────────────

function formatSimTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  return `${m}m ${s.toString().padStart(2,'0')}s`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function extractDisplay(sim, config) {
  const { time, members, lanes, stats, completionLog, waitHistory } = sim;

  // Per-lane snapshots
  const laneDisplays = lanes.map(lane => {
    const currentMember = lane.currentMemberId != null ? members.get(lane.currentMemberId) : null;

    let serviceProgress = 0;
    if (currentMember) {
      const elapsed = time - currentMember.serviceStartTime;
      const total = lane.serviceEndTime - currentMember.serviceStartTime;
      serviceProgress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
    }

    const queueMembers = lane.queue.slice(0, 14).map(id => {
      const m = members.get(id);
      return { id: m.id, items: m.items, waitSoFar: time - m.queueEnterTime };
    });

    const totalTime = time;
    const activeTime = totalTime - lane.totalIdleTime - (lane.idleSince != null ? time - lane.idleSince : 0);
    const utilization = totalTime > 0 ? Math.min(1, activeTime / totalTime) : 0;

    return {
      id: lane.id,
      type: lane.type,
      queueLength: lane.queue.length,
      queueMembers,
      hasOverflow: lane.queue.length > 14,
      overflowCount: Math.max(0, lane.queue.length - 14),
      currentMember: currentMember
        ? { id: currentMember.id, items: currentMember.items, timeRemaining: Math.max(0, lane.serviceEndTime - time) }
        : null,
      serviceProgress,
      totalServed: lane.totalServed,
      isBusy: lane.currentMemberId != null,
      utilization,
    };
  });

  // System-wide stats
  const totalInQueue = lanes.reduce((s, l) => s + l.queue.length, 0);
  const totalServing = lanes.filter(l => l.currentMemberId != null).length;
  const totalLanes = lanes.length;
  const utilization = totalLanes > 0 ? totalServing / totalLanes : 0;

  const avgWait = stats.served > 0 ? stats.totalWaitTime / stats.served : 0;
  const avgService = stats.served > 0 ? stats.totalServiceTime / stats.served : 0;

  // Throughput: completions within a rolling 5-minute window
  const windowSec = Math.min(time, 300);
  const recentCount = windowSec > 0 ? completionLog.filter(c => c.time >= time - windowSec).length : 0;
  const throughput = windowSec > 0 ? (recentCount / windowSec) * 3600 : 0;

  // Lane counts by type
  const laneCounts = {
    traditional: lanes.filter(l => l.type === 'traditional').length,
    'self-checkout': lanes.filter(l => l.type === 'self-checkout').length,
    prescan: lanes.filter(l => l.type === 'prescan').length,
  };

  return {
    time,
    simTimeStr: formatSimTime(time),
    lanes: laneDisplays,
    stats: {
      served: stats.served,
      totalArrived: stats.totalArrived,
      totalInQueue,
      totalServing,
      totalLanes,
      utilization,
      avgWait,
      avgWaitStr: formatDuration(avgWait),
      avgService,
      avgServiceStr: formatDuration(avgService),
      maxWait: stats.maxWaitTime,
      maxWaitStr: formatDuration(stats.maxWaitTime),
      throughput: Math.round(throughput),
      laneCounts,
    },
    waitHistory: [...waitHistory],
    finished: sim.finished,
    running: sim.running,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSimulation() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(null);

  const simRef = useRef(null);
  const configRef = useRef(config);
  const runningRef = useRef(running);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // Initialize on mount
  useEffect(() => {
    simRef.current = initSimState(DEFAULT_CONFIG);
    setDisplay(extractDisplay(simRef.current, DEFAULT_CONFIG));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulation loop
  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      const sim = simRef.current;
      const cfg = configRef.current;
      if (!sim) return;

      const dt = cfg.speedMultiplier * TICK_MS / 1000;
      tickSim(sim, cfg, dt);

      setDisplay(extractDisplay(sim, cfg));

      if (sim.finished) {
        setRunning(false);
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [running]);

  const reset = useCallback((overrideConfig) => {
    const cfg = overrideConfig ?? configRef.current;
    simRef.current = initSimState(cfg);
    setDisplay(extractDisplay(simRef.current, cfg));
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
    simRef.current = initSimState(next);
    setDisplay(extractDisplay(simRef.current, next));
    setRunning(false);
  }, []);

  const toggleRunning = useCallback(() => {
    setRunning(r => !r);
  }, []);

  return {
    config,
    updateConfig,
    applyPreset,
    running,
    toggleRunning,
    display,
    reset,
  };
}
