import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel" style={{ padding: '12px', border: '1px solid var(--primary)', background: 'rgba(0,0,0,0.8)' }}>
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</p>
        <p style={{ margin: 0, color: 'var(--primary)', fontSize: '16px' }}>
          {payload[0].value.toLocaleString()} <span style={{ fontSize: '10px' }}>tokens</span>
        </p>
      </div>
    );
  }
  return null;
};

const UsageCharts = ({ data }) => {
  return (
    <div className="card" style={{ padding: '24px', height: '350px', marginBottom: '32px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Usage Overview</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total token usage across all keys (Last 7 Days)</p>
        </div>
      </div>
      
      <div style={{ width: '100%', height: '240px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              dy={10}
              tickFormatter={(str) => {
                const date = new Date(str);
                return date.toLocaleDateString(undefined, { weekday: 'short' });
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area 
              type="monotone" 
              dataKey="total_tokens" 
              stroke="var(--primary)" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorTokens)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UsageCharts;
