/**
 * costcoSimulator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Discrete-Event Simulation (DES) engine for Costco front-end checkout.
 *
 * USAGE
 * ─────
 *   import { createSimulation } from './costcoSimulator.js';
 *
 *   const sim = createSimulation(config);
 *   sim.reset();
 *
 *   // Animation loop (e.g. requestAnimationFrame or setInterval)
 *   function frame() {
 *     if (sim.isFinished()) return;
 *     const state = sim.tick();   // advance to next DES event
 *     renderUI(state);            // your front-end render call
 *     requestAnimationFrame(frame);
 *   }
 *   frame();
 *
 * CONFIG SHAPE  (all fields optional — defaults shown)
 * ─────────────────────────────────────────────────────
 *   {
 *     // Simulation window
 *     startHour:   8,        // store opens  (0–23)
 *     endHour:     21,       // store closes (0–23)
 *     warmupHour:  9,        // stats reset after warmup (ignore early transients)
 *     seed:        42,       // RNG seed for reproducibility
 *
 *     // Arrival rate: customers per hour for each hour 0–23.
 *     // Values outside [startHour, endHour] are ignored.
 *     arrivalRateByHour: [...],   // see DEFAULT_ARRIVAL_RATES below
 *
 *     // Register pools — each pool is an independent serpentine queue
 *     pools: {
 *       standard: { count: 8,  itemLimit: Infinity, scoMode: false },
 *       express:  { count: 2,  itemLimit: 15,       scoMode: false },
 *       sco:      { count: 4,  itemLimit: 25,       scoMode: true  },
 *     },
 *
 *     // Customer basket size distribution (lognormal params, in items)
 *     basket: { meanLog: 3.3, sdLog: 0.55 },  // ≈ median 27 items
 *
 *     // Service rates (items scanned per minute, lognormal)
 *     serviceRate: {
 *       standard: { meanLog: 2.9, sdLog: 0.2 },   // ≈ 18 items/min
 *       express:  { meanLog: 2.9, sdLog: 0.2 },
 *       sco:      { meanLog: 2.2, sdLog: 0.3 },   // ≈ 9 items/min (slower)
 *     },
 *
 *     // Fixed overhead per transaction (minutes): payment, bagging, greeting
 *     overhead: { standard: 1.5, express: 1.2, sco: 2.0 },
 *
 *     // Fraction of customers willing to use SCO (given eligible basket)
 *     scoAdoptionRate: 0.45,
 *
 *     // Time-series snapshot interval (simulated minutes)
 *     snapshotInterval: 5,
 *
 *     // Max events to process per tick() call (controls animation granularity)
 *     eventsPerTick: 1,
 *   }
 *
 * TICK RETURN VALUE  (SimState)
 * ──────────────────────────────
 *   {
 *     simTime:     210.4,      // current simulated time (minutes from startHour)
 *     wallHour:    11.5,       // simTime expressed as clock hour (11:30)
 *     finished:    false,
 *
 *     // Live queue snapshot (updated every tick)
 *     queues: {
 *       standard: { waiting: 12, inService: 8,  avgWaitMin: 4.2 },
 *       express:  { waiting: 0,  inService: 2,  avgWaitMin: 0.8 },
 *       sco:      { waiting: 3,  inService: 4,  avgWaitMin: 2.1 },
 *     },
 *
 *     // Cumulative KPIs (post-warmup only)
 *     kpis: {
 *       totalServed:       341,
 *       avgWaitMin:        3.8,    // across all pools
 *       avgServiceMin:     5.2,
 *       avgSojournMin:     9.0,    // wait + service
 *       throughputPerHour: 68.2,
 *       utilization: {
 *         standard: 0.82,
 *         express:  0.54,
 *         sco:      0.71,
 *       },
 *     },
 *
 *     // Per-register detail
 *     registers: [
 *       { id: 'std-0', pool: 'standard', busy: true,  customersServed: 42,
 *         currentWaitMin: 0, utilization: 0.84 },
 *       ...
 *     ],
 *
 *     // Time-series log (one entry per snapshotInterval minutes, post-warmup)
 *     timeSeries: [
 *       { simTime: 60, wallHour: 9,
 *         queueLen: { standard: 4, express: 0, sco: 1 },
 *         avgWaitMin: { standard: 2.1, express: 0, sco: 0.9 },
 *         throughputPerHour: 55.0,
 *         utilization: { standard: 0.75, express: 0.4, sco: 0.6 } },
 *       ...
 *     ],
 *   }
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const POOL_TYPES = ['standard', 'express', 'sco'];

/**
 * Default arrival rate (customers/hour) indexed by hour-of-day (0–23).
 * Shaped to reflect a typical high-volume Costco Saturday.
 * Replace with real transaction data for your store format.
 */
