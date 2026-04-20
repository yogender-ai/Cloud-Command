import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe, KeyRound, Server, Triangle, Activity,
  ArrowUpRight, CheckCircle2, XCircle, Zap, TrendingUp, Users
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';
import { getMonitors, getApiKeySummary, getRenderAccounts, getVercelAccounts, recordVisit, getVisits } from '../api';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] } }),
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>{payload[0].value} visits</p>
    </div>
  );
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [renderAccounts, setRenderAccounts] = useState([]);
  const [vercelAccounts, setVercelAccounts] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recordVisit();
    Promise.all([
      getMonitors().catch(() => []),
      getApiKeySummary().catch(() => null),
      getRenderAccounts().catch(() => []),
      getVercelAccounts().catch(() => []),
      getVisits().catch(() => []),
    ]).then(([m, a, r, v, vis]) => {
      setMonitors(m);
      setApiSummary(a);
      setRenderAccounts(r);
      setVercelAccounts(v);
      // Format visits for chart (reverse to chronological order)
      const chartData = [...vis].reverse().map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        visits: d.visits,
      }));
      setVisits(chartData);
      setLoading(false);
    });
  }, []);

  const monitorsUp = monitors.filter(m => m.status === 'UP').length;
  const monitorsDown = monitors.length - monitorsUp;
  const uptime = monitors.length > 0 ? ((monitorsUp / monitors.length) * 100).toFixed(1) : '–';

  const stats = [
    {
      label: 'Sites Monitored',
      value: monitors.length,
      sub: monitors.length > 0 ? `${monitorsDown > 0 ? monitorsDown + ' down' : 'all healthy'}` : 'none yet',
      icon: Globe,
      color: '#10b981',
      bg: 'var(--accent-emerald-glow)',
      link: '/monitors',
    },
    {
      label: 'API Keys',
      value: apiSummary?.total_keys || 0,
      sub: `${apiSummary?.active_keys || 0} active`,
      icon: KeyRound,
      color: '#a855f7',
      bg: 'var(--accent-purple-glow)',
      link: '/api-keys',
    },
    {
      label: 'Render Accounts',
      value: renderAccounts.length,
      sub: 'connected',
      icon: Server,
      color: '#34d399',
      bg: 'var(--accent-emerald-glow)',
      link: '/render',
    },
    {
      label: 'Vercel Accounts',
      value: vercelAccounts.length,
      sub: 'connected',
      icon: Triangle,
      color: '#f0f0f5',
      bg: 'rgba(255,255,255,0.05)',
      link: '/vercel',
    },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Initializing command center...</p>
        </div>
      </div>
    );
  }

  const totalVisits = visits.reduce((s, d) => s + d.visits, 0);

  return (
    <div className="page-container">
      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-title"
          style={{ fontSize: 34 }}
        >
          Command Center
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="page-subtitle"
          style={{ fontSize: 15 }}
        >
          Real-time overview of all your infrastructure, APIs, and deployments.
        </motion.p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <Link to={s.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card card-interactive stat-card">
                  <div className="stat-icon" style={{ background: s.bg }}>
                    <Icon size={20} color={s.color} />
                  </div>
                  <div>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>}
                  </div>
                  <ArrowUpRight size={16} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Uptime + System Status + Tokens */}
      <div className="grid grid-3" style={{ marginBottom: 32 }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.05 }}>
            <TrendingUp size={80} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Global Uptime
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: parseFloat(uptime) >= 99 ? 'var(--accent-emerald)' : parseFloat(uptime) >= 90 ? 'var(--accent-amber)' : 'var(--accent-rose)', letterSpacing: '-0.03em' }}>
            {uptime}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {monitorsUp}/{monitors.length} sites up
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
            System Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: monitorsDown > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
              boxShadow: monitorsDown > 0 ? '0 0 16px var(--accent-rose)' : '0 0 16px var(--accent-emerald)',
              animation: 'pulse-dot 2s ease infinite',
            }} />
            <span style={{
              fontSize: 20, fontWeight: 700,
              color: monitorsDown > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
            }}>
              {monitorsDown > 0 ? `${monitorsDown} Degraded` : 'Fully Operational'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {monitors.length === 0 ? 'No monitors configured' : 'All systems monitored'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Tokens Used Today
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--accent-purple)', letterSpacing: '-0.02em' }}>
            {(apiSummary?.tokens_today || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <Zap size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> across all keys
          </div>
        </motion.div>
      </div>

      {/* Platform Visits Chart */}
      {visits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{ marginBottom: 32 }}
        >
          <div className="chart-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ display: 'inline' }} /> Platform Visits
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {totalVisits.toLocaleString()} total · last 30 days
              </span>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visits}>
                  <defs>
                    <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone" dataKey="visits"
                    stroke="#6366f1" fill="url(#visitGrad)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Status Grid */}
      {monitors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monitor Status</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {monitors.map(m => (
                <Link
                  key={m.id}
                  to="/monitors"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    background: m.status === 'UP' ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
                    border: `1px solid ${m.status === 'UP' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                    textDecoration: 'none', color: 'inherit', fontSize: 13, fontWeight: 600,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {m.status === 'UP'
                    ? <CheckCircle2 size={14} color="var(--accent-emerald)" />
                    : <XCircle size={14} color="var(--accent-rose)" />
                  }
                  <span style={{ color: m.status === 'UP' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {m.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State — no data at all */}
      {monitors.length === 0 && !apiSummary?.total_keys && renderAccounts.length === 0 && vercelAccounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'var(--accent-indigo-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Activity size={28} color="var(--accent-indigo)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Welcome to Cloud Command</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
              Get started by adding a site monitor, connecting a Render or Vercel account, or adding your API keys.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/monitors" className="btn btn-primary"><Globe size={15} /> Add Monitor</Link>
              <Link to="/api-keys" className="btn btn-secondary"><KeyRound size={15} /> Add API Key</Link>
              <Link to="/render" className="btn btn-secondary"><Server size={15} /> Connect Render</Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
