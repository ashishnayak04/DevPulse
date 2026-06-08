import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Menu, Activity as ActivityIcon, CheckCircle, XCircle, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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
    ...alerts.map(a => ({ ...a, _kind: 'alert' })),
    ...logs.map(l => ({ ...l, _kind: 'log' })),
  ].sort((a, b) => new Date(b.checkedAt || b.sentAt) - new Date(a.checkedAt || a.sentAt));

  const filters = [
    { key: 'all', label: 'All', icon: ActivityIcon },
    { key: 'failures', label: 'Failures', icon: XCircle },
    { key: 'recoveries', label: 'Recoveries', icon: CheckCircle },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <style>{`
          .act-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;
          }
          .act-header-left {
            display: flex; align-items: center; gap: 16px;
          }
          .act-back-btn {
            width: 40px; height: 40px; border-radius: 12px;
            background: rgba(255,255,255,0.04); border: 1px solid var(--border);
            color: var(--text-muted); cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .act-back-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
          .act-filters {
            display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; align-items: center;
          }
          .act-refresh-btn {
            margin-left: auto; background: none; border: none;
            color: var(--text-muted); cursor: pointer;
            display: flex; align-items: center; gap: 6px; font-size: 13px;
            padding: 8px 16px; border-radius: var(--radius-sm);
            transition: all 0.2s;
          }
          .act-refresh-btn:hover { background: rgba(255,255,255,0.04); color: var(--text-primary); }
          .act-event {
            display: flex; align-items: center; gap: 14px;
            padding: 16px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            transition: background 0.2s;
          }
          .act-event:last-child { border-bottom: none; }
          .act-event:hover { background: rgba(139, 92, 246, 0.02); }
          .act-event-icon {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          }
          .act-event-body { flex: 1; min-width: 0; }
          .act-event-title { font-size: 14px; font-weight: 500; }
          .act-event-url {
            font-size: 12px; color: var(--text-muted); margin-top: 2px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .act-event-time {
            text-align: right; flex-shrink: 0;
          }
          .act-event-time-main { font-size: 12px; color: var(--text-muted); }
          .act-event-time-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        `}</style>

        <header className="act-header">
          <div className="act-header-left">
            <button className="md-hidden act-back-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <button className="act-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="page-title"><span className="text-gradient">Activity</span></h1>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: 'var(--accent-gradient)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18, color: '#fff',
            boxShadow: '0 4px 16px rgba(139,92,246,0.3)'
          }}>
            {user?.username?.charAt(0).toUpperCase()}
          </div>
        </header>

        <div className="act-filters">
          {filters.map(f => (
            <button
              key={f.key}
              className={`filter-pill ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <f.icon size={14} />
              {f.label}
            </button>
          ))}
          <button className="act-refresh-btn" onClick={fetchActivity}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <div className="skeleton" style={{ width: '60%', height: '20px', margin: '0 auto 16px' }} />
            <div className="skeleton" style={{ width: '40%', height: '20px', margin: '0 auto' }} />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="glass-card empty-state">
            <ActivityIcon size={48} />
            <p>No activity yet. Add endpoints to start monitoring.</p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {allEvents.slice(0, 100).map((event, i) => {
              const isAlert = event._kind === 'alert';
              const isUp = isAlert ? event.type === 'UP' : event.isUp;
              const time = event.checkedAt || event.sentAt;

              let iconBg, iconColor;
              if (isAlert) {
                iconBg = 'rgba(245,158,11,0.1)';
                iconColor = '#fbbf24';
              } else if (isUp) {
                iconBg = 'rgba(16,185,129,0.1)';
                iconColor = '#34d399';
              } else {
                iconBg = 'rgba(239,68,68,0.1)';
                iconColor = '#f87171';
              }

              return (
                <div key={`${event._kind}-${event.id}-${i}`} className="act-event animate-fade-in" style={{
                  backgroundColor: isAlert ? 'rgba(245,158,11,0.03)' : !isUp ? 'rgba(239,68,68,0.03)' : 'transparent'
                }}>
                  <div className="act-event-icon" style={{ background: iconBg, color: iconColor }}>
                    {isAlert ? <AlertTriangle size={16} /> : isUp ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  </div>
                  <div className="act-event-body">
                    <div className="act-event-title">
                      {isAlert ? (
                        <><span style={{ color: '#fbbf24', fontWeight: 600 }}>Alert:</span> {event.endpointName} {event.type === 'DOWN' ? 'went down' : 'recovered'}</>
                      ) : (
                        <><span style={{ color: event.isUp ? '#34d399' : '#f87171', fontWeight: 600 }}>{event.isUp ? 'UP' : 'DOWN'}</span> — {event.endpointName}</>
                      )}
                    </div>
                    <div className="act-event-url">{event.endpointUrl || event.endpointName}</div>
                  </div>
                  <div className="act-event-time">
                    <div className="act-event-time-main">{time ? new Date(time).toLocaleTimeString() : '-'}</div>
                    {!isAlert && (
                      <div className="act-event-time-sub">{Math.round(event.responseTimeMs)}ms</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
