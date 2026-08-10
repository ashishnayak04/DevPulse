import React from 'react';
import { Activity as PulseIcon, AlertTriangle, Zap, Bell } from 'lucide-react';

const features = [
  {
    icon: AlertTriangle,
    title: 'Instant incident alerts',
    desc: 'Know the moment an endpoint goes down — no refresh required.',
  },
  {
    icon: Zap,
    title: 'Real-time latency insight',
    desc: 'Live response times streamed straight to your dashboard.',
  },
  {
    icon: Bell,
    title: 'Public status pages',
    desc: 'Share a clean, always-updated status page with your users.',
  },
];

export const AuthBrand = () => (
  <aside className="auth-brand">
    <div className="auth-brand__logo">
      <span className="logo-mark" style={{ width: 40, height: 40 }}>
        <PulseIcon size={22} />
      </span>
      Dev<span className="logo-word--accent">Pulse</span>
    </div>

    <div>
      <h1 className="auth-brand__headline">Know the moment your API stops breathing.</h1>
      <p className="auth-brand__subtitle">
        Uptime monitoring, live response times, and incident alerts for the services
        your team ships.
      </p>

      <div className="auth-brand__features">
        {features.map((f) => (
          <div className="auth-brand__feature" key={f.title}>
            <span className="auth-brand__feature-icon">
              <f.icon size={18} />
            </span>
            <div>
              <div className="auth-brand__feature-title">{f.title}</div>
              <div className="auth-brand__feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="auth-brand__footer">
      <span className="status-dot status-dot--up status-dot--pulse" />
      <span>
        Powered by <strong>DevPulse</strong> &mdash; API Health Monitoring
      </span>
    </div>
  </aside>
);
