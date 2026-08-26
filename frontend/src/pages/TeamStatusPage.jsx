import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity as PulseIcon } from 'lucide-react';
import { api } from '../api';
import { Spinner } from '../components/ui/Spinner';
import '../styles/teams.css';

export const TeamStatusPage = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    const fetchStatus = async () => {
      try {
        const response = await api.get(`/status/team/${slug}`);
        if (!alive) return;
        setData(response);
        setNotFound(false);
        setError(null);
      } catch (err) {
        if (!alive) return;
        if (err.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message || 'Failed to load team status');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    setLoading(true);
    setData(null);
    setNotFound(false);
    setError(null);
    fetchStatus();

    const interval = setInterval(fetchStatus, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [slug]);

  if (loading && !data) {
    return (
      <div className="team-status-page">
        <div className="full-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="team-status-page">
        <div className="team-status__error animate-fade-in">
          <h1>Team not found</h1>
          <p>The status page you're looking for doesn't exist or may have been removed.</p>
        </div>
        <div className="team-status__footer">
          Powered by <strong>DevPulse</strong>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="team-status-page">
        <div className="team-status__error animate-fade-in">
          <h1>Status page unavailable</h1>
          <p>{error || 'Something went wrong.'}</p>
        </div>
        <div className="team-status__footer">
          Powered by <strong>DevPulse</strong>
        </div>
      </div>
    );
  }

  const { team, overall, endpoints } = data;

  return (
    <div className="team-status-page">
      <div className="team-status animate-fade-in">
        <header className="team-status__header">
          <span className="team-status__brand">
            <span className="logo-mark" style={{ width: 34, height: 34 }}>
              <PulseIcon size={18} />
            </span>
            Dev<span style={{ color: 'var(--accent-text)', marginLeft: -6 }}>Pulse</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· Team status</span>
          </span>
          <h1 className="team-status__title">{team.name}</h1>
          <p className="team-status__subtitle">Live status of every service monitored by /{team.slug}</p>
        </header>

        <div className="team-status__chips animate-scale-in">
          <span className="team-status-chip team-status-chip--up">
            <span className={`team-endpoint-dot ${overall.down > 0 && overall.up === 0 ? '' : 'team-endpoint-dot--up'}`} aria-hidden="true" />
            {overall.up} UP
          </span>
          <span className={`team-status-chip ${overall.down > 0 ? 'team-status-chip--down' : ''}`}>
            <span className={`team-endpoint-dot ${overall.down > 0 ? 'team-endpoint-dot--down' : 'team-endpoint-dot--up'}`} aria-hidden="true" />
            {overall.down} DOWN
          </span>
          <span className="team-status-chip">{overall.total} total</span>
        </div>

        <div className="team-status__list animate-scale-in">
          {endpoints.length === 0 ? (
            <div className="team-status__empty">No services are being monitored yet.</div>
          ) : (
            endpoints.map((ep) => (
              <div key={ep.id} className="team-status__row">
                <span className={`team-endpoint-dot ${ep.isUp ? 'team-endpoint-dot--up' : 'team-endpoint-dot--down'}`} aria-hidden="true" />
                <div className="team-status__row-body">
                  <div className="team-status__row-name">{ep.name}</div>
                  <div className="team-status__row-url">{ep.url}</div>
                </div>
                {(ep.uptime24h != null || ep.avgResponse24h != null) && (
                  <div className="team-status__row-metrics">
                    {ep.uptime24h != null && <span>{ep.uptime24h}% uptime</span>}
                    {ep.avgResponse24h != null && ep.avgResponse24h > 0 && (
                      <span className={ep.isUp ? 'team-status__metric-up' : 'team-status__metric-down'}>
                        {Math.round(ep.avgResponse24h)}ms avg
                      </span>
                    )}
                  </div>
                )}
                <span className={`team-status__state ${ep.isUp ? 'team-status__state--up' : 'team-status__state--down'}`}>
                  {ep.isUp ? 'Operational' : 'Down'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="team-status__footer">
          Powered by <strong>DevPulse</strong>
        </div>
      </div>
    </div>
  );
};

export default TeamStatusPage;
