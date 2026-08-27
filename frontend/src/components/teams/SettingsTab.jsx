import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../api';
import { useToast } from '../Toast';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const SettingsTab = ({ slug, detail, user, onRenamed, onLeft }) => {
  const { addToast } = useToast();
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
