import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, CalendarClock, Trash2, Users, Palette } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { RelativeTime } from '../RelativeTime';
import '../../styles/statuspage.css';

const PRESET_COLORS = ['#22d3ee', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function formatWindowRange(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';

  const dayOpts = { month: 'short', day: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit' };

  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString([], dayOpts)}, ${start.toLocaleTimeString([], timeOpts)} – ${end.toLocaleTimeString([], timeOpts)}`;
  }
  return `${start.toLocaleString([], { ...dayOpts, ...timeOpts })} – ${end.toLocaleString([], { ...dayOpts, ...timeOpts })}`;
}

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = { title: '', description: '', accentColor: '#22d3ee', showLatency: true };

export const StatusPageSection = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [form, setForm] = useState(emptyForm);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);

  const [windows, setWindows] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedForm, setSchedForm] = useState({ title: '', message: '', startsAt: '', endsAt: '' });
  const [scheduling, setScheduling] = useState(false);

  const [subscribers, setSubscribers] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'maintenance' | 'subscriber', id, label }
  const [deleting, setDeleting] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.get('/statuspage/config');
      if (data?.config) {
        setForm({
          title: data.config.title || '',
          description: data.config.description || '',
          accentColor: data.config.accentColor || '#22d3ee',
          showLatency: data.config.showLatency !== false,
        });
      }
    } catch (err) {
      addToast(err.message || 'Failed to load status page config', 'error');
    } finally {
      setLoadingConfig(false);
    }
  }, [addToast]);

  const loadWindows = useCallback(async () => {
    try {
      const data = await api.get('/statuspage/maintenance');
      setWindows(data?.items || []);
    } catch (err) {
      addToast(err.message || 'Failed to load maintenance windows', 'error');
    }
  }, [addToast]);

  const loadSubscribers = useCallback(async () => {
    try {
      const data = await api.get('/statuspage/subscribers');
      setSubscribers(data?.items || []);
    } catch (err) {
      addToast(err.message || 'Failed to load subscribers', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadConfig();
    loadWindows();
    loadSubscribers();
  }, [loadConfig, loadWindows, loadSubscribers]);

  const saveConfig = async (e) => {
    e.preventDefault();
    if (!HEX_RE.test(form.accentColor)) {
      addToast('Accent color must be a hex value like #22d3ee', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/statuspage/config', {
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        accentColor: form.accentColor.toLowerCase(),
        showLatency: form.showLatency,
      });
      addToast('Status page updated', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update status page', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitMaintenance = async (e) => {
    e.preventDefault();
    if (!schedForm.title.trim() || !schedForm.startsAt || !schedForm.endsAt) return;

    const startsAt = new Date(schedForm.startsAt);
    const endsAt = new Date(schedForm.endsAt);
    if (endsAt <= startsAt) {
      addToast('End time must be after start time', 'error');
      return;
    }

    setScheduling(true);
    try {
      await api.post('/statuspage/maintenance', {
        title: schedForm.title.trim(),
        message: schedForm.message.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      addToast('Maintenance scheduled', 'success');
      setScheduleOpen(false);
      setSchedForm({ title: '', message: '', startsAt: '', endsAt: '' });
      loadWindows();
    } catch (err) {
      addToast(err.message || 'Failed to schedule maintenance', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(
        deleteTarget.type === 'maintenance'
          ? `/statuspage/maintenance/${deleteTarget.id}`
          : `/statuspage/subscribers/${deleteTarget.id}`
      );
      if (deleteTarget.type === 'maintenance') {
        setWindows((prev) => prev.filter((win) => win.id !== deleteTarget.id));
        addToast('Maintenance window deleted', 'success');
      } else {
        setSubscribers((prev) => prev.filter((sub) => sub.id !== deleteTarget.id));
        addToast('Subscriber removed', 'success');
      }
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sps">
      <div className="settings-section">
        <div className="settings-section__head">
          <Palette size={16} />
          <div>
            <h2 className="settings-section__title">Branding</h2>
            <p className="settings-section__desc">
              Customize the heading and accent color of your public status page.
            </p>
          </div>
          <a
            className="btn btn--secondary btn--sm"
            href={`/status/${user?.username || ''}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            View public page
          </a>
        </div>

        {loadingConfig ? (
          <Card style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 4 }}>Loading configuration…</p>
          </Card>
        ) : (
          <form onSubmit={saveConfig}>
            <Card style={{ padding: 20 }}>
              <Input
                label="Title"
                placeholder={`${user?.username || 'your'}'s status page`}
                maxLength={80}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                hint="Leave empty to use the default heading."
              />

              <div className="field">
                <label className="field__label" htmlFor="sps-description">Description</label>
                <textarea
                  id="sps-description"
                  className="field__input sps-textarea"
                  rows={2}
                  maxLength={200}
                  placeholder="Live status of every monitored service"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <p className="field__hint">Shown under the title. Leave empty for no subtitle.</p>
              </div>

              <div className="field">
                <label className="field__label">Accent color</label>
                <div className="sps-color-row">
                  <input
                    type="color"
                    className="sps-color-swatch-input"
                    aria-label="Pick accent color"
                    value={HEX_RE.test(form.accentColor) ? form.accentColor : '#22d3ee'}
                    onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                  />
                  <input
                    type="text"
                    className={`field__input sps-color-hex ${!HEX_RE.test(form.accentColor) ? 'field__input--invalid' : ''}`}
                    aria-label="Accent color hex value"
                    maxLength={7}
                    value={form.accentColor}
                    onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}` }))}
                  />
                  <div className="sps-swatches" role="group" aria-label="Preset colors">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`sps-swatch ${form.accentColor.toLowerCase() === color ? 'sps-swatch--active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setForm((f) => ({ ...f, accentColor: color }))}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="setting-row">
                <span className="setting-row__label">Show response times publicly</span>
                <label className="sps-switch">
                  <input
                    type="checkbox"
                    checked={form.showLatency}
                    onChange={(e) => setForm((f) => ({ ...f, showLatency: e.target.checked }))}
                  />
                  <span className="sps-switch__slider" aria-hidden="true" />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button type="submit" loading={saving}>Save changes</Button>
              </div>
            </Card>
          </form>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section__head">
          <CalendarClock size={16} />
          <div>
            <h2 className="settings-section__title">Maintenance windows</h2>
            <p className="settings-section__desc">
              Planned downtime is highlighted on your public page so subscribers know it&apos;s you, not an outage.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setScheduleOpen(true)}>Schedule maintenance</Button>
        </div>

        <Card style={{ padding: windows.length === 0 ? undefined : 0, overflow: 'hidden' }}>
          {windows.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No maintenance scheduled"
              description="Schedule a window when you plan to take services offline."
            />
          ) : (
            windows.map((win) => (
              <div className="setting-row" key={win.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{win.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatWindowRange(win.startsAt, win.endsAt)}
                  </div>
                </div>
                <Badge tone={win.status === 'active' ? 'warning' : win.status === 'upcoming' ? 'accent' : 'neutral'}>
                  {win.status === 'active' ? 'Active' : win.status === 'upcoming' ? 'Upcoming' : 'Past'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn--danger-ghost"
                  onClick={() => setDeleteTarget({ type: 'maintenance', id: win.id, label: win.title })}
                  aria-label={`Delete maintenance window ${win.title}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="settings-section">
        <div className="settings-section__head">
          <Users size={16} />
          <div>
            <h2 className="settings-section__title">
              Subscribers
              <Badge tone="accent">{subscribers.length}</Badge>
            </h2>
            <p className="settings-section__desc">
              People who get emailed when incidents open or maintenance starts on your page.
            </p>
          </div>
        </div>

        <Card style={{ padding: subscribers.length === 0 ? undefined : 0, overflow: 'hidden' }}>
          {subscribers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No subscribers yet"
              description="Visitors can subscribe from the bottom of your public status page."
            />
          ) : (
            subscribers.map((sub) => (
              <div className="setting-row" key={sub.id}>
                <span className="setting-row__value sps-subscriber-email">{sub.email}</span>
                <Badge tone={sub.confirmed ? 'up' : 'warning'} dot>
                  {sub.confirmed ? 'Confirmed' : 'Pending'}
                </Badge>
                <span className="setting-row__value setting-row__value--muted sps-subscriber-created">
                  Joined <RelativeTime time={sub.createdAt} />
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn--danger-ghost"
                  onClick={() => setDeleteTarget({ type: 'subscriber', id: sub.id, label: sub.email })}
                  aria-label={`Remove subscriber ${sub.email}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </Card>
      </div>

      <Modal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        icon={CalendarClock}
        title="Schedule maintenance"
        subtitle="Visitors will see an amber banner while the window is active or starting soon."
      >
        <form onSubmit={submitMaintenance}>
          <Input
            label="Title"
            placeholder="Database upgrade"
            maxLength={80}
            value={schedForm.title}
            onChange={(e) => setSchedForm((f) => ({ ...f, title: e.target.value }))}
            required
            autoFocus
          />
          <div className="field">
            <label className="field__label" htmlFor="sps-maint-message">Message (optional)</label>
            <textarea
              id="sps-maint-message"
              className="field__input sps-textarea"
              rows={3}
              maxLength={500}
              placeholder="What will happen during this window?"
              value={schedForm.message}
              onChange={(e) => setSchedForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
          <div className="sps-datetime-grid">
            <div className="field">
              <label className="field__label" htmlFor="sps-maint-start">Starts at</label>
              <input
                id="sps-maint-start"
                type="datetime-local"
                className="field__input"
                value={schedForm.startsAt}
                onChange={(e) => setSchedForm((f) => ({ ...f, startsAt: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="sps-maint-end">Ends at</label>
              <input
                id="sps-maint-end"
                type="datetime-local"
                className="field__input"
                value={schedForm.endsAt}
                onChange={(e) => setSchedForm((f) => ({ ...f, endsAt: e.target.value }))}
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button type="submit" loading={scheduling}>Schedule</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.type === 'maintenance'
            ? 'Delete maintenance window?'
            : 'Remove subscriber?'
        }
        description={
          deleteTarget?.type === 'maintenance'
            ? `"${deleteTarget?.label}" will no longer appear on your status page. This cannot be undone.`
            : `${deleteTarget?.label} will stop receiving email updates. This cannot be undone.`
        }
        confirmLabel={deleteTarget?.type === 'maintenance' ? 'Delete window' : 'Remove subscriber'}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default StatusPageSection;
