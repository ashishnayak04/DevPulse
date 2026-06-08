import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Clock, Activity, AlertTriangle, ShieldCheck, CheckCircle, Zap, Server, Menu } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { StatCard } from '../components/StatCard';
import { ResponseChart } from '../components/ResponseChart';
import { EditEndpointModal } from '../components/EditEndpointModal';
import { Sidebar } from '../components/Sidebar';

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
          api.get(`/endpoints/${id}/logs?limit=20`)
        ]);

        setEndpoint(epData);
        setStats(statsData);
        setRecentLogs(logsData.logs || []);
        setChartData(
          (logsData.logs || []).slice().reverse().map(l => ({
            time: l.checkedAt,
            responseTime: l.responseTimeMs,
          })).filter(d => d.responseTime != null)
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

      setEndpoint(prev => ({
        ...prev,
        status: result.status,
      }));

      const newLog = {
        checkedAt: result.checkedAt,
        isUp: result.isUp,
        responseTimeMs: result.responseTimeMs,
        statusCode: result.statusCode
      };

      setRecentLogs(prev => [newLog, ...prev].slice(0, 20));

      setChartData(prev => {
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
    setEndpoint(prev => ({ ...prev, ...updatedEndpoint }));
  };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spin" style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: '#a78bfa', borderRadius: '50%' }} />
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: '#f87171' }}>Error: {error}</div>
    </div>
  );
  if (!endpoint) return null;

  const isUp = endpoint.status === 'UP';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <style>{`
          .epd-header {
            display: flex; align-items: center; gap: 16px; margin-bottom: 36px;
          }
          .epd-back-btn {
            width: 40px; height: 40px; border-radius: 12px;
            background: rgba(255,255,255,0.04); border: 1px solid var(--border);
            color: var(--text-muted); cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .epd-back-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
          .epd-status-dot {
            width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
          }
          .epd-status-dot.up { background: #34d399; box-shadow: 0 0 16px rgba(16,185,129,0.4); }
          .epd-status-dot.down { background: #f87171; box-shadow: 0 0 16px rgba(239,68,68,0.4); }
          .epd-info { flex: 1; min-width: 0; }
          .epd-info h1 {
            font-size: 26px; font-weight: 700; letter-spacing: -0.5px;
            display: flex; align-items: center; gap: 12px;
          }
          .epd-info .epd-url {
            font-size: 14px; color: var(--text-muted); margin-top: 4px;
            font-family: 'JetBrains Mono', monospace;
          }
          .epd-actions {
            display: flex; gap: 12px;
          }
          .epd-action-btn {
            padding: 10px 20px; border-radius: var(--radius-sm);
            border: 1px solid var(--border); cursor: pointer;
            display: flex; align-items: center; gap: 8px;
            font-size: 13px; font-weight: 500;
            transition: all 0.2s;
          }
          .epd-action-btn.edit {
            background: rgba(255,255,255,0.04); color: var(--text-secondary);
          }
          .epd-action-btn.edit:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
          .epd-action-btn.delete {
            background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.15); color: #f87171;
          }
          .epd-action-btn.delete:hover { background: rgba(239,68,68,0.12); }
          .epd-stats-row {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px; margin-bottom: 36px;
          }
          .epd-section-title {
            font-size: 16px; font-weight: 600; margin-bottom: 16px;
            display: flex; align-items: center; gap: 10px;
          }
          .epd-log-row {
            display: flex; align-items: center; gap: 12px;
            padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.03);
            transition: background 0.2s;
          }
          .epd-log-row:hover { background: rgba(139,92,246,0.02); }
          .epd-log-row:last-child { border-bottom: none; }
          .epd-log-time { font-size: 13px; color: var(--text-muted); width: 80px; }
          .epd-log-status {
            display: flex; align-items: center; gap: 8px; width: 100px;
            font-size: 13px; font-weight: 500;
          }
          .epd-log-rt { font-size: 13px; color: var(--text-muted); width: 80px; }
          .epd-log-code { font-size: 13px; width: 60px; }
        `}</style>

        <header className="epd-header">
          <button className="md-hidden epd-back-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <button className="epd-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div className={`epd-status-dot ${isUp ? 'up' : 'down'} pulse`} />
          <div className="epd-info">
            <h1>
              {endpoint.name}
              <span style={{
                fontSize: 13, fontWeight: 500, padding: '4px 12px', borderRadius: 100,
                background: isUp ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                color: isUp ? '#34d399' : '#f87171',
                border: `1px solid ${isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`
              }}>
                {isUp ? 'Operational' : 'Down'}
              </span>
            </h1>
            <div className="epd-url">{endpoint.url}</div>
          </div>
          <div className="epd-actions">
            <button className="epd-action-btn edit" onClick={() => setEditModalOpen(true)}>
              <Edit2 size={16} /> Edit
            </button>
            <button className="epd-action-btn delete" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </header>

        {/* Stats */}
        {stats && (
          <div className="epd-stats-row animate-fade-in">
            <StatCard icon={ShieldCheck} label="Uptime (24h)" value={`${stats.uptimePercentage}%`} color={stats.uptimePercentage > 98 ? 'emerald' : 'red'} />
            <StatCard icon={Zap} label="Avg Response" value={`${stats.avgResponseTime}ms`} color="cyan" />
            <StatCard icon={Activity} label="P95 Latency" value={`${stats.p95Latency}ms`} color="purple" />
            <StatCard icon={Server} label="Total Checks" value={stats.totalChecks} color="gray" />
            <StatCard icon={AlertTriangle} label="Failures" value={stats.totalFailures} color={stats.totalFailures > 0 ? 'red' : 'gray'} />
          </div>
        )}

        {/* Chart */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '36px' }}>
          <h3 className="epd-section-title">
            <Activity size={18} style={{ color: '#a78bfa' }} />
            Response Time
          </h3>
          <ResponseChart data={chartData} />
        </div>

        {/* Logs */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 12px' }}>
            <h3 className="epd-section-title">
              <Clock size={18} style={{ color: '#a78bfa' }} />
              Recent Pings
            </h3>
          </div>
          <div>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px',
              borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 600,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              <div style={{ width: 80 }}>Time</div>
              <div style={{ width: 100 }}>Status</div>
              <div style={{ width: 80 }}>Latency</div>
              <div style={{ width: 60 }}>Code</div>
            </div>

            {recentLogs.map((log, i) => (
              <div key={i} className="epd-log-row animate-fade-in" style={{
                backgroundColor: log.isUp ? 'transparent' : 'rgba(239,68,68,0.04)'
              }}>
                <div className="epd-log-time">{new Date(log.checkedAt).toLocaleTimeString()}</div>
                <div className="epd-log-status">
                  <span className={`status-dot ${log.isUp ? 'status-up' : 'status-down'}`} style={{ width: 8, height: 8 }} />
                  {log.isUp ? 'UP' : 'DOWN'}
                </div>
                <div className="epd-log-rt">{Math.round(log.responseTimeMs)} ms</div>
                <div className="epd-log-code" style={{
                  color: log.isUp ? '#34d399' : '#f87171',
                  fontFamily: '"JetBrains Mono", monospace'
                }}>
                  {log.statusCode || 'ERR'}
                </div>
              </div>
            ))}

            {recentLogs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Waiting for first ping result...
              </div>
            )}
          </div>
        </div>

        <EditEndpointModal
          key={endpoint.id}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          endpoint={endpoint}
          onUpdate={handleUpdate}
        />
      </main>
    </div>
  );
};
