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
  History,
  Power,
  PowerOff,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Megaphone,
  UserPlus,
  KeyRound,
  BarChart3,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Sidebar } from '../components/Sidebar';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, StatusPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Input, Select } from '../components/ui/Input';
import { RelativeTime } from '../components/RelativeTime';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatInterval, formatRelative, formatTime, groupByDay } from '../utils/time';
import '../styles/admin-enhance.css';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'endpoints', label: 'Endpoints' },
  { value: 'users', label: 'Users' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'events', label: 'Events' },
  { value: 'audit', label: 'Audit' },
];

const USER_PAGE_SIZE = 50;
const ANNOUNCEMENT_MAX = 280;

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

const AlertIcon = ({ type }) => {
  if (type === 'DOWN') {
    return (
      <span className="adm-alert-icon adm-alert-icon--down">
        <AlertTriangle size={14} />
      </span>
    );
  }
  if (type === 'SSL_EXPIRY') {
    return (
      <span className="adm-alert-icon adm-alert-icon--warning">
        <KeyRound size={14} />
      </span>
    );
  }
  return (
    <span className="adm-alert-icon adm-alert-icon--up">
      <ShieldCheck size={14} />
    </span>
  );
};

const announcementTone = (type) =>
  type === 'error' ? 'down' : type === 'warning' ? 'warning' : 'accent';

