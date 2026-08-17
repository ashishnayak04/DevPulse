import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Wifi } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Segmented } from '../components/ui/Segmented';
import { Badge } from '../components/ui/Badge';
import { RelativeTime } from '../components/RelativeTime';
import { formatTime, groupByDay } from '../utils/time';

function FeedSkeleton({ count = 8 }) {
  return (
    <Card>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
          <Skeleton width={32} height={32} radius="var(--radius)" />
          <div style={{ flex: 1 }}>
            <Skeleton width="45%" height={13} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width="60%" height={11} />
            </div>
          </div>
          <Skeleton width={56} height={12} />
        </div>
      ))}
    </Card>
  );
}

export const Activity = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raw, setRaw] = useState({ logs: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/endpoints/activity/logs?filter=all&limit=50`);
      setRaw({ logs: data.logs || [], alerts: data.alerts || [] });
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const events = useMemo(() => {
    const all = [
      ...raw.alerts.map((a) => ({ ...a, kind: 'alert' })),
      ...raw.logs.map((l) => ({ ...l, kind: 'log' })),
    ].sort((a, b) => new Date(b.checkedAt || b.sentAt) - new Date(a.checkedAt || a.sentAt));

    if (filter === 'failures') {
      return all.filter((e) => (e.kind === 'alert' ? e.type === 'DOWN' : !e.isUp));
    }
    if (filter === 'recoveries') {
      return all.filter((e) => e.kind === 'alert' && e.type === 'UP');
    }
    return all;
  }, [raw, filter]);

  const groups = useMemo(() => groupByDay(events, (e) => e.checkedAt || e.sentAt), [events]);

  const downCount = events.filter((e) => e.kind === 'alert' && e.type === 'DOWN').length;
  const recoveryCount = events.filter((e) => e.kind === 'alert' && e.type === 'UP').length;

  const subtitle =
    filter === 'failures'
      ? `${downCount} incident${downCount === 1 ? '' : 's'} detected`
      : filter === 'recoveries'
        ? `${recoveryCount} recovery${recoveryCount === 1 ? '' : 's'}`
        : 'Uptime events across all your endpoints';

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Events"
            subtitle={subtitle}
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
            actions={
              <button className="btn btn--secondary btn--sm" onClick={fetchActivity}>
                <RefreshCw size={14} />
                Refresh
              </button>
            }
          />

          <Segmented
            ariaLabel="Filter events"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All events' },
              { value: 'failures', label: 'Failures' },
              { value: 'recoveries', label: 'Recoveries' },
            ]}
          />

          <div style={{ marginTop: 20 }}>
            {loading ? (
              <FeedSkeleton count={7} />
            ) : events.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Wifi}
                  title={
                    filter === 'failures'
                      ? 'No failures detected'
                      : filter === 'recoveries'
                        ? 'No recoveries yet'
                        : 'No events yet'
                  }
                  description={
                    filter === 'all'
                      ? 'Checks run every minute for your endpoints. Down transitions and recoveries will appear here, with alerts called out at the top.'
                      : 'When something changes, it will show up here.'
                  }
                />
              </Card>
            ) : (
              <Card className="event-list animate-fade-in">
                {groups.map((group) => (
                  <div key={group.label}>
                    <div className="event-day__label" style={{ padding: '14px 20px 6px' }}>
                      {group.label}
                      <span style={{ marginLeft: 8, color: 'var(--text-muted)', letterSpacing: '0.02em', fontWeight: 500 }}>
                        {group.items.length}
                      </span>
                    </div>
                    {group.items.map((event, i) => {
                      const isAlert = event.kind === 'alert';
                      const isUp = isAlert ? event.type === 'UP' : event.isUp;
                      const time = event.checkedAt || event.sentAt;

                      let iconClass, Icon;
                      if (isAlert && event.type === 'DOWN') {
                        iconClass = 'event__icon--warning';
                        Icon = AlertTriangle;
                      } else if (isAlert && event.type === 'UP') {
                        iconClass = 'event__icon--success';
                        Icon = CheckCircle;
                      } else if (isUp) {
                        iconClass = 'event__icon--neutral';
                        Icon = CheckCircle;
                      } else {
                        iconClass = 'event__icon--danger';
                        Icon = XCircle;
                      }

                      const eventClass = !isAlert && !isUp ? 'event--down' : '';

                      return (
                        <div key={`${event.kind}-${event.id}-${i}`} className={`event ${eventClass} animate-fade-in`}>
                          <span className={`event__icon ${iconClass}`}>
                            <Icon size={15} strokeWidth={2} />
                          </span>
                          <div className="event__body">
                            <div className="event__title">
                              {isAlert ? (
                                <>
                                  <Badge tone={event.type === 'DOWN' ? 'warning' : 'up'} style={{ marginRight: 8 }}>
                                    {event.type === 'DOWN' ? 'Down' : 'Recovered'}
                                  </Badge>
                                  {event.endpointName}
                                </>
                              ) : (
                                <>
                                  <Badge tone={isUp ? 'up' : 'down'} style={{ marginRight: 8 }}>
                                    {isUp ? 'UP' : 'DOWN'}
                                  </Badge>
                                  {event.endpointName}
                                </>
                              )}
                            </div>
                            <div className="event__url">
                              {event.endpointUrl || event.endpointName}
                              {!isAlert && event.statusCode && (
                                <span style={{ color: isUp ? 'var(--success-text)' : 'var(--danger-text)' }}>
                                  {' '}· HTTP {event.statusCode}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="event__time">
                            <div className="event__time-main">{time ? formatTime(time) : '—'}</div>
                            <div className="event__time-sub">
                              <RelativeTime time={time} />
                              {!isAlert && event.responseTimeMs != null && ` · ${Math.round(event.responseTimeMs)}ms`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};


export default Activity;
