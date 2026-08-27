import React, { useState } from 'react';
import {
  Cpu,
  Database,
  Wifi,
  AlertTriangle,
  Activity as PulseIcon,
  Power,
  PowerOff,
  Users,
  Server,
  UserPlus,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SystemTile, StatTile } from './SharedComponents';
import { formatTime, formatRelative } from '../../utils/time';

export const OverviewTab = ({ overview, togglingMonitoring, onToggleMonitoring }) => {
  if (!overview) return null;
  const monitoringEnabled = overview.platform?.monitoringEnabled ?? true;
  const stats = overview.stats;
  const system = overview.system;

  const upRatio = stats.endpoints.total > 0
    ? Math.round((stats.endpoints.up / stats.endpoints.total) * 100)
    : 100;

  const dist = overview.planDistribution || {};
  const planData = ['FREE', 'PRO', 'BUSINESS'].map((plan) => ({
    plan,
    count: dist[plan] || 0,
  }));

  return (
    <>
      <Card style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div className="setting-row">
          <span className="setting-row__label">Global monitoring</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!monitoringEnabled && overview.platform?.message && (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>{overview.platform.message}</span>
            )}
            <Badge tone={monitoringEnabled ? 'up' : 'down'} dot>
              {monitoringEnabled ? 'Running' : 'Paused'}
            </Badge>
            <Button variant="secondary" size="sm" onClick={onToggleMonitoring} loading={togglingMonitoring}>
              {monitoringEnabled ? <PowerOff size={14} /> : <Power size={14} />}
              {monitoringEnabled ? 'Pause all checks' : 'Resume all checks'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="admin-system">
        <SystemTile label="API server" icon={Cpu} state="up" />
        <SystemTile label="Database" icon={Database} state={system.database} />
        <SystemTile label="Redis" icon={Wifi} state={system.redis} />
        <SystemTile
          label="Ping queue"
          icon={PulseIcon}
          state="up"
          detail={
            system.queues.ping
              ? `${system.queues.ping.waiting ?? 0} waiting · ${system.queues.ping.delayed ?? 0} delayed · ${system.queues.ping.failed ?? 0} failed`
              : '—'
          }
        />
        <SystemTile
          label="Alert queue"
          icon={AlertTriangle}
          state="up"
          detail={
            system.queues.alert
              ? `${system.queues.alert.waiting ?? 0} waiting · ${system.queues.alert.failed ?? 0} failed`
              : '—'
          }
        />
      </Card>

      <div className="admin-stats">
        <StatTile label="Users" value={stats.users.total} icon={Users} sub={`${stats.users.admins} admin · ${stats.users.disabled} disabled`} />
        <StatTile label="Recent signups (7d)" value={overview.recentSignups ?? 0} icon={UserPlus} sub="new accounts" tone="accent" />
        <StatTile label="Endpoints" value={stats.endpoints.total} icon={Server} sub={`${stats.endpoints.active} active`} />
        <StatTile label="Operational" value={upRatio} tone={upRatio === 100 ? 'up' : upRatio > 0 ? 'warning' : 'down'} sub={`${stats.endpoints.up} up · ${stats.endpoints.down} down`} suffix="%" />
        <StatTile label="Checks · 24h" value={stats.checks24h} sub={`${stats.failures24h} failures`} />
        <StatTile label="Avg latency" value={stats.avgResponseTime24h} tone={stats.avgResponseTime24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
        <StatTile label="P95 latency" value={stats.p95Latency24h} tone={stats.p95Latency24h > 0 ? '' : 'muted'} sub="24h window" suffix="ms" />
        <StatTile label="Alerts · 24h" value={stats.alerts24h} tone={stats.alerts24h > 0 ? 'warning' : 'up'} sub="DOWN / RECOVERY" />
      </div>

      <div className="settings-section" style={{ marginTop: 24 }}>
        <div className="settings-section__head">
          <BarChart3 size={16} />
          <div>
            <h2 className="settings-section__title">Plan distribution</h2>
            <p className="settings-section__desc">How many accounts sit in each pricing tier.</p>
          </div>
        </div>
        <Card>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={planData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
              <XAxis
                dataKey="plan"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'rgba(148,163,184,.75)' }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'rgba(148,163,184,.75)' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                contentStyle={{
                  background: '#0f1620',
                  border: '1px solid rgba(148,163,184,.24)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#e2e8f0',
                }}
                itemStyle={{ color: '#e2e8f0' }}
                labelStyle={{ color: '#9aa6b8', fontWeight: 600 }}
              />
              <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="settings-section" style={{ marginTop: 24 }}>
        <div className="settings-section__head">
          <AlertTriangle size={16} />
          <div>
            <h2 className="settings-section__title">Recent alerts</h2>
            <p className="settings-section__desc">Latest state changes across every user on the platform.</p>
          </div>
        </div>
        <Card style={{ padding: 0 }}>
          {overview.recentAlerts.length === 0 ? (
            <EmptyState
              icon={Wifi}
              title="No alerts in the last 24h"
              description="Every service on the platform has been quiet."
            />
          ) : (
            <div className="event-list">
              {overview.recentAlerts.map((a) => (
                <div className={`event ${a.type === 'DOWN' ? 'event--down' : ''}`} key={a.id}>
                  <div className={`event__icon ${a.type === 'DOWN' ? 'event__icon--danger' : 'event__icon--success'}`}>
                    {a.type === 'DOWN' ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                  </div>
                  <div className="event__body">
                    <div className="event__title">
                      {a.endpoint?.name || 'Unknown endpoint'}
                      <Badge tone={a.type === 'DOWN' ? 'down' : 'up'} className="event__badge">
                        {a.type === 'DOWN' ? 'DOWN' : 'RECOVERED'}
                      </Badge>
                    </div>
                    <div className="event__url">
                      @{a.endpoint?.user?.username || 'unknown'}
                    </div>
                  </div>
                  <div className="event__time">
                    <div className="event__time-main">{formatTime(a.sentAt)}</div>
                    <div className="event__time-sub">{formatRelative(a.sentAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};
