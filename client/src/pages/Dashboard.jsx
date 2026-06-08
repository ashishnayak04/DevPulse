import React, { useState, useEffect } from 'react';
import { Menu, Plus, Activity, CheckCircle, XCircle, Clock, LayoutDashboard, Zap, Wifi, Server } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { EndpointCard } from '../components/EndpointCard';
import { AddEndpointModal } from '../components/AddEndpointModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { api } from '../api';

export const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const data = await api.get('/endpoints');
        setEndpoints(data);
      } catch (err) {
        console.error('Failed to fetch endpoints:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEndpoints();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePingResult = (result) => {
      setEndpoints(prev => prev.map(ep => {
        if (ep.id === result.endpointId) {
          return {
            ...ep,
            status: result.status,
            lastResponseTime: result.responseTimeMs,
            lastChecked: result.checkedAt
          };
        }
        return ep;
      }));
    };

    socket.on('ping:result', handlePingResult);
    return () => socket.off('ping:result', handlePingResult);
  }, [socket]);

  const handleAddEndpoint = (newEndpoint) => {
    setEndpoints(prev => [newEndpoint, ...prev]);
  };

  const totalEndpoints = endpoints.length;
  const onlineEndpoints = endpoints.filter(ep => ep.status === 'UP').length;
  const offlineEndpoints = endpoints.filter(ep => ep.status === 'DOWN').length;

  const avgResponseTime = endpoints.length > 0
    ? Math.round(endpoints.reduce((acc, ep) => acc + (ep.lastResponseTime || 0), 0) / endpoints.length)
    : 0;

  const uptimePercent = totalEndpoints > 0
    ? Math.round((onlineEndpoints / totalEndpoints) * 100)
    : 100;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <style>{`
          .dash-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 36px;
          }
          .dash-header-left {
            display: flex; align-items: center; gap: 16px;
          }
          .dash-greeting h1 {
            font-size: 28px; font-weight: 700; letter-spacing: -0.5px;
          }
          .dash-greeting p {
            font-size: 14px; color: var(--text-muted); margin-top: 4px;
          }
          .dash-header-right {
            display: flex; align-items: center; gap: 20px;
          }
          .dash-live-badge {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 16px; border-radius: 100px;
            background: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.15);
            font-size: 12px; font-weight: 500; color: #34d399;
          }
          .dash-avatar {
            width: 42px; height: 42px; border-radius: 14px;
            background: var(--accent-gradient);
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 18px; color: #fff;
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
          }
          .dash-section-title {
            font-size: 18px; font-weight: 600; margin-bottom: 20px;
            display: flex; align-items: center; gap: 10px; color: var(--text-primary);
          }
          .dash-empty {
            padding: 64px 48px; text-align: center; color: var(--text-muted);
          }
          .dash-empty-icon {
            width: 80px; height: 80px; border-radius: 24px;
            background: rgba(139, 92, 246, 0.06);
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 20px;
          }
          .dash-empty h3 {
            font-size: 18px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;
          }
          .dash-empty p { font-size: 14px; }
        `}</style>

        {/* Top Bar */}
        <header className="dash-header">
          <div className="dash-header-left">
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
            <div className="dash-greeting">
              <h1>
                <span className="text-gradient">Dashboard</span>
              </h1>
              <p>Monitor your endpoints in real-time</p>
            </div>
          </div>
          <div className="dash-header-right">
            <div className="dash-live-badge">
              <span className={`status-dot ${isConnected ? 'status-up pulse' : 'status-down'}`} style={{ width: 8, height: 8 }} />
              {isConnected ? 'Live' : 'Connecting...'}
            </div>
            <div className="dash-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Stats Row */}
        {loading ? (
          <LoadingSkeleton type="stats" />
        ) : (
          <div className="stats-grid animate-fade-in">
            <StatCard icon={Server} label="Total Endpoints" value={totalEndpoints} color="purple" />
            <StatCard icon={CheckCircle} label="Online" value={onlineEndpoints} color="emerald" />
            <StatCard icon={XCircle} label="Offline" value={offlineEndpoints} color="red" />
            <StatCard icon={Zap} label="Avg Response" value={`${avgResponseTime}ms`} color="cyan" />
          </div>
        )}

        {/* Endpoints Section */}
        <div className="dash-section-title">
          <Activity size={20} style={{ color: '#a78bfa' }} />
          Your Endpoints
        </div>

        {loading ? (
          <div className="endpoints-grid">
            {[1, 2, 3].map(i => <LoadingSkeleton key={i} />)}
          </div>
        ) : endpoints.length === 0 ? (
          <div className="glass-card dash-empty">
            <div className="dash-empty-icon">
              <Wifi size={36} style={{ color: '#a78bfa' }} />
            </div>
            <h3>No endpoints yet</h3>
            <p>Click the <strong style={{ color: 'var(--text-secondary)' }}>+</strong> button below to add your first endpoint</p>
          </div>
        ) : (
          <div className="endpoints-grid">
            {endpoints.map(ep => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        )}

        {/* FAB */}
        <button className="fab" onClick={() => setModalOpen(true)} title="Add Endpoint">
          <Plus size={26} />
        </button>

        <AddEndpointModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onAdd={handleAddEndpoint}
        />
      </main>
    </div>
  );
};