const DEFAULT_ARRIVAL_RATES = [
  0,    // 0  midnight
  0,    // 1
  0,    // 2
  0,    // 3
  0,    // 4
  0,    // 5
  0,    // 6
  0,    // 7
  40,   // 8  open
  95,   // 9
  130,  // 10
  155,  // 11
  160,  // 12 lunch peak
  145,  // 13
  135,  // 14
  140,  // 15
  150,  // 16 after-work ramp
  155,  // 17
  140,  // 18
  110,  // 19
  70,   // 20
  20,   // 21 closing
  0,    // 22
  0,    // 23
];

const DEFAULT_CONFIG = {
  startHour:  8,
  endHour:    21,
  warmupHour: 9,
  seed:       42,

  arrivalRateByHour: DEFAULT_ARRIVAL_RATES,

  pools: {
    standard: { count: 8,  itemLimit: Infinity, scoMode: false },
    express:  { count: 2,  itemLimit: Infinity, scoMode: false },
    sco:      { count: 4,  itemLimit: 25,       scoMode: true  },
  },

  basket:      { meanLog: 3.3, sdLog: 0.55 },

  serviceRate: {
    standard: { meanLog: 2.9, sdLog: 0.2  },
    express:  { meanLog: 3.6, sdLog: 0.15 }, // prescan: payment-only, very fast
    sco:      { meanLog: 2.2, sdLog: 0.3  },
  },

  overhead: { standard: 1.5, express: 0.3, sco: 2.0 },

  scoAdoptionRate:   0.45,
  queuePolicy:       'shortest', // 'shortest' | 'random'
  memberLimit:       0,          // 0 = unlimited; N = stop after N arrivals
  snapshotInterval:  5,
  eventsPerTick:     1,
};

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Statistical Distributions ───────────────────────────────────────────────

/**
 * Box–Muller transform → standard normal sample.
 */
function randomNormal(rng) {
  let u, v;
  do { u = rng(); } while (u === 0);
  do { v = rng(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal sample. Returns a value in the same units as exp(meanLog).
 * meanLog and sdLog are the mean and std-dev of the underlying normal (log-space).
 */
function randomLognormal(rng, meanLog, sdLog) {
  return Math.exp(meanLog + sdLog * randomNormal(rng));
}

/**
 * Exponential inter-arrival sample given rate λ (events per minute).
 * Uses inverse-CDF: -ln(U) / λ
 */
function randomExponential(rng, rate) {
  let u;
  do { u = rng(); } while (u === 0);
  return -Math.log(u) / rate;
}

/**
 * Poisson-process inter-arrival time given a (possibly fractional) hourly rate.
 * Converts to per-minute rate before sampling.
 */
function interArrivalMinutes(rng, ratePerHour) {
  if (ratePerHour <= 0) return Infinity;
  return randomExponential(rng, ratePerHour / 60);
}

/**
 * Service duration in minutes for a single customer.
 * serviceDuration = (basketSize / itemsPerMinute) + overhead
 */
function sampleServiceTime(rng, basketSize, poolType, cfg) {
  const { meanLog, sdLog } = cfg.serviceRate[poolType];
  const itemsPerMin = randomLognormal(rng, meanLog, sdLog);
  const scanTime    = basketSize / itemsPerMin;
  const overhead    = cfg.overhead[poolType];
  return Math.max(0.5, scanTime + overhead);
}

// ─── Priority Queue (min-heap) ────────────────────────────────────────────────

class MinHeap {
  constructor() { this._data = []; }

  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    const top  = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  peek() { return this._data[0]; }
  size() { return this._data.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[p].time <= this._data[i].time) break;
      [this._data[p], this._data[i]] = [this._data[i], this._data[p]];
      i = p;
    }
  }

  _siftDown(i) {
    const n = this._data.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._data[l].time < this._data[min].time) min = l;
      if (r < n && this._data[r].time < this._data[min].time) min = r;
      if (min === i) break;
      [this._data[min], this._data[i]] = [this._data[i], this._data[min]];
      i = min;
    }
  }
}

