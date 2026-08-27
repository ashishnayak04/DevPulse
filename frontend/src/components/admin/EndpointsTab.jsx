import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Server } from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusPill } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatInterval, formatRelative } from '../../utils/time';

export const EndpointsTab = ({ endpoints }) => {
  const navigate = useNavigate();

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {endpoints.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No endpoints on the platform"
          description="Endpoints users create will appear here."
        />
      ) : (
        <div className="board">
          <div className="board__head board__head--admin-endpoints">
            <span className="board__head-cell">Endpoint</span>
            <span className="board__head-cell">Owner</span>
            <span className="board__head-cell">Status</span>
            <span className="board__head-cell">Response</span>
            <span className="board__head-cell">Interval</span>
            <span className="board__head-cell">Created</span>
          </div>
          {endpoints.map((ep) => (
            <div
              className="board__row board__row--admin-endpoints"
              key={ep.id}
              onClick={() => navigate(`/endpoints/${ep.id}`)}
            >
              <span className={`board__rail ${ep.status === 'DOWN' ? 'board__rail--down' : ''}`} />
              <div className="board__cell">
                <div className="board__name">{ep.name}</div>
                <div className="board__url">{ep.url}</div>
              </div>
              <div className="board__cell">
                <span className="board__value">{ep.user?.username}</span>
              </div>
              <div className="board__cell">
                <StatusPill status={ep.status} pulse={ep.isActive} />
              </div>
              <div className="board__cell">
                <span className={`board__latency-value ${ep.pingLogs?.[0]?.isUp === false ? 'board__latency-value--down' : ''}`}>
                  {ep.pingLogs?.[0] ? `${Math.round(ep.pingLogs[0].responseTimeMs)}ms` : '—'}
                </span>
              </div>
              <div className="board__cell">
                <span className="board__value">{formatInterval(ep.intervalMs)}</span>
              </div>
              <div className="board__cell">
                <span className="board__value board__value--muted">{formatRelative(ep.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
