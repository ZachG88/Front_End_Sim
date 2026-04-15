import { PRESETS } from '../hooks/useSimulation.js';

// Preset color swatches (replaces emoji)
const PRESET_COLORS = {
  'normal-weekday':  '#2563EB',
  'busy-saturday':   '#C8102E',
  'prescan-pilot':   '#16A34A',
  'self-checkout':   '#7C3AED',
  'peak-holiday':    '#EA580C',
  'off-hours':       '#475569',
};

function SliderRow({ label, value, min, max, step = 1, unit = '', thumbClass = '', onChange, formatValue }) {
  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-val">{display}</span>
      </div>
      <input
        type="range"
        className={thumbClass}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function LaneStepper({ label, color, value, onChange }) {
  return (
    <div className="lane-stepper">
      <div className="lane-type-swatch" style={{ background: color }} />
      <span className="lane-stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
        >
          −
        </button>
        <span className="stepper-val">{value}</span>
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.min(20, value + 1))}
          disabled={value === 20}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ControlPanel({ config, updateConfig, applyPreset, onReset }) {
  function handleLaneChange(key, val) {
    onReset({ ...config, [key]: val });
  }

  const formatEff = v => {
    const pct = Math.round(v * 100);
    if (v < 0.8) return `${pct}%  slow`;
    if (v > 1.1) return `${pct}%  fast`;
    return `${pct}%`;
  };

  const formatSpeed = v => `${v}×`;

  return (
    <div className="control-panel">

      {/* ── Presets ──────────────────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Quick Presets</div>
        <div className="presets-grid">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className="preset-btn"
              onClick={() => applyPreset(p)}
              title={p.label}
            >
              <div
                className="preset-icon"
                style={{ background: PRESET_COLORS[p.id] ?? '#334155' }}
              />
              <span className="preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Lane Configuration ───────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Lane Configuration</div>
        <div className="lane-steppers">
          <LaneStepper
            label="Traditional"
            color="var(--trad)"
            value={config.traditionalLanes}
            onChange={v => handleLaneChange('traditionalLanes', v)}
          />
          <LaneStepper
            label="Self-Checkout"
            color="var(--sc)"
            value={config.selfCheckoutLanes}
            onChange={v => handleLaneChange('selfCheckoutLanes', v)}
          />
          <LaneStepper
            label="Prescan"
            color="var(--pre)"
            value={config.prescanLanes}
            onChange={v => handleLaneChange('prescanLanes', v)}
          />
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 7, lineHeight: 1.4 }}>
          Lane changes reset the simulation.
        </p>
      </div>

      {/* ── Member Flow ──────────────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Member Flow</div>

        <SliderRow
          label="Arrival Rate"
          value={config.arrivalRate}
          min={1} max={30} unit=" / min"
          onChange={v => updateConfig({ arrivalRate: v })}
        />
        <SliderRow
          label="Avg Items per Cart"
          value={config.avgItemsPerCart}
          min={3} max={50} unit=" items"
          onChange={v => updateConfig({ avgItemsPerCart: v })}
        />

        <div className="slider-row">
          <div className="slider-header">
            <span className="slider-label">Member Limit</span>
            <span className="slider-val">
              {config.memberLimit === 0 ? '∞' : config.memberLimit}
            </span>
          </div>
          <input
            type="range"
            min={0} max={500} step={10}
            value={config.memberLimit}
            onChange={e => updateConfig({ memberLimit: Number(e.target.value) })}
          />
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 3 }}>
            {config.memberLimit === 0 ? 'Runs until paused' : `Stops after ${config.memberLimit} members`}
          </div>
        </div>
      </div>

      {/* ── Service Parameters ───────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Service Parameters</div>
        <SliderRow
          label="Staff Efficiency"
          value={config.efficiency}
          min={0.5} max={1.5} step={0.05}
          thumbClass="thumb-green"
          formatValue={formatEff}
          onChange={v => updateConfig({ efficiency: v })}
        />
      </div>

      {/* ── Simulation Speed ─────────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Simulation Speed</div>
        <SliderRow
          label="Speed"
          value={config.speedMultiplier}
          min={1} max={60}
          thumbClass="thumb-blue"
          formatValue={formatSpeed}
          onChange={v => updateConfig({ speedMultiplier: v })}
        />
      </div>

      {/* ── Queue Policy ─────────────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Queue Assignment</div>
        <div className="policy-toggle">
          <button
            className={`policy-btn ${config.queuePolicy === 'shortest' ? 'active' : ''}`}
            onClick={() => updateConfig({ queuePolicy: 'shortest' })}
          >
            Shortest Queue
          </button>
          <button
            className={`policy-btn ${config.queuePolicy === 'random' ? 'active' : ''}`}
            onClick={() => updateConfig({ queuePolicy: 'random' })}
          >
            Random Lane
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 5, lineHeight: 1.4 }}>
          {config.queuePolicy === 'shortest'
            ? 'Members join the lane with lowest estimated wait.'
            : 'Members pick a lane at random — more realistic for busy stores.'}
        </p>
      </div>

      {/* ── Service Time Guide ───────────────────────────────────────── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Est. Service Time</div>
        {[
          { label: 'Traditional',   color: 'var(--trad)', base: 48, perItem: 3.8 },
          { label: 'Self-Checkout', color: 'var(--sc)',   base: 65, perItem: 7.5 },
          { label: 'Prescan',       color: 'var(--pre)',  base: 18, perItem: 0.4 },
        ].map(({ label, color, base, perItem }) => {
          const sec = Math.round((base + config.avgItemsPerCart * perItem) / config.efficiency);
          const min = Math.floor(sec / 60);
          const s   = sec % 60;
          const str = min > 0 ? `${min}m ${s}s` : `${s}s`;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-mid)', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-hi)', fontVariantNumeric: 'tabular-nums' }}>
                {str}
              </span>
            </div>
          );
        })}
        <p style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 4 }}>
          At {config.avgItemsPerCart} items, {Math.round(config.efficiency * 100)}% efficiency.
        </p>
      </div>
    </div>
  );
}
