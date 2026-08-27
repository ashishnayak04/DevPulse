import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, Activity as PulseIcon, Wrench, AlertTriangle, MailCheck } from 'lucide-react';
import { api } from '../api';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { RelativeTime } from '../components/RelativeTime';
import '../styles/statuspage.css';

const DEFAULT_ACCENT = '#22d3ee';

function formatRange(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const dayOpts = { month: 'short', day: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit' };

  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString([], dayOpts)}, ${start.toLocaleTimeString([], timeOpts)} – ${end.toLocaleTimeString([], timeOpts)}`;
  }
  return `${start.toLocaleString([], { ...dayOpts, ...timeOpts })} – ${end.toLocaleString([], { ...dayOpts, ...timeOpts })}`;
}

function formatElapsed(ms) {
  const totalSec = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const LiveDuration = ({ since }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="spub-incident__duration" title="Ongoing duration">
      {formatElapsed(now - new Date(since).getTime())}
    </span>
  );
};

const MaintenanceBanner = ({ window: win }) => (
  <div className={`spub-maint ${win.status === 'upcoming' ? 'spub-maint--slim' : ''}`}>
    <span className="spub-maint__icon">
      <Wrench size={win.status === 'upcoming' ? 15 : 19} />
    </span>
    <div className="spub-maint__body">
      <div className="spub-maint__title">
        Scheduled maintenance: {win.title}
      </div>
      {win.status === 'active' && win.message && <p className="spub-maint__message">{win.message}</p>}
      <p className="spub-maint__range">{formatRange(win.startsAt, win.endsAt)}</p>
    </div>
    <span className={`spub-maint__badge spub-maint__badge--${win.status}`}>
      {win.status === 'active' ? 'In progress' : 'Upcoming'}
    </span>
  </div>
);

const IncidentCard = ({ incident }) => (
  <div className="spub-incident">
    <span className="spub-incident__icon">
      <AlertTriangle size={17} />
    </span>
    <div className="spub-incident__body">
      <div className="spub-incident__head">
        <span className="spub-incident__endpoint">{incident.endpointName}</span>
        {incident.acknowledged && <span className="spub-chip">Acknowledged</span>}
      </div>
      <div className="spub-incident__meta">
        Started <RelativeTime time={incident.startedAt} />
        <span aria-hidden="true">·</span>
        <LiveDuration since={incident.startedAt} />
      </div>
    </div>
  </div>
);

export const StatusPage = () => {
  const { username } = useParams();
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState('idle');
  const [subError, setSubError] = useState(null);

  useEffect(() => {
    let alive = true;

    const fetchStatus = async () => {
      try {
        const response = await api.get(`/status/${username}`);
        if (!alive) return;
        setData(response);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err.message || 'Failed to load status');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [username]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || subState === 'sending') return;
    setSubState('sending');
    setSubError(null);
    try {
      await api.post(`/status/${username}/subscribe`, { email: email.trim() });
      setSubState('done');
      setEmail('');
    } catch (err) {
      setSubError(err.message || 'Failed to subscribe');
      setSubState('idle');
    }
  };

  if (loading && !data) {
    return (
      <div className="app-shell">
        {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <div className="full-center" style={{ flex: 1 }}>
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <main style={{ flex: 1 }} className={isAuthenticated ? 'main-content' : ''}>
          <div className="sp-container" style={{ padding: 48 }}>
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <p style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Status page unavailable</p>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {error}
              </p>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  if (!data) return null;

  const config = data.config || {};
  const accent = config.accentColor || DEFAULT_ACCENT;
  const showLatency = config.showLatency !== false;

  const endpoints = data.endpoints || [];
  const maintenance = data.maintenance || [];
  const activeMaintenance = maintenance.filter((win) => win.status === 'active');
  const upcomingMaintenance = maintenance.filter((win) => win.status === 'upcoming');
  const incidents = data.incidents || [];

  const downCount = endpoints.filter((ep) => ep.status === 'DOWN').length;
  let bannerClass = 'sp-banner--up';
  let bannerText = 'All systems operational';

  if (downCount > 0 && downCount < endpoints.length) {
    bannerClass = 'sp-banner--partial';
    bannerText = 'Partial system outage';
  } else if (downCount > 0 && downCount === endpoints.length) {
    bannerClass = 'sp-banner--major';
    bannerText = 'Major system outage';
  }

  const upCount = endpoints.length - downCount;
  const heading = config.title || `${username}'s status page`;
  const subtitle = config.description || 'Live status of every monitored service';

  return (
    <div
      className="app-shell spub-root"
      style={{ '--status-accent': accent }}
    >
      {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main style={{ flex: 1 }} className={isAuthenticated ? 'main-content' : ''}>
        {isAuthenticated && (
          <div style={{ marginBottom: 20 }}>
            <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
          </div>
        )}

        <div className={`sp-container ${isAuthenticated ? '' : 'sp-container--public'}`}>
          <div className="sp-header animate-fade-in">
            <div className="sp-header__brand">
              <span className="logo-mark spub-logo-mark" style={{ width: 40, height: 40 }}>
                <PulseIcon size={22} />
              </span>
              <span>
                {data.username}
                <span className="spub-brand-accent"> · Status</span>
              </span>
            </div>
            <h1>{heading}</h1>
            <p>{subtitle}</p>
          </div>

          <div className={`sp-banner ${bannerClass} animate-scale-in`}>
            <span className="sp-banner__icon">
              <PulseIcon size={22} />
            </span>
            <div>
              <div className="sp-banner__title">{bannerText}</div>
              <p className="sp-banner__subtitle">
                {downCount > 0
                  ? `${downCount} of ${endpoints.length} services are down`
                  : `${endpoints.length} ${endpoints.length === 1 ? 'service' : 'services'} running smoothly`}
              </p>
            </div>
            <span
              className={`status-dot status-dot--lg ${
                downCount > 0 ? 'status-dot--down' : 'status-dot--up'
              } status-dot--pulse`}
              style={{ marginLeft: 'auto' }}
              aria-hidden="true"
            />
          </div>

          {(activeMaintenance.length > 0 || upcomingMaintenance.length > 0) && (
            <section className="spub-maintenance" aria-label="Scheduled maintenance">
              {activeMaintenance.map((win) => (
                <MaintenanceBanner key={win.id} window={win} />
              ))}
              {upcomingMaintenance.map((win) => (
                <MaintenanceBanner key={win.id} window={win} />
              ))}
            </section>
          )}

          {incidents.length > 0 && (
            <section className="spub-incidents" aria-label="Active incidents">
              <h2 className="spub-section-title">
                <AlertTriangle size={14} />
                Active incidents
              </h2>
              <div className="spub-incident-list">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            </section>
          )}

          <Card style={{ overflow: 'hidden' }}>
            <div className="sp-list__header">
              <span className="sp-list__title">
                <PulseIcon size={14} />
                Services
              </span>
              <span className="sp-list__count">
                {upCount}/{endpoints.length} operational
              </span>
            </div>

            {endpoints.length === 0 ? (
              <EmptyState
                icon={PulseIcon}
                title="No services listed"
                description="This status page has not been configured with any endpoints yet."
              />
            ) : (
              endpoints.map((ep) => {
                const isUp = ep.status === 'UP';
                return (
                  <div key={ep.id} className="sp-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="sp-row__name">{ep.name}</div>
                      <div className="sp-row__meta">
                        <span>{ep.url}</span>
                        <span>·</span>
                        <span>{ep.lastChecked ? <RelativeTime time={ep.lastChecked} /> : 'never checked'}</span>
                        {showLatency && ep.lastResponseTime != null && (
                          <>
                            <span>·</span>
                            <span style={{ color: isUp ? 'var(--success-text)' : 'var(--danger-text)' }}>
                              {Math.round(ep.lastResponseTime)}ms
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`sp-row__status ${isUp ? 'sp-row__status--up' : 'sp-row__status--down'}`}>
                      <span
                        className={`status-dot ${isUp ? 'status-dot--up' : 'status-dot--down'} status-dot--pulse`}
                      />
                      {isUp ? 'Operational' : 'Down'}
                    </span>
                  </div>
                );
              })
            )}
          </Card>

          <section className="spub-subscribe" aria-label="Get status updates">
            <h2 className="spub-section-title spub-section-title--center">Get notified about downtime</h2>
            {subState === 'done' ? (
              <div className="spub-subscribe__done">
                <MailCheck size={18} />
                <div>
                  <strong>Check your inbox to confirm.</strong>
                  <span> We sent a confirmation link before you receive any updates.</span>
                </div>
              </div>
            ) : (
              <>
                <form className="spub-subscribe__form" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    className="field__input spub-subscribe__input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email address"
                    required
                  />
                  <button type="submit" className="spub-btn" disabled={subState === 'sending'}>
                    {subState === 'sending' ? 'Subscribing…' : 'Notify Me'}
                  </button>
                </form>
                {subError && <p className="spub-subscribe__error">{subError}</p>}
              </>
            )}
            <p className="spub-subscribe__note">
              No spam — only incident and maintenance updates for this page. See our{' '}
              <a href="/privacy">privacy policy</a>.
            </p>
          </section>

          <div className="sp-footer">
            Powered by <strong>DevPulse</strong>
          </div>
        </div>
      </main>
    </div>
  );
};


export default StatusPage;
