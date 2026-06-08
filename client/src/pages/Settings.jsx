import React from 'react';
import { ArrowLeft, Menu, Settings as SettingsIcon, User, Bell, Globe, Shield, Info } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <style>{`
          .set-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;
          }
          .set-header-left {
            display: flex; align-items: center; gap: 16px;
          }
          .set-back-btn {
            width: 40px; height: 40px; border-radius: 12px;
            background: rgba(255,255,255,0.04); border: 1px solid var(--border);
            color: var(--text-muted); cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .set-back-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
          .set-section {
            margin-bottom: 40px;
          }
          .set-section-title {
            font-size: 16px; font-weight: 600; margin-bottom: 16px;
            display: flex; align-items: center; gap: 10px; color: var(--text-primary);
          }
          .set-card {
            padding: 24px; border-radius: var(--radius-lg);
            background: var(--bg-card); border: 1px solid var(--border);
            backdrop-filter: blur(20px);
          }
          .set-field {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 0; border-bottom: 1px solid var(--border);
          }
          .set-field:last-child { border-bottom: none; }
          .set-field-label { font-size: 14px; color: var(--text-muted); }
          .set-field-value { font-size: 14px; font-weight: 500; }
          .set-badge {
            padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 500;
            background: rgba(16,185,129,0.08); color: #34d399;
            border: 1px solid rgba(16,185,129,0.15);
          }
          .set-coming-soon {
            font-size: 14px; color: var(--text-muted); line-height: 1.6; padding: 8px 0;
          }
        `}</style>

        <header className="set-header">
          <div className="set-header-left">
            <button className="md-hidden set-back-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <button className="set-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="page-title">
              <span className="text-gradient">Settings</span>
            </h1>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: 'var(--accent-gradient)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18, color: '#fff',
            boxShadow: '0 4px 16px rgba(139,92,246,0.3)'
          }}>
            <SettingsIcon size={20} />
          </div>
        </header>

        <div className="set-section">
          <h3 className="set-section-title"><User size={16} style={{ color: '#a78bfa' }} /> Profile</h3>
          <div className="set-card">
            {userInfo.map((field) => (
              <div key={field.label} className="set-field">
                <span className="set-field-label">{field.label}</span>
                <span className="set-field-value">{field.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="set-section">
          <h3 className="set-section-title"><Bell size={16} style={{ color: '#a78bfa' }} /> Notifications</h3>
          <div className="set-card">
            <div className="set-field">
              <span className="set-field-label">Email Alerts</span>
              <span className="set-badge">Active</span>
            </div>
            <div className="set-field">
              <span className="set-field-label">Alert on downtime</span>
              <span className="set-field-value">After 3 consecutive failures</span>
            </div>
          </div>
        </div>

        <div className="set-section">
          <h3 className="set-section-title"><Globe size={16} style={{ color: '#a78bfa' }} /> Webhook Configuration</h3>
          <div className="set-card">
            <div className="set-coming-soon">
              Webhook support is coming soon. You'll be able to receive real-time notifications when your endpoints go down or recover.
            </div>
          </div>
        </div>

        <div className="set-section">
          <h3 className="set-section-title"><Info size={16} style={{ color: '#a78bfa' }} /> About</h3>
          <div className="set-card">
            <div className="set-field">
              <span className="set-field-label">Version</span>
              <span className="set-field-value">1.0.0</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
