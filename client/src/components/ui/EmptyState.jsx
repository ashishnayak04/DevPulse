import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="empty-state">
    {Icon && (
      <div className="empty-state__icon">
        <Icon size={32} />
      </div>
    )}
    {title && <h3 className="empty-state__title">{title}</h3>}
    {description && <p className="empty-state__desc">{description}</p>}
    {action && <div style={{ marginTop: 20 }}>{action}</div>}
  </div>
);
