import React, { useState, useEffect } from 'react';
import { Plus, Activity, CheckCircle, XCircle, Zap, Server, Wifi } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { EndpointCard } from '../components/EndpointCard';
import { AddEndpointModal } from '../components/AddEndpointModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
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
      setEndpoints((prev) =>
        prev.map((ep) => {
          if (ep.id === result.endpointId) {
            return {
              ...ep,
              status: result.status,
              lastResponseTime: result.responseTimeMs,
              lastChecked: result.checkedAt,
            };
          }
          return ep;
        })
      );
    };

    socket.on('ping:result', handlePingResult);
    return () => socket.off('ping:result', handlePingResult);
  }, [socket]);

  const handleAddEndpoint = (newEndpoint) => {
    setEndpoints((prev) => [newEndpoint, ...prev]);
  };

  const totalEndpoints = endpoints.length;
  const onlineEndpoints = endpoints.filter((ep) => ep.status === 'UP').length;
  const offlineEndpoints = endpoints.filter((ep) => ep.status === 'DOWN').length;

  const avgResponseTime =
    endpoints.length > 0
      ? Math.round(endpoints.reduce((acc, ep) => acc + (ep.lastResponseTime || 0), 0) / endpoints.length)
      : 0;

  const uptimePercent =
    totalEndpoints > 0 ? Math.round((onlineEndpoints / totalEndpoints) * 100) : 100;

  const openMenu = () => setSidebarOpen(true);

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Dashboard"
            subtitle="Monitor your endpoints in real-time"
            onMenu={openMenu}
            actions={
              <>
                <span className={`live-badge ${isConnected ? '' : 'live-badge--off'}`}>
                  <span
                    className={`status-dot ${isConnected ? 'status-dot--up status-dot--pulse' : 'status-dot--neutral'}`}
                  />
                  {isConnected ? 'Live' : 'Connecting...'}
                </span>
                <div className="avatar" aria-hidden="true">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <Button onClick={() => setModalOpen(true)} icon={Plus}>
                  Add Endpoint
                </Button>
              </>
            }
          />

          {loading ? (
            <LoadingSkeleton type="stats" />
          ) : (
            <div className="stat-grid animate-fade-in">
              <StatCard icon={Server} label="Total Endpoints" value={totalEndpoints} color="neutral" />
              <StatCard icon={CheckCircle} label="Online" value={onlineEndpoints} color="success" />
              <StatCard icon={XCircle} label="Offline" value={offlineEndpoints} color={offlineEndpoints > 0 ? 'danger' : 'neutral'} />
              <StatCard icon={Zap} label="Avg Response" value={`${avgResponseTime}ms`} color="info" />
            </div>
          )}

          <div className="section">
            <h2 className="section__title">
              <Activity size={17} style={{ color: 'var(--accent-text)' }} />
              Your Endpoints
            </h2>

            {loading ? (
              <LoadingSkeleton type="endpoints" count={3} />
            ) : endpoints.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Wifi}
                  title="No endpoints yet"
                  description="Add your first endpoint to start tracking uptime and response times."
                  action={
                    <Button onClick={() => setModalOpen(true)} icon={Plus}>
                      Add your first endpoint
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="endpoints-grid">
                {endpoints.map((ep) => (
                  <EndpointCard key={ep.id} endpoint={ep} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <AddEndpointModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddEndpoint}
      />
    </div>
  );
};
