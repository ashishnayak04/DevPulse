import React, { useState } from 'react';
import { api } from '../../api';
import { useToast } from '../Toast';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RelativeTime } from '../RelativeTime';

const RoleBadge = ({ role }) => (
  <Badge tone={role === 'OWNER' ? 'accent' : 'neutral'} className={role === 'ADMIN' ? 'badge--team-admin' : ''}>
    {role}
  </Badge>
);

export const MembersTab = ({ slug, detail, user, onChanged }) => {
  const { addToast } = useToast();
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
