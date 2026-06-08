import React from 'react';

const colorMap = {
  cyan: {
    bg: 'rgba(6, 182, 212, 0.08)',
    border: 'rgba(6, 182, 212, 0.2)',
    text: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.15)',
  },
  emerald: {
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.2)',
    text: '#34d399',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.2)',
    text: '#f87171',
    glow: 'rgba(239, 68, 68, 0.15)',
  },
  purple: {
    bg: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.2)',
    text: '#a78bfa',
    glow: 'rgba(139, 92, 246, 0.15)',
  },
  gray: {
    bg: 'rgba(148, 163, 184, 0.06)',
    border: 'rgba(148, 163, 184, 0.12)',
    text: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.1)',
  },
};

export const StatCard = ({ icon: Icon, label, value, color = 'cyan' }) => {
  const c = colorMap[color] || colorMap.cyan;

  return (
    <div className={`glass-card stat-card stat-card-${color}`} style={{
      padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px',
      position: 'relative', overflow: 'hidden', cursor: 'default',
    }}>
      <div
        className="stat-glow"
        style={{
          position: 'absolute', top: '-60%', right: '-60%', width: '120%', height: '120%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
          opacity: 0, transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </span>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: c.bg, border: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text,
        }}>
          <Icon size={20} />
        </div>
      </div>

      <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', color: c.text }}>
        {value}
      </div>
    </div>
  );
};
