import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Clock, ArrowRight } from 'lucide-react';

export const EndpointCard = ({ endpoint }) => {
  const navigate = useNavigate();
  const isUp = endpoint.status === 'UP';

  return (
    <div
      className="glass-card endpoint-card animate-fade-in"
      onClick={() => navigate(`/endpoints/${endpoint.id}`)}
      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
    >
      <style>{`
        .ep-card-top {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
        }
        .ep-card-info { min-width: 0; flex: 1; }
        .ep-card-name {
          font-size: 17px; font-weight: 600; margin-bottom: 6px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ep-card-url {
          font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ep-card-status {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 100px; flex-shrink: 0;
          font-size: 13px; font-weight: 500;
          background: ${isUp ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};
          border: 1px solid ${isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};
          color: ${isUp ? '#34d399' : '#f87171'};
        }
        .ep-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 16px; border-top: 1px solid var(--border); margin-top: 4px;
        }
        .ep-card-meta {
          display: flex; align-items: center; gap: 16px;
        }
        .ep-card-meta-item {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--text-muted);
        }
        .ep-card-arrow {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(139, 92, 246, 0.06);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); transition: all 0.25s ease;
        }
        .endpoint-card:hover .ep-card-arrow {
          background: rgba(139, 92, 246, 0.12);
          border-color: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }
      `}</style>

      <div className="ep-card-top">
        <div className="ep-card-info">
          <div className="ep-card-name">{endpoint.name}</div>
          <div className="ep-card-url">{endpoint.url}</div>
        </div>
        <div className="ep-card-status">
          <span className={`status-dot ${isUp ? 'status-up pulse' : 'status-down pulse'}`} style={{ width: 8, height: 8 }} />
          {isUp ? 'Operational' : 'Down'}
        </div>
      </div>

      <div className="ep-card-footer">
        <div className="ep-card-meta">
          <div className="ep-card-meta-item">
            <Clock size={13} />
            {endpoint.lastChecked
              ? new Date(endpoint.lastChecked).toLocaleString()
              : 'Never checked'}
          </div>
          {endpoint.lastResponseTime != null && (
            <div className="ep-card-meta-item">
              <Globe size={13} />
              {Math.round(endpoint.lastResponseTime)}ms
            </div>
          )}
        </div>
        <div className="ep-card-arrow">
          <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
};
