import React, { useState } from 'react';
import { User, Bell, Globe, Link2, Check, Copy, Info } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/Toast';

export const Settings = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();

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

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Settings"
            subtitle="Account, notifications, and your public status page"
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
          />

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
              <Bell size={16} />
              <div>
                <h2 className="settings-section__title">Notifications</h2>
                <p className="settings-section__desc">How DevPulse reaches you when a service changes state.</p>
              </div>
            </div>
            <Card style={{ overflow: 'hidden' }}>
              <div className="setting-row">
                <span className="setting-row__label">Email alerts</span>
                <Badge tone="success">Active</Badge>
              </div>
              <div className="setting-row">
                <span className="setting-row__label">Alert on downtime</span>
                <span className="setting-row__value setting-row__value--muted">
                  After 3 consecutive failed checks
                </span>
              </div>
              <div className="setting-row">
                <span className="setting-row__label">Recovery notifications</span>
                <span className="setting-row__value setting-row__value--muted">
                  When an endpoint recovers
                </span>
              </div>
            </Card>
          </div>

          <div className="settings-section">
            <div className="settings-section__head">
              <Globe size={16} />
              <div>
                <h2 className="settings-section__title">Webhooks</h2>
                <p className="settings-section__desc">Route alerts to Slack, Discord, or your own service.</p>
              </div>
            </div>
            <Card>
              <p className="setting-note">
                Webhook delivery is on the roadmap. When enabled, you'll be able to add signed
                webhook URLs and receive DOWN / RECOVERY payloads in real time.
              </p>
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
                <span className="setting-row__value">1.0.0</span>
              </div>
              <div className="setting-row">
                <span className="setting-row__label">Check retention</span>
                <span className="setting-row__value setting-row__value--muted">90 days</span>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};


export default Settings;
