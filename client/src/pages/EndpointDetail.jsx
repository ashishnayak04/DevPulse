import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Activity, AlertTriangle, ShieldCheck, Zap, Server, Clock } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { StatCard } from '../components/StatCard';
import { ResponseChart } from '../components/ResponseChart';
import { EditEndpointModal } from '../components/EditEndpointModal';
import { Sidebar } from '../components/Sidebar';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export const EndpointDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [epData, statsData, logsData] = await Promise.all([
          api.get(`/endpoints/${id}`),
          api.get(`/endpoints/${id}/stats`),
          api.get(`/endpoints/${id}/logs?limit=20`),
        ]);

        setEndpoint(epData);
        setStats(statsData);
        setRecentLogs(logsData.logs || []);
        setChartData(
          (logsData.logs || [])
            .slice()
            .reverse()
            .map((l) => ({
              time: l.checkedAt,
              responseTime: l.responseTimeMs,
            }))
            .filter((d) => d.responseTime != null)
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (!socket) return;

    const handlePingResult = (result) => {
      if (result.endpointId !== id) return;

      setEndpoint((prev) => ({
        ...prev,
        status: result.status,
      }));

      const newLog = {
        checkedAt: result.checkedAt,
        isUp: result.isUp,
        responseTimeMs: result.responseTimeMs,
        statusCode: result.statusCode,
      };

      setRecentLogs((prev) => [newLog, ...prev].slice(0, 20));

      setChartData((prev) => {
        if (result.responseTimeMs == null) return prev;
        const newPoint = { time: result.checkedAt, responseTime: result.responseTimeMs };
        return [...prev, newPoint].slice(-50);
      });
    };

    socket.on('ping:result', handlePingResult);
    return () => socket.off('ping:result', handlePingResult);
  }, [socket, id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this endpoint?')) return;
    try {
      await api.delete(`/endpoints/${id}`);
      navigate('/dashboard');
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleUpdate = (updatedEndpoint) => {
    setEndpoint((prev) => ({ ...prev, ...updatedEndpoint }));
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          <div className="page">
            <Card style={{ padding: 24 }}>
              <Skeleton width="50%" height={28} />
              <div style={{ marginTop: 12 }}>
                <Skeleton width="70%" height={14} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 28 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={88} radius="var(--radius-lg)" />
                ))}
              </div>
            </Card>
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
            <Card style={{ padding: 28, textAlign: 'center', color: 'var(--danger-text)' }}>
              Error: {error}
            </Card>
          </div>
        </main>
      </div>
    );
  }
  if (!endpoint) return null;

  const isUp = endpoint.status === 'UP';

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
                className={`status-dot ${isUp ? 'status-dot--up' : 'status-dot--down'} status-dot--pulse`}
                style={{ width: 12, height: 12, flexShrink: 0 }}
                aria-hidden="true"
              />
            }
            title={endpoint.name}
            subtitle={
              <span className="mono" style={{ color: 'var(--text-muted)' }}>
                {endpoint.url}
              </span>
            }
            actions={
              <>
                <Button variant="secondary" icon={Edit2} onClick={() => setEditModalOpen(true)}>
                  Edit
                </Button>
                <Button variant="danger" icon={Trash2} onClick={handleDelete}>
                  Delete
                </Button>
              </>
            }
          />

          {stats && (
            <div className="stat-grid animate-fade-in">
              <StatCard
                icon={ShieldCheck}
                label="Uptime (24h)"
                value={`${stats.uptimePercentage}%`}
                color={stats.uptimePercentage > 98 ? 'success' : 'danger'}
              />
              <StatCard icon={Zap} label="Avg Response" value={`${stats.avgResponseTime}ms`} color="info" />
              <StatCard icon={Activity} label="P95 Latency" value={`${stats.p95Latency}ms`} color="accent" />
              <StatCard icon={Server} label="Total Checks" value={stats.totalChecks} color="neutral" />
              <StatCard
                icon={AlertTriangle}
                label="Failures"
                value={stats.totalFailures}
                color={stats.totalFailures > 0 ? 'danger' : 'neutral'}
              />
            </div>
          )}

          <div className="section">
            <Card style={{ padding: 24 }}>
              <h2 className="section__title">
                <Activity size={17} style={{ color: 'var(--accent-text)' }} />
                Response Time
              </h2>
              <ResponseChart data={chartData} />
            </Card>
          </div>

          <div className="section">
            <h2 className="section__title">
              <Clock size={17} style={{ color: 'var(--accent-text)' }} />
              Recent Pings
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
                      <tr key={i} className="animate-fade-in">
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(log.checkedAt).toLocaleTimeString()}
                        </td>
                        <td>
                          <Badge tone={log.isUp ? 'up' : 'down'} dot>
                            {log.isUp ? 'UP' : 'DOWN'}
                          </Badge>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {Math.round(log.responseTimeMs)} ms
                        </td>
                        <td className="mono" style={{ color: log.isUp ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          {log.statusCode || 'ERR'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentLogs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Waiting for first ping result...
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
    </div>
  );
};
