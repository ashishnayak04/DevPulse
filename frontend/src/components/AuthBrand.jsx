import React from 'react';
import { Activity as PulseIcon } from 'lucide-react';

const PulsePath =
  'M0 20 H26 L34 8 L46 32 L56 14 L66 26 H100';

export const AuthBrand = () => (
  <aside className="auth-panel">
    <div className="auth-panel__brand">
      <span className="logo-mark" style={{ width: 38, height: 38 }}>
        <PulseIcon size={22} />
      </span>
      Dev<span className="logo-word--accent">Pulse</span>
    </div>

    <div className="auth-panel__copy">
      <h1 className="auth-panel__headline">
        Know the moment your API stops breathing.
      </h1>
      <p className="auth-panel__subtitle">
        Uptime monitoring with live response times and instant incident alerts for the
        services your team ships.
      </p>

      <div className="pulse-visual">
        <div className="pulse-visual__line">
          <svg className="pulse-visual__svg" viewBox="0 0 100 40" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <path
              d={PulsePath}
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'dashFlow 3s linear infinite' }}
            />
            <path d={PulsePath} stroke="var(--accent)" strokeWidth="2" opacity="0.18" />
          </svg>
        </div>
        <div className="pulse-visual__status">
          <span className="pulse-visual__label">Monitoring</span>
          <span className="pulse-visual__value">● live</span>
        </div>
      </div>
    </div>

    <div className="auth-panel__footer">
      <span className="status-dot status-dot--up status-dot--pulse" />
      <span>
        Powered by <strong>DevPulse</strong> &mdash; API health monitoring
      </span>
    </div>
  </aside>
);
