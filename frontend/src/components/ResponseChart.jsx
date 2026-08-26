import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export const ResponseChart = ({ data, p95, xGranularity = 'time' }) => {
  const formatTick = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    if (xGranularity === 'date') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFull = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-strong)',
            padding: '9px 13px',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            fontSize: '12px',
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {formatFull(label)}
          </p>
          <p style={{ color: 'var(--accent-text)', fontWeight: 700, fontSize: 16 }}>
            {payload[0].value} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>ms</span>
          </p>
          {point.uptimePct != null && (
            <p style={{ marginTop: 3, fontSize: 11, color: point.uptimePct >= 99 ? 'var(--success-text)' : point.uptimePct >= 95 ? 'var(--warning-text)' : 'var(--danger-text)' }}>
              Uptime {point.uptimePct}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return <div className="chart-empty">No response-time data yet — checks will appear here.</div>;
  }

  return (
    <div style={{ width: '100%', height: 280 }} className="animate-fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTick}
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            width={56}
            domain={[0, (dataMax) => Math.max(dataMax * 1.2, 200)]}
            tickFormatter={(value) => `${Math.round(value)}ms`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
          {p95 != null && p95 > 0 && (
            <ReferenceLine
              y={Math.round(p95)}
              stroke="var(--warning)"
              strokeDasharray="4 4"
              label={{
                value: `P95 ${Math.round(p95)}ms`,
                position: 'insideBottomRight',
                fill: 'var(--text-muted)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="responseTime"
            stroke="var(--accent)"
            strokeWidth={1.8}
            fillOpacity={1}
            fill="url(#colorRt)"
            isAnimationActive={true}
            animationDuration={400}
            dot={false}
            activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
