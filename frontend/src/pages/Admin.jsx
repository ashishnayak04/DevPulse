import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Server,
  Trash2,
  AlertTriangle,
  History,
  X,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Spinner } from '../components/ui/Spinner';
import { RelativeTime } from '../components/RelativeTime';
import { OverviewTab } from '../components/admin/OverviewTab';
import { EndpointsTab } from '../components/admin/EndpointsTab';
import { UsersTab } from '../components/admin/UsersTab';
import { AnnouncementsTab } from '../components/admin/AnnouncementsTab';
import { EventsTab } from '../components/admin/EventsTab';
import { AuditTab } from '../components/admin/AuditTab';
import { AlertIcon } from '../components/admin/SharedComponents';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
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

const UserDetailDrawer = ({ detailUser, detail, detailLoading, onClose }) => {
  const { user: me } = useAuth();

  return (
    <>
      <div className="adm-drawer-backdrop" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${detailUser?.username || 'user'}`}>
        <div className="adm-drawer__head">
          <div className="adm-drawer__title">
            <span>{detailUser?.username || 'User details'}</span>
            <span className="adm-drawer__email">{detailUser?.email}</span>
          </div>
          <button className="adm-drawer__close" onClick={onClose} aria-label="Close panel">
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
                    {detail.stats.totalChecks} checks
                  </span>
                  <span className="adm-chip">
                    {detail.counts.endpoints} endpoints
                  </span>
                  <span className="adm-chip">
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
  );
};

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

  const [userSearch, setUserSearch] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userPlan, setUserPlan] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userSort, setUserSort] = useState('createdAt');
  const [userPage, setUserPage] = useState(1);
  const [usersData, setUsersData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [usersLoading, setUsersLoading] = useState(false);

  const [detailUserId, setDetailUserId] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
  }, [loadAll]);

  const changeUser = useCallback(async (user, patch, successMsg) => {
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
  }, [addToast]);

  const toggleMonitoring = useCallback(async () => {
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
  }, [overview, addToast]);

  const confirmDelete = useCallback(async () => {
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
  }, [deleteTarget, addToast, loadUsers]);

  const openDetail = useCallback(async (user) => {
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
  }, [addToast]);

  const closeDetail = useCallback(() => {
    setDetailUserId(null);
    setDetailUser(null);
    setDetail(null);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (!detailUserId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailUserId, closeDetail]);

  const postAnnouncement = useCallback(async () => {
    const message = annMessage.trim();
    if (!message || posting) return;
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
  }, [annMessage, annType, posting, addToast]);

  const confirmClear = useCallback(async () => {
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
  }, [addToast]);

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
              {tab === 'overview' && (
                <OverviewTab
                  overview={overview}
                  togglingMonitoring={togglingMonitoring}
                  onToggleMonitoring={toggleMonitoring}
                />
              )}
              {tab === 'endpoints' && <EndpointsTab endpoints={endpoints} />}
              {tab === 'users' && (
                <UsersTab
                  userSearch={userSearch}
                  setUserSearch={setUserSearch}
                  userPlan={userPlan}
                  setUserPlan={setUserPlan}
                  userRole={userRole}
                  setUserRole={setUserRole}
                  userStatus={userStatus}
                  setUserStatus={setUserStatus}
                  userSort={userSort}
                  setUserSort={setUserSort}
                  userPage={userPage}
                  setUserPage={setUserPage}
                  usersData={usersData}
                  usersLoading={usersLoading}
                  busyId={busyId}
                  me={me}
                  onChangeUser={changeUser}
                  onDeleteTarget={setDeleteTarget}
                  onOpenDetail={openDetail}
                />
              )}
              {tab === 'announcements' && (
                <AnnouncementsTab
                  annMessage={annMessage}
                  setAnnMessage={setAnnMessage}
                  annType={annType}
                  setAnnType={setAnnType}
                  activeAnnouncement={activeAnnouncement}
                  posting={posting}
                  onPost={postAnnouncement}
                  clearTarget={clearTarget}
                  setClearTarget={setClearTarget}
                  clearing={clearing}
                  onClear={confirmClear}
                />
              )}
              {tab === 'events' && <EventsTab activity={activity} />}
              {tab === 'audit' && <AuditTab auditLogs={auditLogs} />}
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

          {detailUserId && (
            <UserDetailDrawer
              detailUser={detailUser}
              detail={detail}
              detailLoading={detailLoading}
              onClose={closeDetail}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
