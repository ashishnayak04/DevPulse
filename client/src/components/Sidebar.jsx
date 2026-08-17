import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Activity, Globe, Settings, ShieldCheck, LogOut, X, Activity as PulseIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Logo = ({ size = 20 }) => (
  <span className="logo-mark">
    <PulseIcon size={size} />
  </span>
);

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Monitor', icon: LayoutGrid, path: '/dashboard' },
    { name: 'Events', icon: Activity, path: '/activity' },
    { name: 'Public page', icon: Globe, path: `/status/${user?.username}` },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar__brand">
          <NavLink to="/dashboard" className="logo" onClick={onClose}>
            <Logo />
            Dev<span className="logo-word--accent">Pulse</span>
          </NavLink>
          <button className="sidebar__close mobile-only" onClick={onClose} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__group-label">Operations</p>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={17} strokeWidth={1.9} />
              <span>{item.name}</span>
            </NavLink>
          ))}

          <p className="sidebar__group-label">Account</p>
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
            onClick={onClose}
          >
            <Settings size={17} strokeWidth={1.9} />
            <span>Settings</span>
          </NavLink>

          {isAdmin && (
            <>
              <p className="sidebar__group-label">Platform</p>
              <NavLink
                to="/admin"
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                onClick={onClose}
              >
                <ShieldCheck size={17} strokeWidth={1.9} />
                <span>Admin</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="user-chip">
            <div className="avatar" aria-hidden="true">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-chip__info">
              <div className="user-chip__name">{user?.username}</div>
              <div className="user-chip__email">{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar__logout">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
};
