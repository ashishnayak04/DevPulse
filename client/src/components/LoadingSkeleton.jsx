import React from 'react';
import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
  if (type === 'stats') {
    return (
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width={96} height={12} />
              <Skeleton width={38} height={38} radius="var(--radius-md)" />
            </div>
            <Skeleton width={70} height={28} />
          </Card>
        ))}
      </div>
    );
  }

  if (type === 'endpoints') {
    return (
      <div className="endpoints-grid">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="endpoint-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Skeleton width="60%" height={16} />
                <div style={{ marginTop: 8 }}>
                  <Skeleton width="80%" height={12} />
                </div>
              </div>
              <Skeleton width={90} height={24} radius="var(--radius-pill)" />
            </div>
            <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <Skeleton width={140} height={12} />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <Card style={{ padding: '16px 20px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Skeleton width={90} height={14} />
            <Skeleton width={60} height={14} />
            <Skeleton width={80} height={14} />
            <Skeleton width={50} height={14} />
          </div>
        ))}
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={64} radius="var(--radius-lg)" />
      ))}
    </div>
  );
};
