import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  Users,
  Server,
  Database,
  Cpu,
  Wifi,
  AlertTriangle,
  Activity as PulseIcon,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, StatusPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatInterval, formatRelative, formatTime, groupByDay } from '../utils/time';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'endpoints', label: 'Endpoints' },
  { value: 'users', label: 'Users' },
  { value: 'events', label: 'Events' },
];

const SystemTile = ({ label, icon: Icon, state, detail }) => (
  <div className="admin-system__tile">
    <div className="admin-system__tile-head">
      <Icon size={15} className="admin-system__icon" />
      <span className="admin-system__tile-label">{label}</span>
    </div>
    <div className="admin-system__tile-state">
      <span className={`status-dot ${state === 'up' ? 'status-dot--up' : 'status-dot--down'}`} />
      <span className={`admin-system__state-text ${state === 'up' ? '' : 'admin-system__state-text--down'}`}>
        {state === 'up' ? 'Up' : 'Down'}
      </span>
    </div>
    {detail && <div className="admin-system__tile-detail">{detail}</div>}
  </div>
);

const StatTile = ({ label, value, tone, sub, icon: Icon, suffix }) => (
  <div className="stat-tile">
    <div className="stat-tile__label">
      {Icon && <Icon size={13} className="stat-tile__icon" />}
      {label}
    </div>
    <div className={`stat-tile__value ${tone ? `stat-tile__value--${tone}` : ''}`}>
      {value}
      {suffix && <span className="stat-tile__suffix">{suffix}</span>}
    </div>
    {sub && <div className="stat-tile__sub">{sub}</div>}
  </div>
);

