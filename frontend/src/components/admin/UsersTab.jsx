import React from 'react';
import {
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  Users,
  AlertTriangle,
  Server,
  Activity as PulseIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { RelativeTime } from '../RelativeTime';
import { AlertIcon } from './SharedComponents';
import { formatRelative } from '../../utils/time';

const USER_PAGE_SIZE = 50;

export const UsersTab = ({
  userSearch,
  setUserSearch,
  userPlan,
  setUserPlan,
  userRole,
  setUserRole,
  userStatus,
  setUserStatus,
  userSort,
  setUserSort,
  userPage,
  setUserPage,
  usersData,
  usersLoading,
  busyId,
  me,
  onChangeUser,
  onDeleteTarget,
  onOpenDetail,
}) => {
  const isSelf = (id) => me?.id === id;
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
                      onChange={(e) => onChangeUser(u, { plan: e.target.value }, `${u.username} → ${e.target.value} plan`)}
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
                    <Button variant="ghost" size="sm" onClick={() => onOpenDetail(u)}>
                      View details
                    </Button>
                    {!isSelf(u.id) ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === u.id}
                          onClick={() =>
                            onChangeUser(u, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' },
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
                            onChangeUser(u, { isActive: !u.isActive },
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
                          onClick={() => onDeleteTarget(u)}
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
    </>
  );
};
