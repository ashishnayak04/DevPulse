import React from 'react';

export const Sparkline = ({ data, color = 'var(--accent)', width = 88, height = 26 }) => {
  if (!data || data.length === 0) return null;

  const values = data.slice(-28);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padY = 3;
  const stepX = width / (values.length - 1 || 1);
  const toY = (v) => height - padY - ((v - min) / range) * (height - padY * 2);

  const points = values.map((v, i) => `${(i * stepX).toFixed(2)},${toY(v).toFixed(2)}`).join(' ');
  const lastPoint = values.length > 0 ? `${width},${toY(values[values.length - 1]).toFixed(2)}` : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polygon
        points={`0,${height} ${points} ${lastPoint.split(',')[0]},${height}`}
        fill={color}
        opacity="0.12"
      />
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
