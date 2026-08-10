import React from 'react';

const toneMap = {
  up: 'badge--up',
  down: 'badge--down',
  warning: 'badge--warning',
  neutral: 'badge--neutral',
  accent: 'badge--accent',
};

const dotToneMap = {
  up: 'status-dot--up',
  down: 'status-dot--down',
  warning: 'status-dot--warning',
  neutral: 'status-dot--neutral',
  accent: 'status-dot--up',
};

export const Badge = ({ tone = 'neutral', dot = false, pulse = false, children, className = '', ...props }) => (
  <span className={`badge ${toneMap[tone] || toneMap.neutral} ${className}`.trim()} {...props}>
    {dot && (
      <span className={`status-dot ${dotToneMap[tone] || dotToneMap.neutral} ${pulse ? 'status-dot--pulse' : ''}`} />
    )}
    {children}
  </span>
);

export const StatusPill = ({ status, pulse = false, label }) => {
  const isUp = status === 'UP';
  return (
    <Badge tone={isUp ? 'up' : 'down'} dot pulse={pulse}>
      {label || (isUp ? 'Operational' : 'Down')}
    </Badge>
  );
};
