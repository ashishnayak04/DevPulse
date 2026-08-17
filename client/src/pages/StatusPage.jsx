import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, Activity as PulseIcon } from 'lucide-react';
import { api } from '../api';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { RelativeTime } from '../components/RelativeTime';

export const StatusPage = () => {
  const { username } = useParams();
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get(`/status/${username}`);
        setData(response);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [username]);

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

  const downCount = data.endpoints.filter((ep) => ep.status === 'DOWN').length;
  let bannerClass = 'sp-banner--up';
  let bannerText = 'All systems operational';

  if (downCount > 0 && downCount < data.endpoints.length) {
    bannerClass = 'sp-banner--partial';
    bannerText = 'Partial system outage';
  } else if (downCount > 0 && downCount === data.endpoints.length) {
    bannerClass = 'sp-banner--major';
    bannerText = 'Major system outage';
  }

  const upCount = data.endpoints.length - downCount;

  return (
    <div className="app-shell">
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
              <span className="logo-mark" style={{ width: 40, height: 40 }}>
                <PulseIcon size={22} />
              </span>
              <span>
                {data.username}
                <span style={{ color: 'var(--accent-text)' }}> · Status</span>
              </span>
            </div>
            <h1>{bannerText}</h1>
            <p>Live status of every monitored service</p>
          </div>

          <div className={`sp-banner ${bannerClass} animate-scale-in`}>
            <span className="sp-banner__icon">
              <PulseIcon size={22} />
            </span>
            <div>
              <div className="sp-banner__title">{bannerText}</div>
              <p className="sp-banner__subtitle">
                {downCount > 0
                  ? `${downCount} of ${data.endpoints.length} services are down`
                  : `${data.endpoints.length} ${data.endpoints.length === 1 ? 'service' : 'services'} running smoothly`}
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

          <Card style={{ overflow: 'hidden' }}>
            <div className="sp-list__header">
              <span className="sp-list__title">
                <PulseIcon size={14} />
                Services
              </span>
              <span className="sp-list__count">
                {upCount}/{data.endpoints.length} operational
              </span>
            </div>

            {data.endpoints.length === 0 ? (
              <EmptyState
                icon={PulseIcon}
                title="No services listed"
                description="This status page has not been configured with any endpoints yet."
              />
            ) : (
              data.endpoints.map((ep) => {
                const isUp = ep.status === 'UP';
                return (
                  <div key={ep.id} className="sp-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="sp-row__name">{ep.name}</div>
                      <div className="sp-row__meta">
                        <span>{ep.url}</span>
                        <span>·</span>
                        <span>{ep.lastChecked ? <RelativeTime time={ep.lastChecked} /> : 'never checked'}</span>
                        {ep.lastResponseTime != null && (
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

          <div className="sp-footer">
            Powered by <strong>DevPulse</strong>
          </div>
        </div>
      </main>
    </div>
  );
};


export default StatusPage;
