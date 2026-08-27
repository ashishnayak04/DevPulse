import React from 'react';
import { History, Power } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatTime, formatRelative } from '../../utils/time';

export const AuditTab = ({ auditLogs }) => {
  if (auditLogs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={History}
          title="No audit entries yet"
          description="Admin actions like role changes, plan changes, and monitoring toggles appear here."
        />
      </Card>
    );
  }

  return (
    <div className="feed">
      <section className="event-day">
        <div className="event-day__label">Recent admin activity</div>
        <Card className="event-list" style={{ padding: 0 }}>
          {auditLogs.map((log) => (
            <div className="event" key={log.id}>
              <div className="event__icon event__icon--neutral">
                {log.action.startsWith('platform.') || log.action.startsWith('announcement.')
                  ? <Power size={15} />
                  : <History size={15} />}
              </div>
              <div className="event__body">
                <div className="event__title">
                  <Badge tone={log.action.includes('disabled') || log.action === 'user.delete' ? 'down' : 'neutral'} className="event__badge">
                    {log.action}
                  </Badge>
                </div>
                <div className="event__url">
                  by @{log.actorEmail || log.actorId || 'system'}
                  {log.targetType && log.targetId ? ` · ${log.targetType}:${String(log.targetId).slice(0, 8)}` : ''}
                  {log.metadata ? ` · ${Object.entries(log.metadata).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}
                </div>
              </div>
              <div className="event__time">
                <div className="event__time-main">{formatTime(log.createdAt)}</div>
                <div className="event__time-sub">{formatRelative(log.createdAt)}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
};
