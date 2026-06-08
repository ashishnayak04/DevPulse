import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, Globe, Settings, LogOut, X, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Activity', icon: Activity, path: '/activity' },
    { name: 'Public Status', icon: Globe, path: `/status/${user?.username}` },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="md-hidden"
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40,
            backdropFilter: 'blur(8px)'
          }}
        />
      )}

      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <style>{`
          .sidebar-header {
            padding: 28px 24px; display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid var(--border);
          }
          .sidebar-logo {
            font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
            display: flex; align-items: center; gap: 10px;
          }
          .sidebar-logo-icon {
            width: 32px; height: 32px; border-radius: 10px;
            background: var(--accent-gradient);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #fff;
          }
          .sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
          .sidebar-footer {
            padding: 20px 24px; border-top: 1px solid var(--border);
          }
          .sidebar-user {
            display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
          }
          .sidebar-avatar {
            width: 40px; height: 40px; border-radius: 12px;
            background: var(--accent-gradient);
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 16px; color: #fff;
            flex-shrink: 0;
          }
          .sidebar-user-info { min-width: 0; }
          .sidebar-user-name {
            font-size: 14px; font-weight: 600; color: var(--text-primary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .sidebar-user-email {
            font-size: 12px; color: var(--text-muted);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .sidebar-logout-btn {
            display: flex; align-items: center; gap: 10px; width: 100%;
            padding: 10px 16px; border-radius: var(--radius-sm);
            color: var(--text-muted); font-size: 13px; font-weight: 500;
            background: none; border: none; cursor: pointer;
            transition: all 0.2s ease;
          }
          .sidebar-logout-btn:hover {
            background: rgba(239, 68, 68, 0.08);
            color: var(--accent-red);
          }
        `}</style>

        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Shield size={18} />
            </div>
            Dev<span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pulse</span>
          </div>
          <button onClick={onClose} className="md-hidden" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.username}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};
