import React, { useState, useEffect, useCallback } from 'react';
import { User, Bell, Globe, Link2, Check, Copy, Info, Mail, Webhook, Trash2, Send, ShieldCheck, KeyRound, Paintbrush } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { StatusPageSection } from '../components/settings/StatusPageSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { SecuritySection } from '../components/settings/SecuritySection';
import { ApiKeysSection } from '../components/settings/ApiKeysSection';

const WEBHOOK_TYPES = [
  { value: 'SLACK', label: 'Slack', hint: 'Paste a Slack Incoming Webhook URL (hooks.slack.com)' },
  { value: 'DISCORD', label: 'Discord', hint: 'Paste a Discord Webhook URL (discord.com/api/webhooks)' },
  { value: 'GENERIC', label: 'Custom', hint: 'Receives JSON payloads signed with X-DevPulse-Signature (HMAC-SHA256 of the body using your secret)' },
];

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'statuspage', label: 'Status Page' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'apikeys', label: 'API Keys' },
];

export const Settings = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [copied, setCopied] = useState(false);
  const [copiedSecretId, setCopiedSecretId] = useState(null);
  const { user } = useAuth();
  const { addToast } = useToast();

  const [usage, setUsage] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [resending, setResending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('SLACK');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWebhooks = useCallback(async () => {
    try {
      setWebhooks(await api.get('/webhooks'));
    } catch (err) {
      addToast(err.message || 'Failed to load webhooks', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    if (activeTab === 'account') {
      api.get('/endpoints/usage').then(setUsage).catch(() => {});
      loadWebhooks();
    }
  }, [activeTab, loadWebhooks]);

  const statusUrl = `${window.location.origin}/status/${user?.username || ''}`;

  const copyStatusUrl = async () => {
    try {
      await navigator.clipboard.writeText(statusUrl);
      setCopied(true);
      addToast('Status page URL copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Could not copy URL', 'error');
    }
  };

  const copySecret = async (webhook) => {
    try {
      await navigator.clipboard.writeText(webhook.secret);
      setCopiedSecretId(webhook.id);
      addToast('Signing secret copied', 'success');
      setTimeout(() => setCopiedSecretId(null), 2000);
    } catch {
      addToast('Could not copy secret', 'error');
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const result = await api.post('/auth/resend-verification');
      addToast(result.message || 'Verification email sent', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to resend verification email', 'error');
    } finally {
      setResending(false);
    }
  };

  const openAddModal = () => {
    setNewUrl('');
    setNewType('SLACK');
    setAddOpen(true);
  };

  const submitWebhook = async (e) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      await api.post('/webhooks', { url: newUrl.trim(), type: newType });
      addToast('Webhook added', 'success');
      setAddOpen(false);
      loadWebhooks();
    } catch (err) {
      addToast(err.message || 'Failed to add webhook', 'error');
    } finally {
      setAdding(false);
    }
  };

  const testWebhook = async (webhook) => {
    try {
      const result = await api.post(`/webhooks/${webhook.id}/test`);
      addToast(result.message || 'Test delivery queued', 'success');
    } catch (err) {
      addToast(err.message || 'Test failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/webhooks/${deleteTarget.id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      addToast('Webhook deleted', 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const typeHint = WEBHOOK_TYPES.find((t) => t.value === newType)?.hint;

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Settings"
            subtitle="Account, security, notifications, and your public status page"
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
          />

          <div className="settings-tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`settings-tabs__btn ${activeTab === tab.id ? 'settings-tabs__btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'account' && (
            <>
              {user && !user.emailVerified && (
                <Card style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Mail size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Verify your email</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        We sent a link to {user.email}. Verify to make sure alert emails reach you.
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={resendVerification} loading={resending}>
                      <Send size={13} />
                      Resend email
                    </Button>
                  </div>
                </Card>
              )}

              <div className="settings-section">
                <div className="settings-section__head">
                  <User size={16} />
                  <div>
                    <h2 className="settings-section__title">Profile</h2>
                  </div>
                </div>
                <Card style={{ overflow: 'hidden' }}>
                  <div className="setting-row">
                    <span className="setting-row__label">Email</span>
                    <span className="setting-row__value">{user?.email || '—'}</span>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row__label">Username</span>
                    <span className="setting-row__value">{user?.username || '—'}</span>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row__label">Plan</span>
                    <Badge tone="accent">{usage?.plan || user?.plan || 'FREE'}</Badge>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row__label">User ID</span>
                    <span className="setting-row__value setting-row__value--muted">{user?.id || '—'}</span>
                  </div>
                </Card>
              </div>

              <div className="settings-section">
                <div className="settings-section__head">
                  <Globe size={16} />
                  <div>
                    <h2 className="settings-section__title">Public status page</h2>
                    <p className="settings-section__desc">
                      Share this read-only page with your team or customers. It updates automatically.
                    </p>
                  </div>
                </div>
                <Card style={{ padding: 16 }}>
                  <div className="copy-row">
                    <Link2 size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input className="copy-row__input" readOnly value={statusUrl} onFocus={(e) => e.target.select()} aria-label="Public status page URL" />
                    <Button variant="secondary" size="sm" onClick={copyStatusUrl}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="settings-section">
                <div className="settings-section__head">
                  <Webhook size={16} />
                  <div>
                    <h2 className="settings-section__title">Webhooks</h2>
                    <p className="settings-section__desc">
                      Route alerts to Slack, Discord, or your own service. Slack and Discord message
                      formats are handled automatically.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={openAddModal}>
                    Add webhook
                  </Button>
                </div>
                <Card style={{ padding: webhooks.length === 0 ? undefined : 0, overflow: 'hidden' }}>
                  {webhooks.length === 0 ? (
                    <EmptyState
                      icon={Webhook}
                      title="No webhooks yet"
                      description="Receive DOWN and recovery alerts in Slack, Discord, or your own endpoint."
                    />
                  ) : (
                    webhooks.map((webhook) => (
                      <div className="setting-row" key={webhook.id} style={{ gap: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {webhook.url}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Badge tone={webhook.type === 'GENERIC' ? 'neutral' : 'accent'}>{webhook.type}</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => testWebhook(webhook)}>
                          Test
                        </Button>
                        {webhook.type === 'GENERIC' && (
                          <Button variant="ghost" size="sm" onClick={() => copySecret(webhook)} aria-label="Copy signing secret">
                            {copiedSecretId === webhook.id ? <Check size={14} /> : <Copy size={14} />}
                            {copiedSecretId === webhook.id ? 'Copied' : 'Secret'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="btn--danger-ghost" onClick={() => setDeleteTarget(webhook)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))
                  )}
                </Card>
              </div>

              <div className="settings-section">
                <div className="settings-section__head">
                  <Info size={16} />
                  <div>
                    <h2 className="settings-section__title">About</h2>
                  </div>
                </div>
                <Card style={{ overflow: 'hidden' }}>
                  <div className="setting-row">
                    <span className="setting-row__label">Version</span>
                    <span className="setting-row__value">1.1.0</span>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row__label">Check retention</span>
                    <span className="setting-row__value setting-row__value--muted">
                      {usage ? `${usage.limits.retentionDays} days · ${usage.plan} plan` : '90 days'}
                    </span>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row__label">Legal</span>
                    <span className="setting-row__value setting-row__value--muted">
                      <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
                      {' · '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
                    </span>
                  </div>
                </Card>
              </div>
            </>
          )}

          {activeTab === 'statuspage' && <StatusPageSection />}

          {activeTab === 'notifications' && (
            <>
              <NotificationsSection />
            </>
          )}

          {activeTab === 'security' && (
            <>
              <SecuritySection />
            </>
          )}

          {activeTab === 'apikeys' && (
            <>
              <ApiKeysSection />
            </>
          )}
        </div>
      </main>

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        icon={Webhook}
        title="Add webhook"
        subtitle="Alerts are delivered as POST requests with JSON bodies."
      >
        <form onSubmit={submitWebhook}>
          <Input
            label="Webhook URL"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
            autoFocus
          />
          <Select label="Type" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {WEBHOOK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <p className="field__hint" style={{ marginTop: -6, marginBottom: 16 }}>{typeHint}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={adding}>Add webhook</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete webhook?"
        description="Alerts will no longer be delivered to this URL. This cannot be undone."
        confirmLabel="Delete webhook"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
};


export default Settings;
