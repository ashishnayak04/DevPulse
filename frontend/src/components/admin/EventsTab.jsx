import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Activity as PulseIcon,
  Wifi,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatTime, formatRelative, groupByDay } from '../../utils/time';

export const EventsTab = ({ activity }) => {
  if (!activity) return null;
  const items = [
    ...activity.alerts.map((a) => ({
      id: `alert-${a.id}`,
      time: a.sentAt,
      kind: a.type === 'DOWN' ? 'down' : 'recovery',
      endpointName: a.endpoint?.name || 'Unknown endpoint',
      owner: a.endpoint?.user?.username,
    })),
    ...activity.logs.map((l) => ({
      id: `log-${l.id}`,
      time: l.checkedAt,
      kind: l.isUp ? 'check' : 'failure',
      endpointName: l.endpoint?.name || 'Unknown endpoint',
      owner: l.endpoint?.user?.username,
      meta: l.isUp ? `${Math.round(l.responseTimeMs)}ms` : `HTTP ${l.statusCode ?? 'timeout'}`,
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  const groups = groupByDay(items, (i) => i.time);

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Wifi}
          title="No platform activity yet"
          description="Checks and alerts from every user will stream here."
        />
      </Card>
    );
  }

  return (
    <div className="feed">
      {groups.map((group) => (
        <section className="event-day" key={group.label}>
          <div className="event-day__label">{group.label}</div>
          <Card className="event-list" style={{ padding: 0 }}>
            {group.items.map((item) => (
              <div className={`event ${item.kind === 'down' || item.kind === 'failure' ? 'event--down' : ''}`} key={item.id}>
                <div
                  className={`event__icon ${
                    item.kind === 'down' || item.kind === 'failure'
                      ? 'event__icon--danger'
                      : item.kind === 'recovery'
                      ? 'event__icon--success'
                      : 'event__icon--neutral'
                  }`}
                >
                  {item.kind === 'down' ? <AlertTriangle size={15} /> : item.kind === 'recovery' ? <ShieldCheck size={15} /> : <PulseIcon size={15} />}
                </div>
                <div className="event__body">
                  <div className="event__title">
                    {item.endpointName}
                    <Badge
                      tone={item.kind === 'down' || item.kind === 'failure' ? 'down' : item.kind === 'recovery' ? 'up' : 'neutral'}
                      className="event__badge"
                    >
                      {item.kind === 'down' ? 'DOWN' : item.kind === 'recovery' ? 'RECOVERED' : 'CHECK'}
                    </Badge>
                  </div>
                  <div className="event__url">
                    @{item.owner || 'unknown'}
                    {item.meta ? ` · ${item.meta}` : ''}
                  </div>
                </div>
                <div className="event__time">
                  <div className="event__time-main">{formatTime(item.time)}</div>
                  <div className="event__time-sub">{formatRelative(item.time)}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
};