const Admin = () => {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [activity, setActivity] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [togglingMonitoring, setTogglingMonitoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Users tab — filters, pagination, data
  const [userSearch, setUserSearch] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userPlan, setUserPlan] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userSort, setUserSort] = useState('createdAt');
  const [userPage, setUserPage] = useState(1);
  const [usersData, setUsersData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [usersLoading, setUsersLoading] = useState(false);

  // Users tab — detail drawer
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Announcements tab
  const [annMessage, setAnnMessage] = useState('');
  const [annType, setAnnType] = useState('info');
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [posting, setPosting] = useState(false);
  const [clearTarget, setClearTarget] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [ov, ep, act, audit] = await Promise.all([
          api.get('/admin/overview'),
          api.get('/admin/endpoints'),
          api.get('/admin/activity?limit=100'),
          api.get('/admin/audit?limit=100'),
        ]);
        setOverview(ov);
        setEndpoints(ep);
        setActivity(act);
        setAuditLogs(audit);
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

  useEffect(() => {
    let cancelled = false;
    api
      .get('/announcement')
      .then((data) => {
        if (!cancelled) setActiveAnnouncement(data?.message ? { message: data.message, type: data.type } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUserSearchDebounced(userSearch.trim());
      setUserPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadUsers = useCallback(
    async (silent = false) => {
      if (!silent) setUsersLoading(true);
      try {
        const params = new URLSearchParams();
        if (userSearchDebounced) params.set('search', userSearchDebounced);
        if (userPlan) params.set('plan', userPlan);
        if (userRole) params.set('role', userRole);
        if (userStatus) params.set('status', userStatus);
        params.set('sort', userSort);
        params.set('page', String(userPage));
        params.set('limit', String(USER_PAGE_SIZE));
        const data = await api.get(`/admin/users?${params.toString()}`);
        setUsersData(data);
        if (!data.items.length && data.page > 1) {
          setUserPage(1);
        } else {
          setUserPage(data.page);
        }
      } catch (err) {
        addToast(err.message || 'Failed to load users', 'error');
      } finally {
        setUsersLoading(false);
      }
    },
    [addToast, userSearchDebounced, userPlan, userRole, userStatus, userSort, userPage]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll(true);
  };

  const changeUser = async (user, patch, successMsg) => {
    setBusyId(user.id);
    try {
      const updated = await api.patch(`/admin/users/${user.id}`, patch);
      setUsersData((prev) => ({
        ...prev,
        items: prev.items.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
      }));
      addToast(successMsg, 'success');
    } catch (err) {
      addToast(err.message || 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleMonitoring = async () => {
    const currentlyEnabled = overview?.platform?.monitoringEnabled;
    setTogglingMonitoring(true);
    try {
      const result = await api.patch('/admin/system/monitoring', { enabled: !currentlyEnabled });
      setOverview((prev) => ({
        ...prev,
        platform: { monitoringEnabled: result.monitoringEnabled, message: result.message },
      }));
      addToast(
        result.monitoringEnabled
          ? 'Global monitoring resumed — all endpoints rescheduled'
          : 'Global monitoring paused — all checks stopped',
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Failed to toggle monitoring', 'error');
    } finally {
      setTogglingMonitoring(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setUsersData((prev) => ({
        ...prev,
        items: prev.items.filter((u) => u.id !== deleteTarget.id),
        total: Math.max(0, prev.total - 1),
      }));
      addToast(`Deleted ${deleteTarget.username}`, 'success');
      setDeleteTarget(null);
      loadUsers(true);
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = async (user) => {
    setDetailUserId(user.id);
    setDetailUser(user);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api.get(`/admin/users/${user.id}`);
      setDetail(data);
    } catch (err) {
      addToast(err.message || 'Failed to load user details', 'error');
      closeDetail();
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailUserId(null);
    setDetailUser(null);
    setDetail(null);
    setDetailLoading(false);
  };

  useEffect(() => {
    if (!detailUserId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailUserId]);

  const postAnnouncement = async () => {
    const message = annMessage.trim();
    if (!message || message.length > ANNOUNCEMENT_MAX || posting) return;
    setPosting(true);
    try {
      const result = await api.post('/admin/announcement', { message, type: annType });
      setActiveAnnouncement(result.announcement);
      setAnnMessage('');
      addToast('Announcement published', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to publish announcement', 'error');
    } finally {
      setPosting(false);
    }
  };

  const confirmClear = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/announcement');
      setActiveAnnouncement(null);
      setClearTarget(false);
      addToast('Announcement cleared', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to clear announcement', 'error');
    } finally {
      setClearing(false);
    }
  };

  const stats = overview?.stats;
  const system = overview?.system;
  const isSelf = (id) => me?.id === id;

  const renderOverview = () => {
    if (!overview) return null;
    const monitoringEnabled = overview.platform?.monitoringEnabled ?? true;
    const upRatio = stats.endpoints.total > 0
      ? Math.round((stats.endpoints.up / stats.endpoints.total) * 100)
      : 100;

    const dist = overview.planDistribution || {};
    const planData = ['FREE', 'PRO', 'BUSINESS'].map((plan) => ({
      plan,
      count: dist[plan] || 0,
    }));

    return (
      <>
        <Card style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div className="setting-row">
            <span className="setting-row__label">Global monitoring</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!monitoringEnabled && overview.platform?.message && (
                <span style={{ fontSize: 12, color: '#f59e0b' }}>{overview.platform.message}</span>
              )}
              <Badge tone={monitoringEnabled ? 'up' : 'down'} dot>
                {monitoringEnabled ? 'Running' : 'Paused'}
              </Badge>
              <Button variant="secondary" size="sm" onClick={toggleMonitoring} loading={togglingMonitoring}>
                {monitoringEnabled ? <PowerOff size={14} /> : <Power size={14} />}
                {monitoringEnabled ? 'Pause all checks' : 'Resume all checks'}
              </Button>
            </div>
          </div>
        </Card>

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
          <StatTile label="Recent signups (7d)" value={overview.recentSignups ?? 0} icon={UserPlus} sub="new accounts" tone="accent" />
          <StatTile label="Endpoints" value={stats.endpoints.total} icon={Server} sub={`${stats.endpoints.active} active`} />
          <StatTile label="Operational" value={upRatio} tone={upRatio === 100 ? 'up' : upRatio > 0 ? 'warning' : 'down'} sub={`${stats.endpoints.up} up · ${stats.endpoints.down} down`} suffix="%" />
          <StatTile label="Checks · 24h" value={stats.checks24h} sub={`${stats.failures24h} failures`} />
          <StatTile label="Avg latency" value={stats.avgResponseTime24h} tone={stats.avgResponseTime24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
          <StatTile label="P95 latency" value={stats.p95Latency24h} tone={stats.p95Latency24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
          <StatTile label="Alerts · 24h" value={stats.alerts24h} tone={stats.alerts24h > 0 ? 'warning' : 'up'} sub="DOWN / RECOVERY" />
        </div>

        <div className="settings-section" style={{ marginTop: 24 }}>
          <div className="settings-section__head">
            <BarChart3 size={16} />
            <div>
              <h2 className="settings-section__title">Plan distribution</h2>
              <p className="settings-section__desc">How many accounts sit in each pricing tier.</p>
            </div>
          </div>
          <Card>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={planData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
                <XAxis
                  dataKey="plan"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,.75)' }}
                  dy={6}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,.75)' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                  contentStyle={{
                    background: '#0f1620',
                    border: '1px solid rgba(148,163,184,.24)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ color: '#9aa6b8', fontWeight: 600 }}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
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

  const renderUsers = () => {
    const items = usersData.items;
    return (
      <>
        <div className="adm-users-toolbar">
          <div className="adm-toolbar-search">
            <Input
              icon={Search}
              placeholder="Search email or username…"
              aria-label="Search users"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by plan"
            value={userPlan}
            onChange={(e) => {
              setUserPlan(e.target.value);
              setUserPage(1);
            }}
            style={{ width: 130 }}
          >
            <option value="">Any plan</option>
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
            <option value="BUSINESS">BUSINESS</option>
          </Select>
          <Select
            aria-label="Filter by role"
            value={userRole}
            onChange={(e) => {
              setUserRole(e.target.value);
              setUserPage(1);
            }}
            style={{ width: 120 }}
          >
            <option value="">Any role</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
          <Select
            aria-label="Filter by status"
            value={userStatus}
            onChange={(e) => {
              setUserStatus(e.target.value);
              setUserPage(1);
            }}
            style={{ width: 130 }}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
          <Select
            aria-label="Sort users"
            value={userSort}
            onChange={(e) => {
              setUserSort(e.target.value);
              setUserPage(1);
            }}
            style={{ width: 160 }}
          >
            <option value="createdAt">Newest first</option>
            <option value="endpointCount">Most endpoints</option>
          </Select>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {items.length === 0 ? (
            usersLoading ? (
              <div className="admin-loading">
                <Spinner size="lg" />
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No users match"
                description="Try adjusting your search or filters."
              />
            )
          ) : (
            <div className="board" style={usersLoading ? { opacity: 0.55, pointerEvents: 'none' } : undefined}>
              <div className="board__head board__head--admin-users">
                <span className="board__head-cell">User</span>
                <span className="board__head-cell">Role</span>
                <span className="board__head-cell">Status</span>
                <span className="board__head-cell">Endpoints</span>
                <span className="board__head-cell">Created</span>
                <span className="board__head-cell board__head-cell--right">Actions</span>
              </div>
              {items.map((u) => (
                <div className="board__row board__row--admin-users" key={u.id}>
                  <div className="board__cell">
                    <div className="board__name">
                      {u.username}
                      {isSelf(u.id) && <Badge tone="accent" className="event__badge">You</Badge>}
                    </div>
                    <div className="board__url">{u.email}</div>
                    {!isSelf(u.id) ? (
                      <Select
                        value={u.plan || 'FREE'}
                        onChange={(e) => changeUser(u, { plan: e.target.value }, `${u.username} → ${e.target.value} plan`)}
                        aria-label={`Plan for ${u.username}`}
                        style={{ marginTop: 8, fontSize: 12, padding: '4px 26px 4px 10px', width: 'auto' }}
                      >
                        <option value="FREE">FREE</option>
                        <option value="PRO">PRO</option>
                        <option value="BUSINESS">BUSINESS</option>
                      </Select>
                    ) : (
                      <Badge tone="accent">{u.plan || 'FREE'}</Badge>
                    )}
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
                    <div className="admin-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(u)}
                      >
                        View details
                      </Button>
                      {!isSelf(u.id) ? (
                        <>
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
                        </>
                      ) : (
                        <span className="admin-actions__hint">N/A</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="adm-pagination">
              <span className="adm-pagination__meta">
                Page {usersData.page} of {usersData.pages} · {usersData.total} users
              </span>
              <div className="adm-pagination__btns">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={usersData.page <= 1 || usersLoading}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={usersData.page >= usersData.pages || usersLoading}
                  onClick={() => setUserPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {detailUserId && (
          <>
            <div className="adm-drawer-backdrop" onClick={closeDetail} />
            <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${detailUser?.username || 'user'}`}>
              <div className="adm-drawer__head">
                <div className="adm-drawer__title">
                  <span>{detailUser?.username || 'User details'}</span>
                  <span className="adm-drawer__email">{detailUser?.email}</span>
                </div>
                <button className="adm-drawer__close" onClick={closeDetail} aria-label="Close panel">
                  <X size={16} />
                </button>
              </div>
              <div className="adm-drawer__body">
                {detailLoading && !detail ? (
                  <div className="admin-loading">
                    <Spinner size="lg" />
                  </div>
                ) : detail ? (
                  <>
                    <section>
                      <h3 className="adm-drawer__section-title">Profile</h3>
                      <div className="adm-profile-grid">
                        <span className="adm-profile-key">Email</span>
                        <span className="adm-profile-val">{detail.email}</span>
                        <span className="adm-profile-key">Username</span>
                        <span className="adm-profile-val">@{detail.username}</span>
                        <span className="adm-profile-key">Plan</span>
                        <span className="adm-profile-val"><Badge tone="accent">{detail.plan || 'FREE'}</Badge></span>
                        <span className="adm-profile-key">Role</span>
                        <span className="adm-profile-val">
                          <Badge tone={detail.role === 'ADMIN' ? 'accent' : 'neutral'}>
                            {detail.role === 'ADMIN' ? 'ADMIN' : 'USER'}
                          </Badge>
                        </span>
                        <span className="adm-profile-key">Status</span>
                        <span className="adm-profile-val">
                          <Badge tone={detail.isActive ? 'up' : 'down'} dot>
                            {detail.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                        </span>
                        <span className="adm-profile-key">Created</span>
                        <span className="adm-profile-val"><RelativeTime time={detail.createdAt} /></span>
                      </div>
                    </section>

                    <section>
                      <h3 className="adm-drawer__section-title">Stats</h3>
                      <div className="adm-chips">
                        <span className="adm-chip">
                          <PulseIcon size={13} />
                          {detail.stats.totalChecks} checks
                        </span>
                        <span className="adm-chip">
                          <Server size={13} />
                          {detail.counts.endpoints} endpoints
                        </span>
                        <span className="adm-chip">
                          <AlertTriangle size={13} />
                          {detail.stats.openIncidents} open incidents
                        </span>
                      </div>
                    </section>

                    <section>
                      <h3 className="adm-drawer__section-title">Endpoints ({detail.counts.endpoints})</h3>
                      {detail.endpoints.length === 0 ? (
                        <p className="adm-empty-note">No endpoints yet.</p>
                      ) : (
                        <div className="adm-mini-table">
                          {detail.endpoints.map((ep) => (
                            <div className="adm-mini-row" key={ep.id}>
                              <span className={`status-dot ${ep.status === 'UP' ? 'status-dot--up' : 'status-dot--down'}`} />
                              <span className="adm-mini-name">{ep.name}</span>
                              <span className="adm-mini-url">{ep.url}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section>
                      <h3 className="adm-drawer__section-title">Recent alerts</h3>
                      {detail.recentAlerts.length === 0 ? (
                        <p className="adm-empty-note">No alerts sent yet.</p>
                      ) : (
                        <div>
                          {detail.recentAlerts.map((alert) => (
                            <div className="adm-alert-row" key={alert.id}>
                              <AlertIcon type={alert.type} />
                              <span className="adm-mini-name">{alert.endpointName}</span>
                              <Badge
                                tone={alert.type === 'DOWN' ? 'down' : alert.type === 'SSL_EXPIRY' ? 'warning' : 'up'}
                              >
                                {alert.type}
                              </Badge>
                              <span className="adm-alert-time">
                                <RelativeTime time={alert.sentAt} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                ) : null}
              </div>
            </aside>
          </>
        )}
      </>
    );
  };

  const renderAnnouncements = () => {
    const previewText = annMessage.trim();

    return (
      <>
        <Card style={{ marginBottom: 16 }}>
          <div className="settings-section__head" style={{ marginBottom: 16 }}>
            <Megaphone size={16} />
            <div>
              <h2 className="settings-section__title">New announcement</h2>
              <p className="settings-section__desc">Shown as a dismissible banner at the top of every page.</p>
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="announcement-message">Message</label>
            <textarea
              id="announcement-message"
              className="field__input adm-textarea"
              rows={3}
              maxLength={ANNOUNCEMENT_MAX}
              placeholder="e.g. Scheduled maintenance tonight at 02:00 UTC"
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value.slice(0, ANNOUNCEMENT_MAX))}
            />
            <div className={`adm-counter ${annMessage.length >= ANNOUNCEMENT_MAX ? 'adm-counter--limit' : ''}`}>
              {annMessage.length}/{ANNOUNCEMENT_MAX}
            </div>
          </div>
          <div className="adm-announce-actions">
            <Select
              aria-label="Announcement type"
              value={annType}
              onChange={(e) => setAnnType(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </Select>
            <Button onClick={postAnnouncement} loading={posting} disabled={!previewText}>
              <Megaphone size={14} />
              Post announcement
            </Button>
          </div>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <h3 className="adm-drawer__section-title">Preview</h3>
          <div className="adm-preview-banner">
            {previewText ? (
              <div className={`announcement-banner announcement-banner--${annType}`}>
                <span>{previewText}</span>
              </div>
            ) : (
              <p className="adm-preview-empty">Start typing above to preview the banner.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="setting-row">
            <span className="setting-row__label">Active announcement</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {activeAnnouncement ? (
                <>
                  <Badge tone={announcementTone(activeAnnouncement.type)} dot>
                    {(activeAnnouncement.type || 'info').toUpperCase()}
                  </Badge>
                  <span className="adm-active-msg">{activeAnnouncement.message}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn--danger-ghost"
                    onClick={() => setClearTarget(true)}
                  >
                    <Trash2 size={14} />
                    Clear
                  </Button>
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None published</span>
              )}
            </div>
          </div>
        </Card>

        <ConfirmDialog
          isOpen={clearTarget}
          title="Clear announcement?"
          description="The banner will disappear for everyone immediately. This action is recorded in the audit log."
          confirmLabel="Clear announcement"
          onClose={() => setClearTarget(false)}
          onConfirm={confirmClear}
          loading={clearing}
        />
      </>
    );
  };

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

  const renderAudit = () => {
    if (auditLogs.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={History}
            title="No audit entries yet"
            description="Admin actions like role changes, plan changes, and monitoring toggles appear here."
          />
        </Card>
      );
    }

    return (
      <div className="feed">
        <section className="event-day">
          <div className="event-day__label">Recent admin activity</div>
          <Card className="event-list" style={{ padding: 0 }}>
            {auditLogs.map((log) => (
              <div className="event" key={log.id}>
                <div className="event__icon event__icon--neutral">
                  {log.action.startsWith('platform.') || log.action.startsWith('announcement.')
                    ? <Power size={15} />
                    : <History size={15} />}
                </div>
                <div className="event__body">
                  <div className="event__title">
                    <Badge tone={log.action.includes('disabled') || log.action === 'user.delete' ? 'down' : 'neutral'} className="event__badge">
                      {log.action}
                    </Badge>
                  </div>
                  <div className="event__url">
                    by @{log.actorEmail || log.actorId || 'system'}
                    {log.targetType && log.targetId ? ` · ${log.targetType}:${String(log.targetId).slice(0, 8)}` : ''}
                    {log.metadata ? ` · ${Object.entries(log.metadata).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}
                  </div>
                </div>
                <div className="event__time">
                  <div className="event__time-main">{formatTime(log.createdAt)}</div>
                  <div className="event__time-sub">{formatRelative(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
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
              {tab === 'announcements' && renderAnnouncements()}
              {tab === 'events' && renderEvents()}
              {tab === 'audit' && renderAudit()}
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
