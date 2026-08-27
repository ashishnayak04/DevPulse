import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Monitor,
  Settings as SettingsIcon,
  Plus,
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
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { RelativeTime } from '../components/RelativeTime';
import { MembersTab } from '../components/teams/MembersTab';
import { InvitesSection } from '../components/teams/InvitesSection';
import { EndpointsTab } from '../components/teams/EndpointsTab';
import { SettingsTab } from '../components/teams/SettingsTab';
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

export const Teams = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

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
                    onChanged={fetchDetail}
                  />
                )}

                {tab === 'settings' && (
                  <SettingsTab
                    slug={slug}
                    detail={detail}
                    user={user}
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
