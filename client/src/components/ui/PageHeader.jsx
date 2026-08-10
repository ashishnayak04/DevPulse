import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';

export const PageHeader = ({ title, subtitle, onBack, onMenu, left, actions }) => (
  <header className="page-header">
    <div className="page-header__left">
      {onMenu && (
        <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
      )}
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
      )}
      {left}
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>
);
