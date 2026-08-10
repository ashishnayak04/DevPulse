import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const ResponseChart = ({ data }) => {
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-strong)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '12px',
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{formatTime(label)}</p>
          <p style={{ color: 'var(--accent-text)', fontWeight: 700, fontSize: 16 }}>
            {payload[0].value} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>ms</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 13.5,
        }}
      >
        No response time data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 280 }} className="animate-fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="var(--text-muted)"
            fontSize={11.5}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11.5}
            tickLine={false}
            axisLine={false}
            domain={[0, (dataMax) => Math.max(dataMax * 1.2, 100)]}
            tickFormatter={(value) => `${Math.round(value)}ms`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
          <Area
            type="monotone"
            dataKey="responseTime"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRt)"
            isAnimationActive={true}
            dot={false}
            activeDot={{ r: 4, fill: '#8b5cf6', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