// ─── Event Types ──────────────────────────────────────────────────────────────

const EVT = {
  ARRIVAL:    'ARRIVAL',
  DEPARTURE:  'DEPARTURE',
  SNAPSHOT:   'SNAPSHOT',
  CLOSE:      'CLOSE',
};

// ─── Simulation Factory ───────────────────────────────────────────────────────

/**
 * createSimulation(userConfig) → SimController
 *
 * Returns a controller object with:
 *   .reset()        — (re)initialize; must be called before first tick()
 *   .tick()         → SimState
 *   .isFinished()   → boolean
 *   .getState()     → current SimState without advancing
 *   .getConfig()    → resolved config
 */
export function createSimulation(userConfig = {}) {

  // Deep-merge user config over defaults
  const cfg = deepMerge(DEFAULT_CONFIG, userConfig);

  // ── Internal simulation state (reset on .reset()) ──────────────────────────
  let rng;
  let eventQueue;
  let simTime;
  let finished;
  let warmupDone;

  // Register pools
  // pools[type] = { servers: Register[], queue: Customer[] }
  let pools;

  // Cumulative statistics accumulators (post-warmup)
  let stats;

  // Time-series log
  let timeSeries;

  // Next snapshot time
  let nextSnapshotTime;

  // Cached state object returned by tick/getState
  let cachedState;

  // ── Register model ─────────────────────────────────────────────────────────

  function buildPools() {
    const p = {};
    for (const type of POOL_TYPES) {
      const poolCfg = cfg.pools[type];
      p[type] = {
        queue:   [],      // serpentine queue for this pool
        servers: Array.from({ length: poolCfg.count }, (_, i) => ({
          id:              `${type}-${i}`,
          pool:            type,
          busy:            false,
          busySince:       0,
          totalBusyTime:   0,
          customersServed: 0,
          currentCustomer: null,
        })),
      };
    }
    return p;
  }

  // ── Customer routing logic ─────────────────────────────────────────────────

  /**
   * Determines which pool a customer should join based on basket size,
   * SCO willingness, and pool availability/limits.
   *
   * Priority:
   *   1. Express lane  — if basketSize ≤ express itemLimit AND express has servers
   *   2. SCO           — if basketSize ≤ sco itemLimit AND customer is SCO-willing
   *   3. Standard      — fallback
   */
  function routeCustomer(basketSize) {
    const expressCfg  = cfg.pools.express;
    const scoCfg      = cfg.pools.sco;

    const expressOk = expressCfg.count > 0 && basketSize <= expressCfg.itemLimit;
    const scoOk     = scoCfg.count > 0 && basketSize <= scoCfg.itemLimit;

    if (cfg.queuePolicy === 'random') {
      const eligible = ['standard'];
      if (expressOk) eligible.push('express');
      if (scoOk)     eligible.push('sco');
      return eligible[Math.floor(rng() * eligible.length)];
    }

    // Smart routing: prescan (express) first if eligible, then SCO, then standard
    if (expressOk) return 'express';

    const scoWilling = rng() < cfg.scoAdoptionRate;
    if (scoWilling && scoOk) return 'sco';

    return 'standard';
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleArrival(evt) {
    const basketSize = Math.max(1, Math.round(
      randomLognormal(rng, cfg.basket.meanLog, cfg.basket.sdLog)
    ));
    const poolType   = routeCustomer(basketSize);
    const pool       = pools[poolType];

    const customer = {
      id:          evt.customerId,
      basketSize,
      poolType,
      arrivalTime: simTime,
      queueEntry:  simTime,
      serviceStart: null,
    };

    // Find an idle server in this pool
    const idleServer = pool.servers.find(s => !s.busy);

    if (idleServer) {
      beginService(customer, idleServer, poolType);
    } else {
      // Join serpentine queue for this pool
      pool.queue.push(customer);
    }

    // Schedule next arrival (non-homogeneous Poisson: sample from current hour rate)
    scheduleNextArrival();
  }

  function beginService(customer, server, poolType) {
    const serviceTime = sampleServiceTime(rng, customer.basketSize, poolType, cfg);

    customer.serviceStart = simTime;
    server.busy            = true;
    server.busySince       = simTime;
    server.currentCustomer = customer;
    server.serviceEndTime  = simTime + serviceTime;
    server.totalServiceTime = serviceTime;

    eventQueue.push({
      time:     simTime + serviceTime,
      type:     EVT.DEPARTURE,
      serverId: server.id,
      poolType,
      customer,
      serviceTime,
    });
  }

  function handleDeparture(evt) {
    const { poolType, customer, serviceTime, serverId } = evt;
    const pool   = pools[poolType];
    const server = pool.servers.find(s => s.id === serverId);

    // Accumulate busy time on server
    server.totalBusyTime += simTime - server.busySince;
    server.customersServed++;
    server.busy           = false;
    server.currentCustomer = null;

    // Post-warmup stats
    if (warmupDone) {
      const waitTime    = customer.serviceStart - customer.arrivalTime;
      const sojournTime = simTime - customer.arrivalTime;

      stats.totalServed++;
      stats.sumWait    += waitTime;
      stats.sumService += serviceTime;
      stats.sumSojourn += sojournTime;
      if (waitTime > stats.maxWait) stats.maxWait = waitTime;

      stats.byPool[poolType].served++;
      stats.byPool[poolType].sumWait    += waitTime;
      stats.byPool[poolType].sumService += serviceTime;
    }

    // Pull next customer from this pool's queue
    if (pool.queue.length > 0) {
      const next = pool.queue.shift();
      beginService(next, server, poolType);
    }
  }

  function handleSnapshot() {
    if (!warmupDone) {
      nextSnapshotTime += cfg.snapshotInterval;
      scheduleSnapshot();
      return;
    }
    timeSeries.push(buildSnapshot());
    nextSnapshotTime += cfg.snapshotInterval;
    scheduleSnapshot();
  }

  // ── Event scheduling ───────────────────────────────────────────────────────

  function scheduleNextArrival() {
    // Member limit check
    if (cfg.memberLimit > 0 && stats.totalArrived >= cfg.memberLimit) return;

    const hour = cfg.startHour + simTime / 60;
    const hourIndex = Math.min(23, Math.floor(hour));
    const rate = cfg.arrivalRateByHour[hourIndex] ?? 0;
    const dt   = interArrivalMinutes(rng, rate);
    const next = simTime + dt;
    const endTime = (cfg.endHour - cfg.startHour) * 60;

    if (next < endTime) {
      eventQueue.push({
        time:       next,
        type:       EVT.ARRIVAL,
        customerId: stats.totalArrived++,
      });
    }
  }

  function scheduleSnapshot() {
    const endTime = (cfg.endHour - cfg.startHour) * 60;
    if (nextSnapshotTime < endTime) {
      eventQueue.push({ time: nextSnapshotTime, type: EVT.SNAPSHOT });
    }
  }

  // ── State builders ─────────────────────────────────────────────────────────

  function buildQueueSummary() {
    const summary = {};
    for (const type of POOL_TYPES) {
      const pool        = pools[type];
      const inService   = pool.servers.filter(s => s.busy).length;
      const waiting     = pool.queue.length;
      const poolStats   = stats.byPool[type];
      const avgWait     = poolStats.served > 0
        ? poolStats.sumWait / poolStats.served
        : 0;

      summary[type] = { waiting, inService, avgWaitMin: +avgWait.toFixed(2) };
    }
    return summary;
  }

  function buildKPIs() {
    const elapsed = Math.max(1, simTime - stats.warmupTime);

    const utilization = {};
    for (const type of POOL_TYPES) {
      const pool        = pools[type];
      const totalCapacity = pool.servers.length * elapsed;
      const totalBusy   = pool.servers.reduce((s, r) => s + r.totalBusyTime, 0);
      utilization[type] = +(Math.min(1, totalBusy / totalCapacity)).toFixed(3);
    }

    return {
      totalServed:       stats.totalServed,
      avgWaitMin:        stats.totalServed > 0
        ? +(stats.sumWait    / stats.totalServed).toFixed(2) : 0,
      avgServiceMin:     stats.totalServed > 0
        ? +(stats.sumService / stats.totalServed).toFixed(2) : 0,
      avgSojournMin:     stats.totalServed > 0
        ? +(stats.sumSojourn / stats.totalServed).toFixed(2) : 0,
      throughputPerHour: +((stats.totalServed / elapsed) * 60).toFixed(1),
      maxWaitMin:        +(stats.maxWait).toFixed(2),
      utilization,
    };
  }

  function buildRegisters() {
    const elapsed = Math.max(1, simTime - stats.warmupTime);
    const regs = [];
    for (const type of POOL_TYPES) {
      for (const s of pools[type].servers) {
        const timeRemaining = s.busy ? Math.max(0, s.serviceEndTime - simTime) : 0;
        const progress = s.busy && s.totalServiceTime > 0
          ? Math.min(1, 1 - timeRemaining / s.totalServiceTime)
          : 0;
        regs.push({
          id:              s.id,
          pool:            type,
          busy:            s.busy,
          customersServed: s.customersServed,
          currentWaitMin:  s.busy ? +(simTime - s.busySince).toFixed(2) : 0,
          utilization:     +(Math.min(1, s.totalBusyTime / elapsed)).toFixed(3),
          serviceProgress: +progress.toFixed(3),
          currentCustomer: s.busy && s.currentCustomer ? {
            id:           s.currentCustomer.id,
            basketSize:   s.currentCustomer.basketSize,
            timeRemaining,
            waitSoFar:    simTime - s.currentCustomer.arrivalTime,
          } : null,
        });
      }
    }
    return regs;
  }

  function buildSnapshot() {
    const queueLen      = {};
    const avgWaitMin    = {};
    const utilization   = {};
    const elapsed       = Math.max(1, simTime - stats.warmupTime);

    for (const type of POOL_TYPES) {
      const pool      = pools[type];
      const poolStats = stats.byPool[type];

      queueLen[type]   = pool.queue.length;
      avgWaitMin[type] = poolStats.served > 0
        ? +(poolStats.sumWait / poolStats.served).toFixed(2) : 0;

      const totalBusy     = pool.servers.reduce((s, r) => s + r.totalBusyTime, 0);
      const totalCapacity = pool.servers.length * elapsed;
      utilization[type]   = +(Math.min(1, totalBusy / totalCapacity)).toFixed(3);
    }

    return {
      simTime:          +simTime.toFixed(2),
      wallHour:         +(cfg.startHour + simTime / 60).toFixed(3),
      queueLen,
      avgWaitMin,
      throughputPerHour: +((stats.totalServed / elapsed) * 60).toFixed(1),
      utilization,
    };
  }

  function buildState() {
    // Per-pool queue member snapshots (for visualization)
    const poolQueues = {};
    for (const type of POOL_TYPES) {
      poolQueues[type] = pools[type].queue.slice(0, 30).map(c => ({
        id:        c.id,
        basketSize: c.basketSize,
        waitSoFar:  simTime - c.arrivalTime,
      }));
    }

    return {
      simTime:      +simTime.toFixed(2),
      wallHour:     +(cfg.startHour + simTime / 60).toFixed(3),
      finished,
      queues:       buildQueueSummary(),
      kpis:         buildKPIs(),
      registers:    buildRegisters(),
      timeSeries:   timeSeries.slice(),
      poolQueues,
      totalArrived: stats.totalArrived,
    };
  }

  // ── Warmup reset ───────────────────────────────────────────────────────────

  function checkWarmup() {
    if (!warmupDone && simTime >= (cfg.warmupHour - cfg.startHour) * 60) {
      warmupDone = true;
      stats.warmupTime = simTime;

      // Reset per-pool stats so KPIs only cover post-warmup period
      for (const type of POOL_TYPES) {
        stats.byPool[type] = { served: 0, sumWait: 0, sumService: 0 };
      }
      // Reset server busy-time accumulators so utilization is post-warmup
      for (const type of POOL_TYPES) {
        for (const s of pools[type].servers) {
          s.totalBusyTime = 0;
          s.busySince     = s.busy ? simTime : 0;
        }
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset() {
    rng          = mulberry32(cfg.seed);
    eventQueue   = new MinHeap();
    simTime      = 0;
    finished     = false;
    warmupDone   = false;
    timeSeries   = [];
    pools        = buildPools();

    stats = {
      totalArrived: 0,
      totalServed:  0,
      sumWait:      0,
      sumService:   0,
      sumSojourn:   0,
      maxWait:      0,
      warmupTime:   0,
      byPool: {
        standard: { served: 0, sumWait: 0, sumService: 0 },
        express:  { served: 0, sumWait: 0, sumService: 0 },
        sco:      { served: 0, sumWait: 0, sumService: 0 },
      },
    };

    const endTime = (cfg.endHour - cfg.startHour) * 60;

    // Seed first arrival
    const firstRate = cfg.arrivalRateByHour[cfg.startHour] ?? 0;
    const firstDt   = interArrivalMinutes(rng, firstRate);
    if (firstDt < endTime) {
      eventQueue.push({
        time:       firstDt,
        type:       EVT.ARRIVAL,
        customerId: stats.totalArrived++,
      });
    }

    // Seed first snapshot
    nextSnapshotTime = cfg.snapshotInterval;
    scheduleSnapshot();

    // Schedule store close
    eventQueue.push({ time: endTime, type: EVT.CLOSE });

    cachedState = buildState();
    return cachedState;
  }

  /**
   * tick() — advance simulation by cfg.eventsPerTick events.
   * Returns the updated SimState.
   */
  function tick() {
    if (finished) return cachedState;

    let processed = 0;

    while (processed < cfg.eventsPerTick && eventQueue.size() > 0) {
      const evt = eventQueue.pop();
      simTime   = evt.time;

      checkWarmup();

      switch (evt.type) {
        case EVT.ARRIVAL:   handleArrival(evt);   break;
        case EVT.DEPARTURE: handleDeparture(evt); break;
        case EVT.SNAPSHOT:  handleSnapshot();     break;
        case EVT.CLOSE:
          finished = true;
          // Final snapshot
          if (warmupDone) timeSeries.push(buildSnapshot());
          break;
      }

      processed++;
      if (finished) break;
    }

    if (eventQueue.size() === 0) finished = true;

    cachedState = buildState();
    return cachedState;
  }

  function isFinished() { return finished; }
  function getState()   { return cachedState ?? buildState(); }
  function getConfig()  { return cfg; }

  return { reset, tick, isFinished, getState, getConfig };
}

// ─── Deep merge utility ───────────────────────────────────────────────────────

function deepMerge(base, override) {
  if (override === undefined || override === null) return structuredClone(base);
  if (typeof base !== 'object' || Array.isArray(base)) {
    return override !== undefined ? override : base;
  }
  const result = structuredClone(base);
  for (const key of Object.keys(override)) {
    if (
      typeof override[key] === 'object' &&
      override[key] !== null &&
      !Array.isArray(override[key]) &&
      key in result &&
      typeof result[key] === 'object'
    ) {
      result[key] = deepMerge(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ─── Named export of default arrival rates (useful for UI sliders) ────────────
export { DEFAULT_ARRIVAL_RATES };
