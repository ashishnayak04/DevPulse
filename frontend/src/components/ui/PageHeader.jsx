import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';

export const PageHeader = React.memo(({ title, subtitle, onBack, onMenu, left, actions }) => (
  <header className="page-head">
    <div className="page-head__left">
      {onMenu && (
        <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Open menu">
          <Menu size={19} />
        </button>
      )}
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
      )}
      {left}
      <div>
        <h1 className="page-head__title">{title}</h1>
        {subtitle && <p className="page-head__subtitle">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="page-head__actions">{actions}</div>}
  </header>
));
