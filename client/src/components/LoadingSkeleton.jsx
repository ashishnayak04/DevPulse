import React from 'react';

export const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
  if (type === 'stats') {
    return (
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: 100, height: 16 }} />
            </div>
            <div className="skeleton" style={{ width: 80, height: 36 }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'endpoints') {
    return (
      <div className="endpoints-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="glass-card endpoint-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '60%', height: 18, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '80%', height: 12 }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: 80, height: 14 }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div style={{ padding: '16px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ width: 100, height: 16 }} />
            <div className="skeleton" style={{ width: 60, height: 16 }} />
            <div className="skeleton" style={{ width: 80, height: 16 }} />
            <div className="skeleton" style={{ width: 50, height: 16 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: '100%', height: 60 }} />
      ))}
    </div>
  );
};
