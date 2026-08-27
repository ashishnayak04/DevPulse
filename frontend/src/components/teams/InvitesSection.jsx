import React, { useState } from 'react';
import { UserPlus, Mail } from 'lucide-react';
import { api } from '../../api';
import { useToast } from '../Toast';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select as UiSelect } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { RelativeTime } from '../RelativeTime';

export const InvitesSection = ({ slug, detail, canManage, onInvited }) => {
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
            <UserPlus size={14} />
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
