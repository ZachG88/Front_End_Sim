import { useState, useCallback } from 'react';

// ─── Track definitions — one per controllable parameter ───────────────────────
const TRACKS = [
  { key: 'traditionalLanes',  label: 'Traditional',   color: '#2563EB', min: 0, max: 20, step: 1,    fmtVal: v => String(v) },
  { key: 'selfCheckoutLanes', label: 'Self-Checkout',  color: '#E31837', min: 0, max: 20, step: 1,    fmtVal: v => String(v) },
  { key: 'prescanLanes',      label: 'Prescan',        color: '#16a34a', min: 0, max: 10, step: 1,    fmtVal: v => String(v) },
  { key: 'arrivalRate',       label: 'Arrival /min',   color: '#7c3aed', min: 0.5, max: 30, step: 0.5, fmtVal: v => v.toFixed(1) },
  { key: 'efficiency',        label: 'Efficiency',     color: '#ea580c', min: 0.5, max: 1.5, step: 0.05, fmtVal: v => `${Math.round(v * 100)}%` },
];

// ─── Schedule helpers ─────────────────────────────────────────────────────────
const DEFAULTS = { traditionalLanes: 8, selfCheckoutLanes: 3, prescanLanes: 2, arrivalRate: 4, efficiency: 1.0 };

function buildDefaultSchedule(startHour, endHour) {
  return Array.from({ length: endHour - startHour }, (_, i) => ({
    hour: startHour + i, ...DEFAULTS,
  }));
}

function rebuildSchedule(oldSchedule, newStart, newEnd) {
  const oldMap = Object.fromEntries(oldSchedule.map(e => [e.hour, e]));
  return Array.from({ length: newEnd - newStart }, (_, i) => {
    const h = newStart + i;
    return oldMap[h] ?? { hour: h, ...DEFAULTS };
  });
}

function fmtHour(h) {
  if (h === 0 || h === 24) return '12A';
  if (h === 12) return '12P';
  return h < 12 ? `${h}A` : `${h - 12}P`;
}

// ─── VSlider — invisible range input over custom fill bar ─────────────────────
const SLIDER_H = 88; // px height of track

function VSlider({ value, min, max, step, color, onChange }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="vslider-wrap">
      <div className="vslider-track-bg">
        <div className="vslider-track-fill" style={{ height: `${pct}%`, background: color }} />
      </div>
      <input
        type="range"
        className="vslider-input-v"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ─── Track row — label + one VSlider per hour ─────────────────────────────────
function TrackRow({ track, schedule, onChangeHour }) {
  return (
    <div className="adv-track-row">
      <div className="adv-track-label">
        <span className="adv-track-swatch" style={{ background: track.color }} />
        <span className="adv-track-name">{track.label}</span>
      </div>
      {schedule.map(entry => (
        <div key={entry.hour} className="adv-vslider-col">
          <VSlider
            value={entry[track.key]}
            min={track.min} max={track.max} step={track.step}
            color={track.color}
            onChange={v => onChangeHour(entry.hour, track.key, v)}
          />
          <span className="adv-vslider-val">{track.fmtVal(entry[track.key])}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AdvancedPanel ────────────────────────────────────────────────────────────
export default function AdvancedPanel({ onApply }) {
  const [startHour, setStartHour] = useState(8);
  const [endHour,   setEndHour]   = useState(22);
  const [speedMult, setSpeedMult] = useState(60);
  const [schedule,  setSchedule]  = useState(() => buildDefaultSchedule(8, 22));

  const handleStartHour = useCallback((h) => {
    const s = Math.min(Number(h), endHour - 1);
    setStartHour(s);
    setSchedule(prev => rebuildSchedule(prev, s, endHour));
  }, [endHour]);

  const handleEndHour = useCallback((h) => {
    const e = Math.max(Number(h), startHour + 1);
    setEndHour(e);
    setSchedule(prev => rebuildSchedule(prev, startHour, e));
  }, [startHour]);

  const handleChangeHour = useCallback((hour, key, value) => {
    setSchedule(prev => prev.map(e => e.hour === hour ? { ...e, [key]: value } : e));
  }, []);

  return (
    <div className="adv-panel">

      {/* ── Simulation window ── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Simulation Window</div>
        <div className="adv-range-row">
          <div className="adv-select-wrap">
            <span className="adv-select-label">Start</span>
            <select className="adv-select" value={startHour} onChange={e => handleStartHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{fmtHour(i)}</option>
              ))}
            </select>
          </div>
          <span className="adv-range-dash">–</span>
          <div className="adv-select-wrap">
            <span className="adv-select-label">End</span>
            <select className="adv-select" value={endHour} onChange={e => handleEndHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{fmtHour(i + 1)}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
          {endHour - startHour}h window · {schedule.length} time slots
        </p>
      </div>

      {/* ── Speed ── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Simulation Speed</div>
        <div className="slider-row" style={{ marginBottom: 0 }}>
          <div className="slider-header">
            <span className="slider-label">Speed</span>
            <span className="slider-val">{speedMult}×</span>
          </div>
          <input
            type="range" className="thumb-blue"
            min={1} max={120} step={1}
            value={speedMult}
            onChange={e => setSpeedMult(Number(e.target.value))}
          />
        </div>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
          {endHour - startHour}h simulated in ~{Math.round(((endHour - startHour) * 3600 / speedMult) / 60)}m real time
        </p>
      </div>

      {/* ── Hourly parameter tracks ── */}
      <div className="ctrl-section adv-tracks-section">
        <div className="ctrl-section-title">Hourly Parameters</div>

        {/* Scrollable container: label col is sticky-left */}
        <div className="adv-tracks-outer">
          {/* Hour-axis header */}
          <div className="adv-track-row adv-hour-axis">
            <div className="adv-track-label adv-track-label-sticky" />
            {schedule.map(e => (
              <div key={e.hour} className="adv-vslider-col">
                <span className="adv-hour-label">{fmtHour(e.hour)}</span>
              </div>
            ))}
          </div>

          {/* One row per parameter */}
          {TRACKS.map(track => (
            <TrackRow
              key={track.key}
              track={track}
              schedule={schedule}
              onChangeHour={handleChangeHour}
            />
          ))}
        </div>

        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Scroll right to view all hours. Drag sliders to adjust per-hour values.
        </p>
      </div>

      {/* ── Apply ── */}
      <div className="ctrl-section">
        <button className="adv-apply-btn" onClick={() => onApply({ startHour, endHour, speedMultiplier: speedMult, schedule })}>
          Apply &amp; Start Simulation
        </button>
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
          Runs {fmtHour(startHour)}–{fmtHour(endHour)}, then stops automatically.
        </p>
      </div>
    </div>
  );
}
