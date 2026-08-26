import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Activity as ActivityIcon, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { ResponseChart } from '../components/ResponseChart';
import { EditEndpointModal } from '../components/EditEndpointModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Sidebar } from '../components/Sidebar';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Segmented } from '../components/ui/Segmented';
import { Skeleton } from '../components/ui/Skeleton';
import { RelativeTime } from '../components/RelativeTime';
import { useToast } from '../components/Toast';
import { formatInterval, formatTime, formatDate } from '../utils/time';

const WINDOW_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

const WINDOW_LABELS = {
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
};

function DetailSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Skeleton width={12} height={12} radius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width="40%" height={22} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width="60%" height={12} />
          </div>
        </div>
      </div>
      <Card className="status-strip">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={56} height={10} />
              <div style={{ marginTop: 6 }}>
                <Skeleton width={72} height={16} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="chart-wrap" style={{ marginTop: 24 }}>
        <Skeleton width={140} height={14} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={260} radius="var(--radius-md)" />
        </div>
      </Card>
    </div>
  );
}

export const EndpointDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [statsWindow, setStatsWindow] = useState('24h');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasLoadedRef = React.useRef(false);
  const { socket } = useSocket();
  const { addToast } = useToast();

  useEffect(() => {
    hasLoadedRef.current = false;
    setLoading(true);
    setError(null);

    let cancelled = false;
    api
      .get(`/endpoints/${id}`)
      .then((epData) => {
        if (!cancelled) setEndpoint(epData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const applyStats = useCallback((statsData, logsData) => {
    setStats(statsData);
    setRecentLogs(logsData.logs || []);

    const series = Array.isArray(statsData?.series) ? statsData.series : null;
    if (series && series.length > 0) {
      setChartData(
        series
          .map((s) => ({
            time: s.t,
            responseTime: s.avgMs,
            uptimePct: s.uptimePct,
          }))
          .filter((d) => d.responseTime != null)
      );
    } else {
      setChartData(
        (logsData.logs || [])
          .slice()
          .reverse()
          .map((l) => ({
            time: l.checkedAt,
            responseTime: l.responseTimeMs,
            isUp: l.isUp,
          }))
          .filter((d) => d.responseTime != null)
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refetchForWindow = async () => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      }
      try {
        const [statsData, logsData] = await Promise.all([
          api.get(`/endpoints/${id}/stats?window=${statsWindow}`),
          api.get(`/endpoints/${id}/logs?limit=30&window=${statsWindow}`),
        ]);
        if (cancelled) return;
        applyStats(statsData, logsData);
        setError(null);
      } catch (err) {
        if (!cancelled && !hasLoadedRef.current) setError(err.message);
      } finally {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    refetchForWindow();
    return () => {
      cancelled = true;
    };
  }, [id, statsWindow, applyStats]);

  useEffect(() => {
    if (!socket) return;

    const handlePingResult = (result) => {
      if (result.endpointId !== id) return;

      setEndpoint((prev) => (prev ? { ...prev, status: result.status } : prev));

      const newLog = {
        checkedAt: result.checkedAt,
        isUp: result.isUp,
        responseTimeMs: result.responseTimeMs,
        statusCode: result.statusCode,
      };

      setRecentLogs((prev) => [newLog, ...prev].slice(0, 30));

      if (statsWindow === '24h') {
        setChartData((prev) => {
          if (result.responseTimeMs == null) return prev;
          const newPoint = { time: result.checkedAt, responseTime: result.responseTimeMs, isUp: result.isUp };
          return [...prev, newPoint].slice(-200);
        });
      }
    };

    socket.on('ping:result', handlePingResult);
    return () => socket.off('ping:result', handlePingResult);
  }, [socket, id, statsWindow]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/endpoints/${id}`);
      addToast('Endpoint deleted', 'success');
      navigate('/dashboard');
    } catch (err) {
      setDeleting(false);
      addToast(`Failed to delete: ${err.message}`, 'error');
    }
  }, [id, navigate, addToast]);

  const handleUpdate = (updatedEndpoint) => {
    setEndpoint((prev) => ({ ...prev, ...updatedEndpoint }));
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          <div className="page">
            <DetailSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          <div className="page">
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <p style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Unable to load endpoint</p>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {error}
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                  Back to Monitor
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  if (!endpoint) return null;

  const isUp = endpoint.status === 'UP';
  const windowLabel = WINDOW_LABELS[statsWindow] || WINDOW_LABELS['24h'];
  const headerCount =
    endpoint.headers && typeof endpoint.headers === 'object' && !Array.isArray(endpoint.headers)
      ? Object.keys(endpoint.headers).length
      : 0;

  const advancedBadges = [];
  if (endpoint.method && endpoint.method !== 'GET') {
    advancedBadges.push(
      <Badge key="method" tone="accent">
        {endpoint.method}
      </Badge>
    );
  }
  if (headerCount > 0) {
    advancedBadges.push(
      <Badge key="headers" tone="neutral">
        {headerCount} custom header{headerCount > 1 ? 's' : ''}
      </Badge>
    );
  }
  if (endpoint.keywordMatch) {
    advancedBadges.push(
      <Badge key="keyword" tone="neutral">
        Keyword: {endpoint.keywordMatch}
      </Badge>
    );
  }
  if (endpoint.sslCheck) {
    advancedBadges.push(
      <Badge key="ssl" tone="warning">
        SSL check &middot; warns &lt;{endpoint.sslExpiryDays || 30}d
      </Badge>
    );
  }

  const readouts = stats
    ? [
        {
          label: `Uptime \u00b7 ${windowLabel}`,
          value: `${stats.uptimePercentage}%`,
          tone: stats.uptimePercentage >= 98 ? 'success' : stats.uptimePercentage < 95 ? 'danger' : 'warning',
        },
        {
          label: 'Avg latency',
          value: `${Math.round(stats.avgResponseTime)}ms`,
        },
        {
          label: 'P95 latency',
          value: `${Math.round(stats.p95Latency)}ms`,
        },
        {
          label: `Checks \u00b7 ${windowLabel}`,
          value: String(stats.totalChecks),
          muted: stats.totalChecks === 0,
        },
        {
          label: 'Failures',
          value: String(stats.totalFailures),
          tone: stats.totalFailures > 0 ? 'danger' : 'success',
        },
        {
          label: 'Interval',
          value: formatInterval(endpoint.intervalMs),
          muted: true,
        },
      ]
    : [];

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
            left={
              <span
                className={`status-dot status-dot--lg ${isUp ? 'status-dot--up' : 'status-dot--down'} status-dot--pulse`}
                aria-hidden="true"
              />
            }
            title={endpoint.name}
            subtitle={<span className="mono">{endpoint.url}</span>}
            actions={
              <>
                <Button variant="secondary" icon={Edit2} onClick={() => setEditModalOpen(true)}>
                  Edit
                </Button>
                <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
                  Delete
                </Button>
              </>
            }
          />

          {advancedBadges.length > 0 && (
            <div
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 14,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <SlidersHorizontal size={12} />
                Config
              </span>
              {advancedBadges}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0 4px' }}>
            <Segmented options={WINDOW_OPTIONS} value={statsWindow} onChange={setStatsWindow} ariaLabel="Stats time window" />
          </div>

          <div
            className="status-strip animate-fade-in"
            style={{ opacity: refreshing ? 0.55 : 1, transition: 'opacity 0.15s ease' }}
          >
            <div className="status-strip__status">
              <div>
                <div className="status-strip__title">
                  <Badge tone={isUp ? 'up' : 'down'} dot pulse>
                    {isUp ? 'Operational' : 'Down'}
                  </Badge>
                </div>
                <div className="status-strip__sub" style={{ marginTop: 6 }}>
                  {endpoint.lastChecked ? (
                    <>
                      Last checked <RelativeTime time={endpoint.lastChecked} /> {'\u00b7'} {formatDate(endpoint.lastChecked)}
                    </>
                  ) : (
                    'Pending first check'
                  )}
                </div>
              </div>
            </div>

            <div className="status-strip__readouts">
              {readouts.map((r, i) => (
                <React.Fragment key={r.label}>
                  {i > 0 && <span className="status-strip__divider" aria-hidden="true" />}
                  <div className="readout">
                    <span className="readout__label">{r.label}</span>
                    <span
                      className={`readout__value ${
                        r.tone === 'danger'
                          ? 'readout__value--danger'
                          : r.tone === 'success'
                            ? 'readout__value--success'
                            : r.tone === 'warning'
                              ? 'readout__value--warning'
                              : r.muted
                                ? 'readout__value--muted'
                                : ''
                      }`}
                    >
                      {r.value}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <Card className="chart-wrap">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ActivityIcon size={15} style={{ color: 'var(--accent)' }} />
                Response time
              </h2>
              <span className="chart-legend">{windowLabel}</span>
            </div>
            <ResponseChart data={chartData} p95={stats?.p95Latency} xGranularity={statsWindow === '24h' ? 'time' : 'date'} />
          </Card>

          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              Recent pings
              {recentLogs.length > 0 && (
                <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                  {'\u00b7'} {recentLogs.length} recorded
                </span>
              )}
            </h2>
            <Card style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log, i) => (
                      <tr key={`${log.checkedAt}-${i}`}>
                        <td>
                          <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                            {formatTime(log.checkedAt)}
                          </span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                            <RelativeTime time={log.checkedAt} />
                          </span>
                        </td>
                        <td>
                          <Badge tone={log.isUp ? 'up' : 'down'} dot>
                            {log.isUp ? 'UP' : 'DOWN'}
                          </Badge>
                        </td>
                        <td>
                          <span
                            className="mono"
                            style={{ color: log.isUp ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}
                          >
                            {log.responseTimeMs != null ? `${Math.round(log.responseTimeMs)}ms` : 'timeout'}
                          </span>
                        </td>
                        <td className="mono" style={{ color: log.isUp ? 'var(--text-secondary)' : 'var(--danger-text)' }}>
                          {log.statusCode || 'ERR'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentLogs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 44, color: 'var(--text-muted)', fontSize: 13 }}>
                  {'Waiting for the first check to complete\u2026'}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <EditEndpointModal
        key={endpoint.id}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        endpoint={endpoint}
        onUpdate={handleUpdate}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this endpoint?"
        description={`Stops monitoring "${endpoint.name}" and removes its check history. This cannot be undone.`}
        confirmLabel="Delete endpoint"
      />
    </div>
  );
};

export default EndpointDetail;
