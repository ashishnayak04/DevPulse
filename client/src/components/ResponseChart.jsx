import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

export const ResponseChart = ({ data }) => {
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(13, 15, 40, 0.95)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)'
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
            {formatTime(label)}
          </p>
          <p style={{ color: '#a78bfa', fontWeight: '600', fontSize: '18px' }}>
            {payload[0].value} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>ms</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: '14px'
      }}>
        No response time data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '300px' }} className="animate-fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, (dataMax) => Math.max(dataMax * 1.2, 100)]}
            tickFormatter={(value) => `${Math.round(value)}ms`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="responseTime"
            stroke="#a78bfa"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRt)"
            isAnimationActive={true}
            dot={false}
            activeDot={{ r: 4, fill: '#a78bfa', stroke: 'rgba(139,92,246,0.3)', strokeWidth: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
