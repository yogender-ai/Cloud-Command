import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe, KeyRound, Server, Triangle, Activity,
  ArrowUpRight, CheckCircle2, XCircle, Zap, TrendingUp, Users,
  Shield, Flame, Radio
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';
import { getMonitors, getApiKeySummary, getRenderAccounts, getVercelAccounts, recordVisit, getVisits, ensureBackendAwake } from '../api';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }),
};

/* Custom dark tooltip */
function DashTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#fff', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* Radial Gauge for uptime */
function UptimeGauge({ percentage }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 99 ? '#10b981' : percentage >= 90 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="radial-gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle className="radial-gauge-bg" cx="70" cy="70" r={radius} />
        <circle
          className="radial-gauge-fill"
          cx="70" cy="70" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="radial-gauge-text">
        <span style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.03em' }}>
          {percentage}%
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Uptime
        </span>
      </div>
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
    let cancelled = false;
    (async () => {
      // Wake backend first (handles Render cold start)
      await ensureBackendAwake();
      if (cancelled) return;
      recordVisit();
      // Use allSettled so partial failures don't block the whole dashboard
      const results = await Promise.allSettled([
        getMonitors(),
        getApiKeySummary(),
        getRenderAccounts(),
        getVercelAccounts(),
        getVisits(),
      ]);
      if (cancelled) return;
      const val = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback;
      setMonitors(val(0, []));
      setApiSummary(val(1, null));
      setRenderAccounts(val(2, []));
      setVercelAccounts(val(3, []));
      const vis = val(4, []);
      const chartData = [...vis].reverse().map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        visits: d.visits,
      }));
      setVisits(chartData);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const monitorsUp = monitors.filter(m => m.status === 'UP').length;
  const monitorsDown = monitors.length - monitorsUp;
  const uptimeNum = monitors.length > 0 ? parseFloat(((monitorsUp / monitors.length) * 100).toFixed(1)) : 0;

  const stats = [
    {
      label: 'Sites Monitored', value: monitors.length,
      sub: monitors.length > 0 ? `${monitorsDown > 0 ? monitorsDown + ' down' : 'all healthy'}` : 'none yet',
      icon: Globe, color: '#10b981', bg: 'var(--accent-emerald-glow)', link: '/monitors',
    },
    {
      label: 'API Keys', value: apiSummary?.total_keys || 0,
      sub: `${apiSummary?.active_keys || 0} active`,
      icon: KeyRound, color: '#a855f7', bg: 'var(--accent-purple-glow)', link: '/api-keys',
    },
    {
      label: 'Render', value: renderAccounts.length,
      sub: 'connected', icon: Server, color: '#34d399',
      bg: 'var(--accent-emerald-glow)', link: '/render',
    },
    {
      label: 'Vercel', value: vercelAccounts.length,
      sub: 'connected', icon: Triangle, color: '#f0f0f5',
      bg: 'rgba(255,255,255,0.04)', link: '/vercel',
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
          className="gradient-text-animated"
          style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em' }}
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
          Real-time overview of your infrastructure, APIs, and deployments.
        </motion.p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
              <Link to={s.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card card-interactive stat-card" style={{ borderLeft: `3px solid ${s.color}` }}>
                  <div className="stat-icon" style={{ background: s.bg }}>
                    <Icon size={20} color={s.color} />
                  </div>
                  <div>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>}
                  </div>
                  <ArrowUpRight size={16} color="var(--text-muted)" style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Uptime Gauge + System Status + Tokens */}
      <div className="grid grid-3" style={{ marginBottom: 32 }}>
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          {monitors.length > 0 ? (
            <UptimeGauge percentage={uptimeNum} />
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Global Uptime
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-muted)' }}>–</div>
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {monitors.length > 0 ? `${monitorsUp}/${monitors.length} sites up` : 'No monitors'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>
            System Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: monitorsDown > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
              boxShadow: monitorsDown > 0 ? '0 0 20px var(--accent-rose)' : '0 0 20px var(--accent-emerald)',
              animation: 'pulse-dot 2s ease infinite',
            }} />
            <span style={{
              fontSize: 20, fontWeight: 700,
              color: monitorsDown > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
            }}>
              {monitorsDown > 0 ? `${monitorsDown} Degraded` : 'Fully Operational'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {monitors.length === 0 ? 'No monitors configured' : 'All systems monitored'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, opacity: 0.04 }}>
            <Zap size={70} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Tokens Used Today
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--accent-purple)', letterSpacing: '-0.02em' }}>
            {(apiSummary?.tokens_today || 0).toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Radio size={10} color="var(--accent-indigo)" /> {apiSummary?.requests_today || 0} requests
            </span>
            {(apiSummary?.errors_today || 0) > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-rose)' }}>
                <Flame size={10} /> {apiSummary.errors_today} errors
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Platform Visits Chart */}
      {visits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ marginBottom: 32 }}
        >
          <div className="chart-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ display: 'inline' }} /> Platform Visits
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {totalVisits.toLocaleString()} total · last 30 days
              </span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visits}>
                  <defs>
                    <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-indigo)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--accent-indigo)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" width={35} />
                  <Tooltip content={<DashTooltip />} />
                  <Area type="monotone" dataKey="visits" stroke="var(--accent-indigo)" fill="url(#visitGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: 'var(--accent-indigo)', stroke: '#fff', strokeWidth: 2 }} name="Visits" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Monitor Status Grid */}
      {monitors.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="var(--accent-indigo)" /> Monitor Status
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {monitors.map(m => (
                <Link key={m.id} to="/monitors" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                  background: m.status === 'UP' ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
                  border: `1px solid ${m.status === 'UP' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
                  textDecoration: 'none', color: 'inherit', fontSize: 13, fontWeight: 600,
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = m.status === 'UP' ? '0 0 16px rgba(16,185,129,0.2)' : '0 0 16px rgba(244,63,94,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
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

      {/* Empty State */}
      {monitors.length === 0 && !apiSummary?.total_keys && renderAccounts.length === 0 && vercelAccounts.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
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
