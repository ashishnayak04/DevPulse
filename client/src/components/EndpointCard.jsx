import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Globe, ArrowRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

export const EndpointCard = ({ endpoint }) => {
  const navigate = useNavigate();
  const isUp = endpoint.status === 'UP';

  return (
    <Card
      className="endpoint-card animate-fade-in"
      hover
      onClick={() => navigate(`/endpoints/${endpoint.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/endpoints/${endpoint.id}`);
        }
      }}
    >
      <div className="endpoint-card__top">
        <div className="endpoint-card__info">
          <div className="endpoint-card__name">{endpoint.name}</div>
          <div className="endpoint-card__url">{endpoint.url}</div>
        </div>
        <Badge tone={isUp ? 'up' : 'down'} dot pulse>
          {isUp ? 'Operational' : 'Down'}
        </Badge>
      </div>

      <div className="endpoint-card__footer">
        <div className="endpoint-card__meta">
          <div className="endpoint-card__meta-item">
            <Clock size={13} />
            {endpoint.lastChecked
              ? new Date(endpoint.lastChecked).toLocaleString()
              : 'Never checked'}
          </div>
          {endpoint.lastResponseTime != null && (
            <div className="endpoint-card__meta-item">
              <Globe size={13} />
              {Math.round(endpoint.lastResponseTime)}ms
            </div>
          )}
        </div>
        <span className="endpoint-card__arrow">
          <ArrowRight size={16} />
        </span>
      </div>
    </Card>
  );
};
