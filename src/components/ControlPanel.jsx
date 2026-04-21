import { PRESETS } from '../hooks/useSimulation.js';

const PRESET_COLORS = {
  'normal-weekday': '#2563EB',
  'busy-saturday':  '#E31837',
  'prescan-pilot':  '#16a34a',
  'self-checkout':  '#7c3aed',
  'peak-holiday':   '#ea580c',
  'off-hours':      '#475569',
};

function SliderRow({ label, value, min, max, step = 1, unit = '', thumbClass = '', onChange, formatValue }) {
  const disp = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-val">{disp}</span>
      </div>
      <input type="range" className={thumbClass} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function LaneStepper({ label, color, value, onChange }) {
  return (
    <div className="lane-stepper">
      <div className="lane-swatch" style={{ background: color }} />
      <span className="lane-stepper-label">{label}</span>
      <div className="stepper-controls">
        <button className="stepper-btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}>−</button>
        <span className="stepper-val">{value}</span>
        <button className="stepper-btn" onClick={() => onChange(Math.min(20, value + 1))} disabled={value === 20}>+</button>
      </div>
    </div>
  );
}

export default function ControlPanel({ config, updateConfig, applyPreset, onReset }) {
  const fmtEff = v => {
    const p = Math.round(v * 100);
    if (v < 0.8) return `${p}%  slow`;
    if (v > 1.1) return `${p}%  fast`;
    return `${p}%`;
  };

  return (
    <div className="sidebar">
      {/* Presets */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Quick Presets</div>
        <div className="presets-grid">
          {PRESETS.map(p => (
            <button key={p.id} className="preset-btn" onClick={() => applyPreset(p)}>
              <div className="preset-icon" style={{ background: PRESET_COLORS[p.id] ?? '#6b7280' }} />
              <span className="preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lane config */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Lane Configuration</div>
        <div className="lane-steppers">
          <LaneStepper label="Traditional"   color="#2563EB" value={config.traditionalLanes}  onChange={v => onReset({ ...config, traditionalLanes: v })} />
          <LaneStepper label="Self-Checkout" color="#E31837" value={config.selfCheckoutLanes} onChange={v => onReset({ ...config, selfCheckoutLanes: v })} />
          <LaneStepper label="Prescan"       color="#16a34a" value={config.prescanLanes}       onChange={v => onReset({ ...config, prescanLanes: v })} />
        </div>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 7, lineHeight: 1.5 }}>Lane changes reset the simulation.</p>
      </div>

      {/* Member flow */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Member Flow</div>
        <SliderRow label="Arrival Rate"       value={config.arrivalRate}     min={1}  max={30} unit=" / min" onChange={v => updateConfig({ arrivalRate: v })} />
        <SliderRow label="Avg Items per Cart" value={config.avgItemsPerCart} min={3}  max={50} unit=" items" onChange={v => updateConfig({ avgItemsPerCart: v })} />
        <div className="slider-row">
          <div className="slider-header">
            <span className="slider-label">Member Limit</span>
            <span className="slider-val">{config.memberLimit === 0 ? '∞' : config.memberLimit}</span>
          </div>
          <input type="range" min={0} max={500} step={10} value={config.memberLimit} onChange={e => updateConfig({ memberLimit: Number(e.target.value) })} />
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
            {config.memberLimit === 0 ? 'Runs until paused' : `Stops after ${config.memberLimit} members`}
          </div>
        </div>
      </div>

      {/* Service */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Service Parameters</div>
        <SliderRow label="Staff Efficiency" value={config.efficiency} min={0.5} max={1.5} step={0.05} thumbClass="thumb-green" formatValue={fmtEff} onChange={v => updateConfig({ efficiency: v })} />
      </div>

      {/* Speed */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Simulation Speed</div>
        <SliderRow label="Speed" value={config.speedMultiplier} min={1} max={60} thumbClass="thumb-blue" formatValue={v => `${v}×`} onChange={v => updateConfig({ speedMultiplier: v })} />
      </div>

      {/* Queue policy */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Queue Assignment</div>
        <div className="policy-toggle">
          <button className={`policy-btn${config.queuePolicy === 'shortest' ? ' active' : ''}`} onClick={() => updateConfig({ queuePolicy: 'shortest' })}>Shortest Queue</button>
          <button className={`policy-btn${config.queuePolicy === 'random'   ? ' active' : ''}`} onClick={() => updateConfig({ queuePolicy: 'random' })}>Random Lane</button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
          {config.queuePolicy === 'shortest' ? 'Members join lane with lowest estimated wait.' : 'Members pick a lane at random.'}
        </p>
      </div>

      {/* Service guide */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Est. Service Time</div>
        {[
          { label: 'Traditional',   color: '#2563EB', base: 90,  perItem: 3.24 },
          { label: 'Self-Checkout', color: '#E31837', base: 120, perItem: 6.36 },
          { label: 'Prescan',       color: '#16a34a', base: 18,  perItem: 1.62 },
        ].map(({ label, color, base, perItem }) => {
          const sec = Math.round((base + config.avgItemsPerCart * perItem) / config.efficiency);
          const str = sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
          return (
            <div key={label} className="svc-guide-row">
              <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{str}</span>
            </div>
          );
        })}
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
          {config.avgItemsPerCart} items · {Math.round(config.efficiency * 100)}% efficiency
        </p>
      </div>
    </div>
  );
}
