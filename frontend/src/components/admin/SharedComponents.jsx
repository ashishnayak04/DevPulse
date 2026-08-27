import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Power,
  PowerOff,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { formatTime, formatRelative } from '../../utils/time';

export const SystemTile = ({ label, icon: Icon, state, detail }) => (
  <div className="admin-system__tile">
    <div className="admin-system__tile-head">
      <Icon size={15} className="admin-system__icon" />
      <span className="admin-system__tile-label">{label}</span>
    </div>
    <div className="admin-system__tile-state">
      <span className={`status-dot ${state === 'up' ? 'status-dot--up' : 'status-dot--down'}`} />
      <span className={`admin-system__state-text ${state === 'up' ? '' : 'admin-system__state-text--down'}`}>
        {state === 'up' ? 'Up' : 'Down'}
      </span>
    </div>
    {detail && <div className="admin-system__tile-detail">{detail}</div>}
  </div>
);

export const StatTile = ({ label, value, tone, sub, icon: Icon, suffix }) => (
  <div className="stat-tile">
    <div className="stat-tile__label">
      {Icon && <Icon size={13} className="stat-tile__icon" />}
      {label}
    </div>
    <div className={`stat-tile__value ${tone ? `stat-tile__value--${tone}` : ''}`}>
      {value}
      {suffix && <span className="stat-tile__suffix">{suffix}</span>}
    </div>
    {sub && <div className="stat-tile__sub">{sub}</div>}
  </div>
);

export const AlertIcon = ({ type }) => {
  if (type === 'DOWN') {
    return (
      <span className="adm-alert-icon adm-alert-icon--down">
        <AlertTriangle size={14} />
      </span>
    );
  }
  if (type === 'SSL_EXPIRY') {
    return (
      <span className="adm-alert-icon adm-alert-icon--warning">
        <KeyRound size={14} />
      </span>
    );
  }
  return (
    <span className="adm-alert-icon adm-alert-icon--up">
      <ShieldCheck size={14} />
    </span>
  );
};
