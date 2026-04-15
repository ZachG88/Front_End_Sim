export default function Sparkline({ data, color = '#4A90D9', height = 36 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>No data yet…</span>
      </div>
    );
  }

  const w = 400;
  const h = height;
  const pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const linePath = `M ${pts.join(' L ')}`;

  // Filled area under the line
  const fillPath = `M ${pad},${h} L ${pts.join(' L ')} L ${w - pad},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height, display: 'block' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#spark-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
