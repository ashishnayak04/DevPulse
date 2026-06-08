import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Menu, Activity, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

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

  if (loading && !data) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
        <div className="spin" style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: '#a78bfa', borderRadius: '50%' }} />
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{
          textAlign: 'center',
          padding: '32px 40px', borderRadius: 'var(--radius-lg)',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
          color: '#f87171'
        }}>
          {error}
        </div>
      </div>
    </div>
  );
  if (!data) return null;

  const downCount = data.endpoints.filter(ep => ep.status === 'DOWN').length;
  let overallStatus = 'operational';
  let bannerBg = 'rgba(16, 185, 129, 0.08)';
  let bannerBorder = 'rgba(16, 185, 129, 0.2)';
  let bannerColor = '#34d399';
  let BannerIcon = ShieldCheck;
  let bannerText = 'All systems operational';
  let bannerGradient = 'linear-gradient(135deg, rgba(16,185,129,0.05), transparent)';

  if (downCount > 0 && downCount < data.endpoints.length) {
    overallStatus = 'partial';
    bannerBg = 'rgba(245, 158, 11, 0.08)';
    bannerBorder = 'rgba(245, 158, 11, 0.2)';
    bannerColor = '#fbbf24';
    BannerIcon = ShieldAlert;
    bannerText = 'Partial system outage';
    bannerGradient = 'linear-gradient(135deg, rgba(245,158,11,0.05), transparent)';
  } else if (downCount > 0 && downCount === data.endpoints.length) {
    overallStatus = 'major';
    bannerBg = 'rgba(239, 68, 68, 0.08)';
    bannerBorder = 'rgba(239, 68, 68, 0.2)';
    bannerColor = '#f87171';
    BannerIcon = ShieldX;
    bannerText = 'Major system outage';
    bannerGradient = 'linear-gradient(135deg, rgba(239,68,68,0.05), transparent)';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAuthenticated && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main style={{ flex: 1 }} className={isAuthenticated ? 'main-content' : ''}>
        <style>{`
          .sp-container {
            max-width: 860px; margin: 0 auto;
            padding: ${isAuthenticated ? '0' : '60px 24px'};
          }
          .sp-header {
            text-align: center; margin-bottom: 48px;
          }
          .sp-header-icon {
            width: 72px; height: 72px; border-radius: 24px;
            background: var(--accent-gradient);
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px;
            box-shadow: 0 12px 40px rgba(139, 92, 246, 0.3);
          }
          .sp-header h1 {
            font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px;
          }
          .sp-header p {
            color: var(--text-muted); font-size: 15px;
          }
          .sp-banner {
            position: relative;
            padding: 28px 32px; border-radius: var(--radius-lg);
            display: flex; align-items: center; gap: 20px;
            margin-bottom: 40px; overflow: hidden;
            background: ${bannerBg};
            border: 1px solid ${bannerBorder};
          }
          .sp-banner-glow {
            position: absolute; inset: 0;
            background: ${bannerGradient};
            pointer-events: none;
          }
          .sp-banner-icon {
            width: 56px; height: 56px; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; position: relative;
            background: ${bannerColor}15;
            color: ${bannerColor};
          }
          .sp-banner-text { position: relative; }
          .sp-banner-text h2 {
            font-size: 22px; font-weight: 700; color: ${bannerColor};
          }
          .sp-banner-text p {
            font-size: 13px; color: var(--text-muted); margin-top: 4px;
          }
          .sp-list-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 0 4px; margin-bottom: 16px;
          }
          .sp-list-title {
            font-size: 15px; font-weight: 600; color: var(--text-secondary);
          }
          .sp-list-count {
            font-size: 13px; color: var(--text-muted);
          }
          .sp-endpoint {
            padding: 22px 28px; display: flex; align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--border);
            transition: background 0.2s;
          }
          .sp-endpoint:last-child { border-bottom: none; }
          .sp-endpoint:hover { background: rgba(139, 92, 246, 0.02); }
          .sp-endpoint-name {
            font-size: 16px; font-weight: 600; margin-bottom: 4px;
          }
          .sp-endpoint-meta {
            display: flex; align-items: center; gap: 12px;
            font-size: 12px; color: var(--text-muted);
          }
          .sp-endpoint-badge {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 16px; border-radius: 100px;
            font-size: 13px; font-weight: 500; flex-shrink: 0;
          }
          .sp-endpoint-badge.up {
            background: rgba(16,185,129,0.08); color: #34d399;
            border: 1px solid rgba(16,185,129,0.15);
          }
          .sp-endpoint-badge.down {
            background: rgba(239,68,68,0.08); color: #f87171;
            border: 1px solid rgba(239,68,68,0.15);
          }
          .sp-footer {
            text-align: center; margin-top: 48px;
            padding: 24px; color: var(--text-muted); font-size: 13px;
          }
          .sp-footer-logo { font-weight: 700; }
          .sp-mobile-header {
            display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
          }
          .sp-empty {
            padding: 48px; text-align: center; color: var(--text-muted);
          }
        `}</style>

        {isAuthenticated && (
          <div className="sp-mobile-header">
            <button
              className="md-hidden"
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', cursor: 'pointer', padding: '8px',
                borderRadius: 'var(--radius-sm)', display: 'flex'
              }}
            >
              <Menu size={20} />
            </button>
          </div>
        )}

        <div className="sp-container animate-fade-in">
          <div className="sp-header">
            <div className="sp-header-icon">
              <Activity size={32} color="white" />
            </div>
            <h1>
              <span className="text-gradient">{data.username}</span>'s Status
            </h1>
            <p>Real-time status overview of all monitored services</p>
          </div>

          <div className="sp-banner animate-scale-in">
            <div className="sp-banner-glow" />
            <div className="sp-banner-icon">
              <BannerIcon size={28} />
            </div>
            <div className="sp-banner-text">
              <h2>{bannerText}</h2>
              <p>
                {downCount > 0
                  ? `${downCount} of ${data.endpoints.length} endpoints experiencing issues`
                  : 'All endpoints are running smoothly'}
              </p>
            </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="sp-list-header" style={{ padding: '20px 28px 12px' }}>
              <span className="sp-list-title">
                <Activity size={15} style={{ display: 'inline', marginRight: 6 }} />
                Endpoints
              </span>
              <span className="sp-list-count">
                {data.endpoints.filter(ep => ep.status === 'UP').length}/{data.endpoints.length} operational
              </span>
            </div>

            {data.endpoints.length === 0 ? (
              <div className="sp-empty">
                No public endpoints configured.
              </div>
            ) : (
              data.endpoints.map((ep, i) => {
                const isUp = ep.status === 'UP';
                return (
                  <div key={ep.id} className="sp-endpoint">
                    <div>
                      <div className="sp-endpoint-name">{ep.name}</div>
                      <div className="sp-endpoint-meta">
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
                    <div className={`sp-endpoint-badge ${isUp ? 'up' : 'down'}`}>
                      <span className={`status-dot ${isUp ? 'status-up pulse' : 'status-down pulse'}`} style={{ width: 8, height: 8 }} />
                      {isUp ? 'Operational' : 'Down'}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sp-footer">
            Powered by <span className="sp-footer-logo"><span className="text-gradient">DevPulse</span></span>
          </div>
        </div>
      </main>
    </div>
  );
};
