import React from 'react';
import { Settings as SettingsIcon, User, Bell, Globe, Info } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const Settings = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { user } = useAuth();

  const userInfo = [
    { label: 'Email', value: user?.email || '-' },
    { label: 'Username', value: user?.username || '-' },
    { label: 'User ID', value: user?.id || '-' },
  ];

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Settings"
            subtitle="Manage your account and preferences"
            onBack={() => navigate('/dashboard')}
            onMenu={() => setSidebarOpen(true)}
            actions={
              <div className="avatar" aria-hidden="true">
                <SettingsIcon size={20} />
              </div>
            }
          />

          <div className="section">
            <h2 className="section__title">
              <User size={16} style={{ color: 'var(--accent-text)' }} />
              Profile
            </h2>
            <Card style={{ padding: '6px 20px' }}>
              {userInfo.map((field) => (
                <div key={field.label} className="setting-row">
                  <span className="setting-row__label">{field.label}</span>
                  <span className="setting-row__value">{field.value}</span>
                </div>
              ))}
            </Card>
          </div>

          <div className="section">
            <h2 className="section__title">
              <Bell size={16} style={{ color: 'var(--accent-text)' }} />
              Notifications
            </h2>
            <Card style={{ padding: '6px 20px' }}>
              <div className="setting-row">
                <span className="setting-row__label">Email Alerts</span>
                <Badge tone="success">Active</Badge>
              </div>
              <div className="setting-row">
                <span className="setting-row__label">Alert on downtime</span>
                <span className="setting-row__value" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  After 3 consecutive failures
                </span>
              </div>
            </Card>
          </div>

          <div className="section">
            <h2 className="section__title">
              <Globe size={16} style={{ color: 'var(--accent-text)' }} />
              Webhook Configuration
            </h2>
            <Card style={{ padding: '20px' }}>
              <p className="setting-note">
                Webhook support is coming soon. You'll be able to receive real-time
                notifications when your endpoints go down or recover.
              </p>
            </Card>
          </div>

          <div className="section">
            <h2 className="section__title">
              <Info size={16} style={{ color: 'var(--accent-text)' }} />
              About
            </h2>
            <Card style={{ padding: '6px 20px' }}>
              <div className="setting-row">
                <span className="setting-row__label">Version</span>
                <span className="setting-row__value">1.0.0</span>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
