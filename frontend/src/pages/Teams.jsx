import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Monitor,
  Settings as SettingsIcon,
  Plus,
  X,
  Trash2,
  Mail,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select as UiSelect } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { RelativeTime } from '../components/RelativeTime';
import '../styles/teams.css';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

const RoleBadge = ({ role }) => (
  <Badge tone={role === 'OWNER' ? 'accent' : 'neutral'} className={role === 'ADMIN' ? 'badge--team-admin' : ''}>
    {role}
  </Badge>
);

/* ─── List mode ────────────────────────────────────────── */

const TeamGridSkeleton = () => (
  <div className="team-grid">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i} className="team-card">
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton width="55%" height={16} />
          <Skeleton width={90} height={20} radius="var(--radius)" />
          <Skeleton width="70%" height={12} />
        </div>
      </Card>
    ))}
  </div>
);

/* ─── Detail mode ──────────────────────────────────────── */

const MembersTab = ({ slug, detail, user, onChanged, addToast }) => {
  const canManage = ['OWNER', 'ADMIN'].includes(detail.myRole);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleRoleChange = async (member, role) => {
    try {
      await api.patch(`/teams/${slug}/members/${member.userId}`, { role });
      addToast(`Role updated for ${member.username}`, 'success');
      onChanged();
    } catch (err) {
      addToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleRemove = async () => {
    if (!confirmTarget) return;
    setBusy(true);
    try {
      const result = await api.delete(`/teams/${slug}/members/${confirmTarget.userId}`);
      const isSelf = confirmTarget.userId === user.id;
      addToast(result.message || (isSelf ? `You left "${detail.team.name}"` : 'Member removed'), 'success');
      setConfirmTarget(null);
      onChanged(isSelf ? '/teams' : undefined);
    } catch (err) {
      addToast(err.message || 'Failed to remove member', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <table className="team-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Joined</th>
            <th style={{ width: 110 }} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {detail.members.map((m) => {
            const isSelf = m.userId === user.id;
            return (
              <tr key={m.userId}>
                <td className="team-table__user">
                  <div className="team-table__username">{m.username}</div>
                  <div className="team-table__email">{m.email}</div>
                </td>
                <td>
                  {canManage && m.role !== 'OWNER' ? (
                    <select
                      className="team-role-select"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m, e.target.value)}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </td>
                <td className="team-table__muted">
                  <RelativeTime time={m.joinedAt} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  {m.role !== 'OWNER' && (canManage || isSelf) && (
                    <Button variant="danger-ghost" size="sm" onClick={() => setConfirmTarget(m)}>
                      {isSelf ? 'Leave' : 'Remove'}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title={confirmTarget?.userId === user.id ? 'Leave this team?' : 'Remove member?'}
        description={
          confirmTarget?.userId === user.id
            ? `You will lose access to "${detail.team.name}" and its shared endpoints.`
            : `${confirmTarget?.username} will lose access to "${detail.team.name}".`
        }
        confirmLabel={confirmTarget?.userId === user.id ? 'Leave team' : 'Remove'}
        loading={busy}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleRemove}
      />
    </Card>
  );
};

const InvitesSection = ({ slug, detail, canManage, onInvited }) => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post(`/teams/${slug}/invites`, { email, role });
      addToast('Invitation sent', 'success');
      setEmail('');
      setOpen(false);
      onInvited();
    } catch (err) {
      addToast(err.message || 'Failed to send invitation', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="team-section-title">Pending invitations</div>
      <Card>
        {detail.invites && detail.invites.length > 0 ? (
          detail.invites.map((inv) => (
            <div key={inv.id} className="team-endpoint-row">
              <Mail size={15} style={{ color: 'var(--text-muted)' }} />
              <div className="team-endpoint-row__body">
                <div className="team-endpoint-row__name">{inv.email}</div>
                <div className="team-endpoint-row__url">
                  {inv.role} · expires <RelativeTime time={inv.expiresAt} />
                </div>
              </div>
              <Badge tone="warning">PENDING</Badge>
            </div>
          ))
        ) : (
          <EmptyState
            icon={UserPlus}
            title="No pending invites"
            description={canManage ? 'Invite teammates to monitor endpoints together.' : 'Ask a team admin to invite you.'}
          />
        )}
        <div style={{ padding: '14px 20px', borderTop: detail.invites?.length ? '1px solid var(--border)' : 'none' }}>
          <Button size="sm" onClick={() => setOpen(true)} disabled={!canManage}>
            <Plus size={14} />
            Invite member
          </Button>
        </div>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} icon={UserPlus} title="Invite member" subtitle={`They'll get an email invite for ${detail.team.name}`}>
        <form onSubmit={submit}>
          <Input
            label="Email"
            type="email"
            required
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <UiSelect label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="VIEWER">VIEWER</option>
          </UiSelect>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={sending}>
              Send invite
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

const EndpointsTab = ({ slug, detail, canManage, myEndpoints, fetchMyEndpoints, onChanged, addToast }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) fetchMyEndpoints();
  }, [open, fetchMyEndpoints]);

  const attachedIds = new Set(detail.endpoints.map((ep) => ep.id));
  const available = (myEndpoints || []).filter((ep) => !attachedIds.has(ep.id));

  const attach = async (endpointId) => {
    try {
      const result = await api.post(`/teams/${slug}/endpoints`, { endpointId });
      addToast(result.message || 'Endpoint attached', 'success');
      setOpen(false);
      onChanged();
    } catch (err) {
      addToast(err.message || 'Failed to attach endpoint', 'error');
    }
  };

  const detach = async (ep) => {
    try {
      await api.delete(`/teams/${slug}/endpoints/${ep.id}`);
      addToast(`${ep.name} detached`, 'success');
      onChanged();
    } catch (err) {
      addToast(err.message || 'Failed to detach endpoint', 'error');
    }
  };

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: detail.endpoints.length ? '1px solid var(--border)' : 'none',
        }}
      >
        <span className="sp-list__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Monitor size={14} />
          Shared endpoints
        </span>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            Add endpoint
          </Button>
        )}
      </div>

      {detail.endpoints.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No endpoints attached"
          description={
            canManage
              ? 'Attach one of your monitors to share its status with the team.'
              : 'Team admins can attach endpoints to share here.'
          }
        />
      ) : (
        detail.endpoints.map((ep) => {
          const isUp = ep.status === 'UP';
          return (
            <div key={ep.id} className="team-endpoint-row">
              <span className={`team-endpoint-dot ${isUp ? 'team-endpoint-dot--up' : 'team-endpoint-dot--down'}`} aria-hidden="true" />
              <div className="team-endpoint-row__body">
                <div className="team-endpoint-row__name">{ep.name}</div>
                <div className="team-endpoint-row__url">{ep.url}</div>
              </div>
              <Badge tone={isUp ? 'up' : 'down'} dot>
                {isUp ? 'UP' : 'DOWN'}
              </Badge>
              {!ep.isActive && <span className="team-table__muted">paused</span>}
              {canManage && (
                <button className="icon-btn" onClick={() => detach(ep)} aria-label={`Detach ${ep.name}`}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        icon={Monitor}
        title="Add endpoint"
        subtitle="Choose one of your monitors to share with the team"
      >
        {available.length === 0 ? (
          <EmptyState icon={Monitor} title="Nothing to attach" description="All of your active endpoints are already attached, or you have none yet." />
        ) : (
          available.map((ep) => (
            <button
              key={ep.id}
              type="button"
              className="team-endpoint-row"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => attach(ep.id)}
            >
              <span className={`team-endpoint-dot ${ep.status === 'UP' ? 'team-endpoint-dot--up' : 'team-endpoint-dot--down'}`} aria-hidden="true" />
              <div className="team-endpoint-row__body">
                <div className="team-endpoint-row__name">{ep.name}</div>
                <div className="team-endpoint-row__url">{ep.url}</div>
              </div>
              <Plus size={15} style={{ color: 'var(--accent-text)' }} />
            </button>
          ))
        )}
      </Modal>
    </Card>
  );
};

const SettingsTab = ({ slug, detail, user, onRenamed, onLeft, addToast }) => {
  const canManage = ['OWNER', 'ADMIN'].includes(detail.myRole);
  const isOwner = detail.myRole === 'OWNER';
  const [name, setName] = useState(detail.team.name);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setName(detail.team.name);
  }, [detail.team.name]);

  const rename = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/teams/${slug}`, { name });
      addToast('Team renamed', 'success');
      onRenamed();
    } catch (err) {
      addToast(err.message || 'Failed to rename team', 'error');
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      const result = await api.delete(`/teams/${slug}/members/${user.id}`);
      addToast(result.message || `You left "${detail.team.name}"`, 'success');
      setLeaveOpen(false);
      onLeft();
    } catch (err) {
      addToast(err.message || 'Failed to leave team', 'error');
    } finally {
      setLeaving(false);
    }
  };

  const deleteTeam = async () => {
    setDeleting(true);
    try {
      await api.delete(`/teams/${slug}`);
      addToast('Team deleted', 'success');
      setDeleteOpen(false);
      onLeft();
    } catch (err) {
      addToast(err.message || 'Failed to delete team', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <div className="team-section-title">Team name</div>
      <form className="team-rename-form" onSubmit={rename}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={50} />
        <Button type="submit" loading={saving} disabled={!canManage || name.trim() === detail.team.name}>
          Save
        </Button>
      </form>

      <div className="team-section-title" style={{ color: 'var(--danger-text)' }}>
        Danger zone
      </div>
      <div className="team-danger-zone">
        {!isOwner && (
          <div className="team-danger-zone__row">
            <div>
              <div className="team-danger-zone__label">Leave team</div>
              <div className="team-danger-zone__desc">You will lose access to this team's shared endpoints.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setLeaveOpen(true)}>
              Leave
            </Button>
          </div>
        )}
        {isOwner && (
          <div className="team-danger-zone__row">
            <div>
              <div className="team-danger-zone__label">Delete team</div>
              <div className="team-danger-zone__desc">
                Permanently deletes the team with all members, invites and endpoint links.
              </div>
            </div>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => { setSlugInput(''); setDeleteOpen(true); }}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={leaveOpen}
        title="Leave this team?"
        description={`You will lose access to "${detail.team.name}". You can only rejoin with a new invitation.`}
        confirmLabel="Leave team"
        loading={leaving}
        onClose={() => setLeaveOpen(false)}
        onConfirm={leave}
      />

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} ariaLabel="Delete team" variant="center">
        <div style={{ padding: 4 }}>
          <div className="confirm-icon">
            <Trash2 size={22} />
          </div>
          <h2 className="confirm-title">Delete "{detail.team.name}"?</h2>
          <p className="confirm-desc">
            This removes all members, pending invites and shared endpoint links. This action cannot be undone.
            Type <strong>{detail.team.slug}</strong> to confirm.
          </p>
          <input
            className="team-confirm-input"
            style={{ marginBottom: 14 }}
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder={detail.team.slug}
            autoFocus
          />
          <div className="confirm-actions">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteTeam} loading={deleting} disabled={slugInput !== detail.team.slug}>
              Delete team
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

/* ─── Page ─────────────────────────────────────────────── */

export const Teams = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { user } = useAuth();

  // list-mode state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  // detail-mode state
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [tab, setTab] = useState('members');
  const [myEndpoints, setMyEndpoints] = useState([]);
  const emailInviteToken = searchParams.get('invite');

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/teams');
      setTeams(data.items || []);
    } catch (err) {
      addToast(err.message || 'Failed to load teams', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchInvites = useCallback(async () => {
    try {
      const data = await api.get('/teams/invites/mine');
      setInvites(data.items || []);
    } catch {
      setInvites([]);
    }
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!slug) return;
    setDetailLoading(true);
    try {
      const data = await api.get(`/teams/${slug}`);
      setDetail(data);
    } catch (err) {
      addToast(err.message || 'Failed to load team', 'error');
      navigate('/teams', { replace: true });
    } finally {
      setDetailLoading(false);
    }
  }, [slug, addToast, navigate]);

  const fetchMyEndpoints = useCallback(async () => {
    try {
      const data = await api.get('/endpoints');
      setMyEndpoints(Array.isArray(data) ? data : []);
    } catch {
      setMyEndpoints([]);
    }
  }, []);

  useEffect(() => {
    setTab('members');
    setDetail(null);
    if (slug) {
      fetchDetail();
    } else {
      fetchTeams();
      fetchInvites();
    }
  }, [slug, fetchDetail, fetchTeams, fetchInvites]);

  const acceptInviteByToken = async (token, isEmailLink) => {
    try {
      const data = await api.get(`/teams/invites/accept?token=${encodeURIComponent(token)}`);
      addToast(`Joined ${data.team.name}`, 'success');
      if (isEmailLink) setSearchParams({}, { replace: true });
      fetchTeams();
      fetchInvites();
      navigate(`/teams/${data.team.slug}`);
    } catch (err) {
      addToast(err.message || 'Failed to accept invitation', 'error');
      if (isEmailLink) setSearchParams({}, { replace: true });
    }
  };

  const createTeam = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await api.post('/teams', { name: form.name.trim(), slug: form.slug.trim() });
      addToast(`Team ${data.team.name} created`, 'success');
      setCreateOpen(false);
      setForm({ name: '', slug: '' });
      setSlugTouched(false);
      fetchTeams();
    } catch (err) {
      addToast(
        err.data?.error?.code === 'SLUG_TAKEN' ? err.message : err.message || 'Failed to create team',
        'error'
      );
    } finally {
      setCreating(false);
    }
  };

  /* ─── Detail view ─── */
  if (slug) {
    const canManage = detail ? ['OWNER', 'ADMIN'].includes(detail.myRole) : false;

    return (
      <div className="app-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="main-content">
          <div className="page">
            <PageHeader
              title={detailLoading && !detail ? 'Team' : detail?.team.name}
              subtitle={detail ? `/${detail.team.slug}` : undefined}
              onBack={() => navigate('/teams')}
              onMenu={() => setSidebarOpen(true)}
              left={detail ? <RoleBadge role={detail.myRole} /> : undefined}
            />

            {detail && (
              <>
                <nav className="team-tabs" aria-label="Team sections">
                  {[
                    { id: 'members', label: 'Members', icon: Users },
                    { id: 'endpoints', label: 'Endpoints', icon: Monitor },
                    { id: 'settings', label: 'Settings', icon: SettingsIcon },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`team-tabs__tab ${tab === id ? 'team-tabs__tab--active' : ''}`}
                      onClick={() => setTab(id)}
                    >
                      <Icon size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                      {label}
                    </button>
                  ))}
                </nav>

                {tab === 'members' && (
                  <>
                    <MembersTab
                      slug={slug}
                      detail={detail}
                      user={user}
                      addToast={addToast}
                      onChanged={(redirectTo) => {
                        if (redirectTo) {
                          navigate(redirectTo);
                        } else {
                          fetchDetail();
                        }
                      }}
                    />
                    <div style={{ marginTop: 24 }}>
                      <InvitesSection slug={slug} detail={detail} canManage={canManage} onInvited={fetchDetail} />
                    </div>
                  </>
                )}

                {tab === 'endpoints' && (
                  <EndpointsTab
                    slug={slug}
                    detail={detail}
                    canManage={canManage}
                    myEndpoints={myEndpoints}
                    fetchMyEndpoints={fetchMyEndpoints}
                    addToast={addToast}
                    onChanged={fetchDetail}
                  />
                )}

                {tab === 'settings' && (
                  <SettingsTab
                    slug={slug}
                    detail={detail}
                    user={user}
                    addToast={addToast}
                    onRenamed={fetchDetail}
                    onLeft={() => navigate('/teams')}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  /* ─── List view ─── */

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Teams"
            subtitle="Collaborate on uptime monitoring with your organization"
            onMenu={() => setSidebarOpen(true)}
            actions={
              <Button onClick={() => setCreateOpen(true)} icon={Plus}>
                Create team
              </Button>
            }
          />

          {/* Pending invitations */}
          {(invites.length > 0 || emailInviteToken) && (
            <div className="team-invite-strip animate-fade-in">
              {emailInviteToken && (
                <div className="team-invite-strip__item">
                  <Mail size={15} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                  <span className="team-invite-strip__text">You've been invited to join a team via email.</span>
                  <Button size="sm" onClick={() => acceptInviteByToken(emailInviteToken, true)}>
                    Accept invite
                  </Button>
                </div>
              )}
              {invites.map((inv) => (
                <div key={inv.id} className="team-invite-strip__item">
                  <Users size={15} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                  <span className="team-invite-strip__text">
                    You're invited to <strong>{inv.teamName}</strong> as <strong>{inv.role}</strong>
                  </span>
                  <Button size="sm" onClick={() => acceptInviteByToken(inv.token, false)}>
                    Accept
                  </Button>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <TeamGridSkeleton />
          ) : teams.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title="No teams yet"
                description="Create a team to monitor endpoints together — shared status, roles and invitations included."
              />
            </Card>
          ) : (
            <div className="team-grid animate-fade-in">
              {teams.map((t) => (
                <Card key={t.id} hover className="team-card" style={{ padding: '18px 20px' }}>
                  <div className="team-card__top">
                    <span className="team-card__name">{t.name}</span>
                    <RoleBadge role={t.role} />
                  </div>
                  <span className="team-card__slug">/{t.slug}</span>
                  <div className="team-card__meta">
                    {t.memberCount} member{t.memberCount === 1 ? '' : 's'} · {t.endpointCount} endpoint
                    {t.endpointCount === 1 ? '' : 's'} · created <RelativeTime time={t.createdAt} />
                  </div>
                  <div className="team-card__footer">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/teams/${t.slug}`)}>
                      Open
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} icon={Users} title="Create a team" subtitle="Bring your endpoints under one roof">
        <form onSubmit={createTeam}>
          <Input
            label="Team name"
            required
            minLength={2}
            maxLength={50}
            placeholder="Acme Corp"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
            }}
          />
          <Input
            label="Slug"
            required
            hint="Lowercase letters, numbers and hyphens. Used in URLs."
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Teams;
