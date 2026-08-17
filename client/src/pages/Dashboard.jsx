import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X, Wifi, ShieldCheck } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { AddEndpointModal } from '../components/AddEndpointModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Segmented } from '../components/ui/Segmented';
import { Sparkline } from '../components/ui/Sparkline';
import { Badge } from '../components/ui/Badge';
import { RelativeTime } from '../components/RelativeTime';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatInterval } from '../utils/time';

const ENDPOINT_HISTORY_LIMIT = 24;

function BoardSkeleton({ count = 5 }) {
  return (
    <Card className="board">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="board__row" style={{ cursor: 'default' }}>
          <div className="board__cell">
            <Skeleton width="55%" height={13} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width="70%" height={10} />
            </div>
          </div>
          <div className="board__cell">
            <Skeleton width={80} height={18} radius="var(--radius-pill)" />
          </div>
          <div className="board__cell">
            <Skeleton width={120} height={12} />
          </div>
          <div className="board__cell">
            <Skeleton width={44} height={12} />
          </div>
          <div className="board__cell">
            <Skeleton width={52} height={12} />
          </div>
          <div className="board__cell">
            <Skeleton width={64} height={12} />
          </div>
        </div>
      ))}
    </Card>
  );
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const data = await api.get('/endpoints');
        if (cancelled) return;
        setEndpoints(data);

        const historyEntries = await Promise.allSettled(
          data.map(async (ep) => {
            const res = await api.get(`/endpoints/${ep.id}/logs?limit=${ENDPOINT_HISTORY_LIMIT}`);
            return [ep.id, res.logs || []];
          })
        );

        if (cancelled) return;
        const next = {};
        for (const entry of historyEntries) {
          if (entry.status === 'fulfilled') next[entry.value[0]] = entry.value[1];
        }
        setHistory(next);
      } catch (err) {
        console.error('Failed to load endpoints:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePingResult = (result) => {
      setEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === result.endpointId
            ? {
                ...ep,
                status: result.status,
                lastResponseTime: result.responseTimeMs,
                lastChecked: result.checkedAt,
                lastStatusCode: result.statusCode,
              }
            : ep
        )
      );

      setHistory((prev) => {
        const current = prev[result.endpointId] || [];
        const point = {
          checkedAt: result.checkedAt,
          isUp: result.isUp,
          responseTimeMs: result.responseTimeMs,
          statusCode: result.statusCode,
        };
        return { ...prev, [result.endpointId]: [point, ...current].slice(0, 60) };
      });
    };

    socket.on('ping:result', handlePingResult);
    return () => socket.off('ping:result', handlePingResult);
  }, [socket]);

  const handleAddEndpoint = useCallback((newEndpoint) => {
    setEndpoints((prev) => [newEndpoint, ...prev]);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints.filter((ep) => {
      if (statusFilter === 'up' && ep.status !== 'UP') return false;
      if (statusFilter === 'down' && ep.status !== 'DOWN') return false;
      if (!q) return true;
      return (
        ep.name.toLowerCase().includes(q) ||
        ep.url.toLowerCase().includes(q)
      );
    });
  }, [endpoints, query, statusFilter]);

  const summary = useMemo(() => {
    const total = endpoints.length;
    const down = endpoints.filter((ep) => ep.status === 'DOWN').length;
    const up = total - down;

    const withLatency = endpoints.filter((ep) => ep.lastResponseTime != null);
    const avgLatency =
      withLatency.length > 0
        ? Math.round(withLatency.reduce((acc, ep) => acc + ep.lastResponseTime, 0) / withLatency.length)
        : null;

    let uptimeSum = 0;
    let uptimeCount = 0;
    for (const ep of endpoints) {
      const logs = history[ep.id] || [];
      const ok = logs.filter((l) => l.isUp).length;
      if (logs.length > 0) {
        uptimeSum += (ok / logs.length) * 100;
        uptimeCount += 1;
      }
    }
    const avgUptime = uptimeCount > 0 ? Math.round(uptimeSum / uptimeCount) : null;

    return { total, up, down, avgLatency, avgUptime };
  }, [endpoints, history]);

  const allOperational = summary.total > 0 && summary.down === 0;
  const subtitle = summary.total === 0
    ? 'No endpoints monitored yet'
    : summary.down > 0
      ? `${summary.down} of ${summary.total} endpoints down`
      : `${summary.total} endpoints · all operational`;

  const openMenu = () => setSidebarOpen(true);

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Monitor"
            subtitle={subtitle}
            onMenu={openMenu}
            actions={
              <>
                <span className={`live-chip ${isConnected ? 'live-chip--on' : 'live-chip--off'}`}>
                  <span
                    className={`status-dot ${isConnected ? 'status-dot--up status-dot--pulse' : 'status-dot--neutral'}`}
                  />
                  {isConnected ? 'Live' : 'Connecting…'}
                </span>
                <Button onClick={() => setModalOpen(true)} icon={Plus}>
                  Add endpoint
                </Button>
              </>
            }
          />

          <div className="status-strip animate-fade-in">
            <div className="status-strip__status">
              <span
                className={`status-dot status-dot--lg ${
                  summary.total === 0
                    ? 'status-dot--neutral'
                    : allOperational
                      ? 'status-dot--up status-dot--pulse'
                      : 'status-dot--down status-dot--pulse'
                }`}
                aria-hidden="true"
              />
              <div>
                <div className="status-strip__title">
                  {summary.total === 0
                    ? 'Nothing monitored yet'
                    : allOperational
                      ? 'All systems operational'
                      : `${summary.down} ${summary.down === 1 ? 'endpoint is' : 'endpoints are'} down`}
                </div>
                <div className="status-strip__sub">
                  {summary.total === 0
                    ? 'Add an endpoint to start collecting signals'
                    : allOperational
                      ? `Last check signal received just now`
                      : 'Incidents may have triggered email alerts'}
                </div>
              </div>
            </div>

            <div className="status-strip__readouts">
              <div className="readout">
                <span className="readout__label">Monitored</span>
                <span className="readout__value">{summary.total}</span>
              </div>
              <span className="status-strip__divider" aria-hidden="true" />
              <div className="readout">
                <span className="readout__label">Down</span>
                <span className={`readout__value ${summary.down > 0 ? 'readout__value--danger' : 'readout__value--success'}`}>
                  {summary.down}
                </span>
              </div>
              <span className="status-strip__divider" aria-hidden="true" />
              <div className="readout">
                <span className="readout__label">Avg latency</span>
                <span className="readout__value">{summary.avgLatency != null ? `${summary.avgLatency}ms` : '—'}</span>
              </div>
              <span className="status-strip__divider" aria-hidden="true" />
              <div className="readout">
                <span className="readout__label">Uptime</span>
                <span className={`readout__value ${summary.avgUptime != null && summary.avgUptime < 98 ? 'readout__value--warning' : ''}`}>
                  {summary.avgUptime != null ? `${summary.avgUptime}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span className="search__icon">
                <Search size={15} />
              </span>
              <input
                className="search__input"
                placeholder="Search endpoints…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search endpoints"
              />
              {query && (
                <button className="search__clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="toolbar__spacer" />
            <Segmented
              ariaLabel="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'up', label: 'Up' },
                { value: 'down', label: 'Down' },
              ]}
            />
          </div>

          {loading ? (
            <BoardSkeleton count={5} />
          ) : endpoints.length === 0 ? (
            <Card>
              <EmptyState
                icon={Wifi}
                title="No endpoints monitored yet"
                description="Add an API endpoint and DevPulse will start checking it immediately — latency and uptime signals will appear here within a minute."
                action={
                  <Button onClick={() => setModalOpen(true)} icon={Plus}>
                    Add your first endpoint
                  </Button>
                }
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No matching endpoints"
                description={
                  query
                    ? `Nothing matches "${query}". Try a different name or URL.`
                    : `No ${statusFilter === 'up' ? 'operational' : 'down'} endpoints right now.`
                }
              />
            </Card>
          ) : (
            <Card className="board animate-fade-in">
              <div className="board__head">
                <span className="board__head-cell">Endpoint</span>
                <span className="board__head-cell">Status</span>
                <span className="board__head-cell">Response time</span>
                <span className="board__head-cell">Uptime</span>
                <span className="board__head-cell">Interval</span>
                <span className="board__head-cell">Last checked</span>
              </div>

              {filtered.map((ep) => {
                const isUp = ep.status === 'UP';
                const logs = history[ep.id] || [];
                const okCount = logs.filter((l) => l.isUp).length;
                const uptime = logs.length > 0 ? Math.round((okCount / logs.length) * 100) : null;
                const sparkData = logs
                  .slice()
                  .reverse()
                  .map((l) => l.responseTimeMs)
                  .filter((v) => v != null);
                const latency = ep.lastResponseTime ?? ep.pingLogs?.[0]?.responseTimeMs ?? null;

                return (
                  <div
                    key={ep.id}
                    className="board__row animate-fade-in"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/endpoints/${ep.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/endpoints/${ep.id}`);
                      }
                    }}
                  >
                    <span className={`board__rail ${isUp ? '' : 'board__rail--down'}`} aria-hidden="true" />
                    <div className="board__cell board__cell--name">
                      <div className="board__name">{ep.name}</div>
                      <div className="board__url">{ep.url}</div>
                    </div>
                    <div className="board__cell board__cell--status">
                      <Badge tone={isUp ? 'up' : 'down'} dot pulse>
                        {isUp ? 'Operational' : 'Down'}
                      </Badge>
                    </div>
                    <div className="board__cell board__cell--latency">
                      <div className="board__latency">
                        <span className={`board__latency-value ${isUp ? '' : 'board__latency-value--down'}`}>
                          {latency != null ? `${Math.round(latency)}ms` : '—'}
                        </span>
                        {sparkData.length > 1 && (
                          <Sparkline
                            data={sparkData}
                            color={isUp ? 'var(--success)' : 'var(--danger)'}
                          />
                        )}
                      </div>
                    </div>
                    <div className="board__cell board__cell--uptime">
                      <span className={`board__value ${uptime != null && uptime < 98 ? 'board__value--muted' : ''}`}>
                        {uptime != null ? `${uptime}%` : '—'}
                      </span>
                    </div>
                    <div className="board__cell board__cell--interval">
                      <span className="board__value board__value--muted">{formatInterval(ep.intervalMs)}</span>
                    </div>
                    <div className="board__cell board__cell--meta">
                      <span className={`board__value ${ep.lastChecked ? '' : 'board__value--muted'}`}>
                        {ep.lastChecked ? <RelativeTime time={ep.lastChecked} /> : 'pending first check'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {!loading && endpoints.length > 0 && (
            <p className="muted" style={{ marginTop: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} style={{ color: 'var(--accent)' }} />
              Uptime reflects the most recent {ENDPOINT_HISTORY_LIMIT} checks. Rows update live as checks complete.
            </p>
          )}
        </div>
      </main>

      <AddEndpointModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAddEndpoint} />
    </div>
  );
};


export default Dashboard;
