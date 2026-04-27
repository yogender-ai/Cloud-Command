import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8,
      padding: '6px 10px', fontSize: 11,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#fff', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{payload[0].value}</div>
    </div>
  );
}

export default function LiveTrendChart({ data, title, color = '#6366f1' }) {
  return (
    <motion.div
      className="cc-trend-chart"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
    >
      <div className="cc-trend-header">
        <span className="cc-trend-title">{title}</span>
        <span className="cc-trend-badge">24H</span>
      </div>
      {data.length > 0 ? (
        <div style={{ height: 120, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} stroke="transparent" interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip content={<MiniTooltip />} />
              <Area type="monotone" dataKey="visits" stroke={color} fill="url(#trendGrad)" strokeWidth={2} dot={false}
                activeDot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="cc-trend-empty">No trend data yet</div>
      )}
    </motion.div>
  );
}