const Admin = () => {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [ov, us, ep, act] = await Promise.all([
          api.get('/admin/overview'),
          api.get('/admin/users'),
          api.get('/admin/endpoints'),
          api.get('/admin/activity?limit=100'),
        ]);
        setOverview(ov);
        setUsers(us);
        setEndpoints(ep);
        setActivity(act);
      } catch (err) {
        addToast(err.message || 'Failed to load platform data', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab !== 'overview') return;
    const id = setInterval(() => loadAll(true), 30000);
    return () => clearInterval(id);
  }, [tab, loadAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll(true);
  };

  const changeUser = async (user, patch, successMsg) => {
    setBusyId(user.id);
    try {
      const updated = await api.patch(`/admin/users/${user.id}`, patch);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      addToast(successMsg, 'success');
    } catch (err) {
      addToast(err.message || 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      addToast(`Deleted ${deleteTarget.username}`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const stats = overview?.stats;
  const system = overview?.system;
  const isSelf = (id) => me?.id === id;

  const renderOverview = () => {
    if (!overview) return null;
    const upRatio = stats.endpoints.total > 0
      ? Math.round((stats.endpoints.up / stats.endpoints.total) * 100)
      : 100;

    return (
      <>
        <Card className="admin-system">
          <SystemTile label="API server" icon={Cpu} state="up" />
          <SystemTile label="Database" icon={Database} state={system.database} />
          <SystemTile label="Redis" icon={Wifi} state={system.redis} />
          <SystemTile
            label="Ping queue"
            icon={PulseIcon}
            state="up"
            detail={
              system.queues.ping
                ? `${system.queues.ping.waiting ?? 0} waiting · ${system.queues.ping.delayed ?? 0} delayed · ${system.queues.ping.failed ?? 0} failed`
                : '—'
            }
          />
          <SystemTile
            label="Alert queue"
            icon={AlertTriangle}
            state="up"
            detail={
              system.queues.alert
                ? `${system.queues.alert.waiting ?? 0} waiting · ${system.queues.alert.failed ?? 0} failed`
                : '—'
            }
          />
        </Card>

        <div className="admin-stats">
          <StatTile label="Users" value={stats.users.total} icon={Users} sub={`${stats.users.admins} admin · ${stats.users.disabled} disabled`} />
          <StatTile label="Endpoints" value={stats.endpoints.total} icon={Server} sub={`${stats.endpoints.active} active`} />
          <StatTile label="Operational" value={upRatio} tone={upRatio === 100 ? 'up' : upRatio > 0 ? 'warning' : 'down'} sub={`${stats.endpoints.up} up · ${stats.endpoints.down} down`} suffix="%" />
          <StatTile label="Checks · 24h" value={stats.checks24h} sub={`${stats.failures24h} failures`} />
          <StatTile label="Avg latency" value={stats.avgResponseTime24h} tone={stats.avgResponseTime24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
          <StatTile label="P95 latency" value={stats.p95Latency24h} tone={stats.p95Latency24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
          <StatTile label="Alerts · 24h" value={stats.alerts24h} tone={stats.alerts24h > 0 ? 'warning' : 'up'} sub="DOWN / RECOVERY" />
        </div>

        <div className="settings-section" style={{ marginTop: 24 }}>
          <div className="settings-section__head">
            <AlertTriangle size={16} />
            <div>
              <h2 className="settings-section__title">Recent alerts</h2>
              <p className="settings-section__desc">Latest state changes across every user on the platform.</p>
            </div>
          </div>
          <Card style={{ padding: 0 }}>
            {overview.recentAlerts.length === 0 ? (
              <EmptyState
                icon={Wifi}
                title="No alerts in the last 24h"
                description="Every service on the platform has been quiet."
              />
            ) : (
              <div className="event-list">
                {overview.recentAlerts.map((a) => (
                  <div className={`event ${a.type === 'DOWN' ? 'event--down' : ''}`} key={a.id}>
                    <div className={`event__icon ${a.type === 'DOWN' ? 'event__icon--danger' : 'event__icon--success'}`}>
                      {a.type === 'DOWN' ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                    </div>
                    <div className="event__body">
                      <div className="event__title">
                        {a.endpoint?.name || 'Unknown endpoint'}
                        <Badge tone={a.type === 'DOWN' ? 'down' : 'up'} className="event__badge">
                          {a.type === 'DOWN' ? 'DOWN' : 'RECOVERED'}
                        </Badge>
                      </div>
                      <div className="event__url">
                        @{a.endpoint?.user?.username || 'unknown'}
                      </div>
                    </div>
                    <div className="event__time">
                      <div className="event__time-main">{formatTime(a.sentAt)}</div>
                      <div className="event__time-sub">{formatRelative(a.sentAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </>
    );
  };

  const renderEndpoints = () => (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {endpoints.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No endpoints on the platform"
          description="Endpoints users create will appear here."
        />
      ) : (
        <div className="board">
          <div className="board__head board__head--admin-endpoints">
            <span className="board__head-cell">Endpoint</span>
            <span className="board__head-cell">Owner</span>
            <span className="board__head-cell">Status</span>
            <span className="board__head-cell">Response</span>
            <span className="board__head-cell">Interval</span>
            <span className="board__head-cell">Created</span>
          </div>
          {endpoints.map((ep) => (
            <div
              className="board__row board__row--admin-endpoints"
              key={ep.id}
              onClick={() => navigate(`/endpoints/${ep.id}`)}
            >
              <span className={`board__rail ${ep.status === 'DOWN' ? 'board__rail--down' : ''}`} />
              <div className="board__cell">
                <div className="board__name">{ep.name}</div>
                <div className="board__url">{ep.url}</div>
              </div>
              <div className="board__cell">
                <span className="board__value">{ep.user?.username}</span>
              </div>
              <div className="board__cell">
                <StatusPill status={ep.status} pulse={ep.isActive} />
              </div>
              <div className="board__cell">
                <span className={`board__latency-value ${ep.pingLogs?.[0]?.isUp === false ? 'board__latency-value--down' : ''}`}>
                  {ep.pingLogs?.[0] ? `${Math.round(ep.pingLogs[0].responseTimeMs)}ms` : '—'}
                </span>
              </div>
              <div className="board__cell">
                <span className="board__value">{formatInterval(ep.intervalMs)}</span>
              </div>
              <div className="board__cell">
                <span className="board__value board__value--muted">{formatRelative(ep.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const renderUsers = () => (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Accounts that register will appear here." />
      ) : (
        <div className="board">
          <div className="board__head board__head--admin-users">
            <span className="board__head-cell">User</span>
            <span className="board__head-cell">Role</span>
            <span className="board__head-cell">Status</span>
            <span className="board__head-cell">Endpoints</span>
            <span className="board__head-cell">Created</span>
            <span className="board__head-cell board__head-cell--right">Actions</span>
          </div>
          {users.map((u) => (
            <div className="board__row board__row--admin-users" key={u.id}>
              <div className="board__cell">
                <div className="board__name">
                  {u.username}
                  {isSelf(u.id) && <Badge tone="accent" className="event__badge">You</Badge>}
                </div>
                <div className="board__url">{u.email}</div>
              </div>
              <div className="board__cell">
                <Badge tone={u.role === 'ADMIN' ? 'accent' : 'neutral'}>{u.role === 'ADMIN' ? 'ADMIN' : 'USER'}</Badge>
              </div>
              <div className="board__cell">
                <Badge tone={u.isActive ? 'up' : 'down'} dot>
                  {u.isActive ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="board__cell">
                <span className="board__value">{u.endpointCount}</span>
              </div>
              <div className="board__cell">
                <span className="board__value board__value--muted">{formatRelative(u.createdAt)}</span>
              </div>
              <div className="board__cell board__cell--right">
                {isSelf(u.id) ? (
                  <span className="admin-actions__hint">N/A</span>
                ) : (
                  <div className="admin-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyId === u.id}
                      onClick={() =>
                        changeUser(u, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' },
                          u.role === 'ADMIN' ? `Demoted ${u.username}` : `Promoted ${u.username}`)
                      }
                    >
                      {u.role === 'ADMIN' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyId === u.id}
                      onClick={() =>
                        changeUser(u, { isActive: !u.isActive },
                          u.isActive ? `Disabled ${u.username}` : `Enabled ${u.username}`)
                      }
                    >
                      {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      {u.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn--danger-ghost"
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const renderEvents = () => {
    if (!activity) return null;
    const items = [
      ...activity.alerts.map((a) => ({
        id: `alert-${a.id}`,
        time: a.sentAt,
        kind: a.type === 'DOWN' ? 'down' : 'recovery',
        endpointName: a.endpoint?.name || 'Unknown endpoint',
        owner: a.endpoint?.user?.username,
      })),
      ...activity.logs.map((l) => ({
        id: `log-${l.id}`,
        time: l.checkedAt,
        kind: l.isUp ? 'check' : 'failure',
        endpointName: l.endpoint?.name || 'Unknown endpoint',
        owner: l.endpoint?.user?.username,
        meta: l.isUp ? `${Math.round(l.responseTimeMs)}ms` : `HTTP ${l.statusCode ?? 'timeout'}`,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    const groups = groupByDay(items, (i) => i.time);

    if (groups.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={Wifi}
            title="No platform activity yet"
            description="Checks and alerts from every user will stream here."
          />
        </Card>
      );
    }

    return (
      <div className="feed">
        {groups.map((group) => (
          <section className="event-day" key={group.label}>
            <div className="event-day__label">{group.label}</div>
            <Card className="event-list" style={{ padding: 0 }}>
              {group.items.map((item) => (
                <div className={`event ${item.kind === 'down' || item.kind === 'failure' ? 'event--down' : ''}`} key={item.id}>
                  <div
                    className={`event__icon ${
                      item.kind === 'down' || item.kind === 'failure'
                        ? 'event__icon--danger'
                        : item.kind === 'recovery'
                        ? 'event__icon--success'
                        : 'event__icon--neutral'
                    }`}
                  >
                    {item.kind === 'down' ? <AlertTriangle size={15} /> : item.kind === 'recovery' ? <ShieldCheck size={15} /> : <PulseIcon size={15} />}
                  </div>
                  <div className="event__body">
                    <div className="event__title">
                      {item.endpointName}
                      <Badge
                        tone={item.kind === 'down' || item.kind === 'failure' ? 'down' : item.kind === 'recovery' ? 'up' : 'neutral'}
                        className="event__badge"
                      >
                        {item.kind === 'down' ? 'DOWN' : item.kind === 'recovery' ? 'RECOVERED' : 'CHECK'}
                      </Badge>
                    </div>
                    <div className="event__url">
                      @{item.owner || 'unknown'}
                      {item.meta ? ` · ${item.meta}` : ''}
                    </div>
                  </div>
                  <div className="event__time">
                    <div className="event__time-main">{formatTime(item.time)}</div>
                    <div className="event__time-sub">{formatRelative(item.time)}</div>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        ))}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Admin"
            subtitle="Platform-wide overview, services, and users"
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
            actions={
              <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
                <RefreshCw size={14} />
                Refresh
              </Button>
            }
          />

          <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Admin sections" />

          {loading && !overview ? (
            <div className="admin-loading">
              <Spinner size="lg" />
            </div>
          ) : (
            <div style={{ marginTop: 24 }}>
              {tab === 'overview' && renderOverview()}
              {tab === 'endpoints' && renderEndpoints()}
              {tab === 'users' && renderUsers()}
              {tab === 'events' && renderEvents()}
            </div>
          )}

          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={`Delete ${deleteTarget?.username}?`}
            description={`This permanently removes ${deleteTarget?.username} and all their endpoints, checks, and alerts. This cannot be undone.`}
            confirmLabel="Delete user"
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            loading={deleting}
          />
        </div>
      </main>
    </div>
  );
};

export default Admin;
