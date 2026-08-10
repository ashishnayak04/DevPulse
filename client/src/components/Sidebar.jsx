import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, Globe, Settings, LogOut, X, Activity as PulseIcon } from 'lucide-react';
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
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <NavLink to="/dashboard" className="sidebar__logo" onClick={onClose}>
            <span className="logo-mark">
              <PulseIcon size={20} />
            </span>
            Dev<span className="logo-word--accent">Pulse</span>
          </NavLink>
          <button className="sidebar__close mobile-only" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{user?.username}</div>
              <div className="sidebar__user-email">{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar__logout">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};
