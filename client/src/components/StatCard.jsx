import React from 'react';
import { Card } from './ui/Card';

const colorMap = {
  accent: { icon: 'stat-card__icon--accent', value: 'stat-card__value--accent' },
  success: { icon: 'stat-card__icon--success', value: 'stat-card__value--success' },
  danger: { icon: 'stat-card__icon--danger', value: 'stat-card__value--danger' },
  warning: { icon: 'stat-card__icon--warning', value: 'stat-card__value--warning' },
  info: { icon: 'stat-card__icon--info', value: 'stat-card__value--info' },
  neutral: { icon: 'stat-card__icon--neutral', value: 'stat-card__value--neutral' },
};

export const StatCard = ({ icon: Icon, label, value, color = 'neutral' }) => {
  const c = colorMap[color] || colorMap.neutral;

  return (
    <Card className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <span className={`stat-card__icon ${c.icon}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className={`stat-card__value ${c.value}`}>{value}</div>
    </Card>
  );
};
