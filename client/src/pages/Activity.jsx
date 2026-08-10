import React, { useState, useEffect, useCallback } from 'react';
import { Activity as ActivityIcon, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const Activity = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/endpoints/activity/logs?filter=${filter}`);
      setLogs(data.logs || []);
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const allEvents = [
    ...alerts.map((a) => ({ ...a, _kind: 'alert' })),
    ...logs.map((l) => ({ ...l, _kind: 'log' })),
  ].sort((a, b) => new Date(b.checkedAt || b.sentAt) - new Date(a.checkedAt || a.sentAt));

  const filters = [
    { key: 'all', label: 'All', icon: ActivityIcon },
    { key: 'failures', label: 'Failures', icon: XCircle },
    { key: 'recoveries', label: 'Recoveries', icon: CheckCircle },
  ];

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Activity"
            subtitle="Uptime events across all your endpoints"
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
            actions={
              <div className="avatar" aria-hidden="true">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            }
          />

          <div className="filter-pills">
            {filters.map((f) => (
              <button
                key={f.key}
                className={`filter-pill ${filter === f.key ? 'filter-pill--active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                <f.icon size={14} />
                {f.label}
              </button>
            ))}
            <button className="filter-pill" onClick={fetchActivity} style={{ marginLeft: 'auto' }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {loading ? (
            <LoadingSkeleton type="table" count={6} />
          ) : allEvents.length === 0 ? (
            <Card>
              <EmptyState
                icon={ActivityIcon}
                title="No activity yet"
                description="Add endpoints to start monitoring. Check results will appear here in real time."
              />
            </Card>
          ) : (
            <Card className="event-list animate-fade-in">
              {allEvents.slice(0, 100).map((event, i) => {
                const isAlert = event._kind === 'alert';
                const isUp = isAlert ? event.type === 'UP' : event.isUp;
                const time = event.checkedAt || event.sentAt;

                let iconClass, iconColor;
                if (isAlert) {
                  iconClass = 'event__icon--warning';
                  iconColor = 'var(--warning-text)';
                } else if (isUp) {
                  iconClass = 'event__icon--success';
                  iconColor = 'var(--success-text)';
                } else {
                  iconClass = 'event__icon--danger';
                  iconColor = 'var(--danger-text)';
                }

                const eventClass = isAlert ? 'event--alert' : !isUp ? 'event--down' : '';

                return (
                  <div key={`${event._kind}-${event.id}-${i}`} className={`event ${eventClass} animate-fade-in`}>
                    <span className={`event__icon ${iconClass}`}>
                      {isAlert ? (
                        <AlertTriangle size={16} />
                      ) : isUp ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                    </span>
                    <div className="event__body">
                      <div className="event__title">
                        {isAlert ? (
                          <>
                            <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>Alert:</span>{' '}
                            {event.endpointName} {event.type === 'DOWN' ? 'went down' : 'recovered'}
                          </>
                        ) : (
                          <>
                            <span style={{ color: iconColor, fontWeight: 600 }}>
                              {event.isUp ? 'UP' : 'DOWN'}
                            </span>{' '}
                            &mdash; {event.endpointName}
                          </>
                        )}
                      </div>
                      <div className="event__url">{event.endpointUrl || event.endpointName}</div>
                    </div>
                    <div className="event__time">
                      <div className="event__time-main">{time ? new Date(time).toLocaleTimeString() : '-'}</div>
                      {!isAlert && (
                        <div className="event__time-sub">{Math.round(event.responseTimeMs)}ms</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};
