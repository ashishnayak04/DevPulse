import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Activity as PulseIcon, Menu } from 'lucide-react';
import { api } from '../api';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

export const StatusPage = () => {
  const { username } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get(`/status/${username}`);
        setData(response);
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
          <div className="sp-container">
            <Card
              style={{
                padding: 28,
                textAlign: 'center',
                color: 'var(--danger-text)',
                background: 'var(--danger-soft)',
                borderColor: 'var(--danger-border)',
              }}
            >
              {error}
            </Card>
          </div>
        </main>
      </div>
    );
  }
  if (!data) return null;

  const downCount = data.endpoints.filter((ep) => ep.status === 'DOWN').length;
  let bannerClass = 'sp-banner--up';
  let BannerIcon = ShieldCheck;
  let bannerText = 'All systems operational';

  if (downCount > 0 && downCount < data.endpoints.length) {
    bannerClass = 'sp-banner--partial';
    BannerIcon = ShieldAlert;
    bannerText = 'Partial system outage';
  } else if (downCount > 0 && downCount === data.endpoints.length) {
    bannerClass = 'sp-banner--major';
    BannerIcon = ShieldX;
    bannerText = 'Major system outage';
  }

  return (
    <div className="app-shell">
      {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main style={{ flex: 1 }} className={isAuthenticated ? 'main-content' : ''}>
        {isAuthenticated && (
          <div style={{ marginBottom: 20 }}>
            <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        )}

        <div className={`sp-container ${isAuthenticated ? '' : 'sp-container--public'}`}>
          <div className="sp-header animate-fade-in">
            <div className="sp-header__logo">
              <PulseIcon size={28} />
            </div>
            <h1>
              <span className="logo-word--accent">{data.username}</span>'s Status
            </h1>
            <p>Real-time status overview of all monitored services</p>
          </div>

          <div className={`sp-banner ${bannerClass} animate-scale-in`}>
            <span className="sp-banner__icon">
              <BannerIcon size={26} />
            </span>
            <div>
              <div className="sp-banner__title">{bannerText}</div>
              <p className="sp-banner__subtitle">
                {downCount > 0
                  ? `${downCount} of ${data.endpoints.length} endpoints experiencing issues`
                  : 'All endpoints are running smoothly'}
              </p>
            </div>
          </div>

          <Card style={{ overflow: 'hidden' }}>
            <div className="sp-list__header">
              <span className="sp-list__title">
                <PulseIcon size={15} />
                Endpoints
              </span>
              <span className="sp-list__count">
                {data.endpoints.filter((ep) => ep.status === 'UP').length}/{data.endpoints.length} operational
              </span>
            </div>

            {data.endpoints.length === 0 ? (
              <EmptyState
                icon={PulseIcon}
                title="No public endpoints"
                description="This user has not configured any public endpoints yet."
              />
            ) : (
              data.endpoints.map((ep) => {
                const isUp = ep.status === 'UP';
                return (
                  <div key={ep.id} className="sp-endpoint">
                    <div style={{ minWidth: 0 }}>
                      <div className="sp-endpoint__name">{ep.name}</div>
                      <div className="sp-endpoint__meta">
                        <span className="mono">{ep.url}</span>
                        <span>&middot;</span>
                        <Clock size={12} />
                        {ep.lastChecked ? new Date(ep.lastChecked).toLocaleString() : 'Never'}
                        {ep.lastResponseTime != null && (
                          <>
                            <span>&middot;</span>
                            <span>{Math.round(ep.lastResponseTime)}ms</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`sp-endpoint__badge ${isUp ? 'sp-endpoint__badge--up' : 'sp-endpoint__badge--down'}`}>
                      <span className={`status-dot ${isUp ? 'status-dot--up' : 'status-dot--down'} status-dot--pulse`} />
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
