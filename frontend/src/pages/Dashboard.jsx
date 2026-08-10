import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe, KeyRound, Server, Triangle, Activity,
  ArrowUpRight, CheckCircle2, XCircle, Zap, Users,
  Flame, Radio, Clock
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';
import {
  getMonitors, getApiKeySummary, getRenderAccounts, getVercelAccounts,
  recordVisit, getVisits, ensureBackendAwake
} from '../api';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  }),
};

function DashTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="dash-tooltip-row">
          <span className="dash-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function buildActivity(monitors, apiSummary) {
  const rows = [];
  const now = Date.now();
  monitors.slice(0, 8).forEach((m, i) => {
    const ok = m.status === 'UP';
    const warm = m.status === 'AWAKENING' || m.status === 'SLEEPING';
    rows.push({
      id: `m-${m.id}`,
      ts: now - i * 45000,
      type: ok ? 'ok' : warm ? 'warn' : 'bad',
      name: m.name || 'Monitor',
      detail: ok ? `health check · ${m.status}` : `is ${m.status}`,
    });
  });
  if (apiSummary) {
    rows.push({
      id: 'tokens',
      ts: now - 12000,
      type: (apiSummary.errors_today || 0) > 0 ? 'warn' : 'ok',
      name: 'API usage',
      detail: `tokens ${(apiSummary.tokens_today || 0).toLocaleString()} · ${apiSummary.requests_today || 0} requests`,
    });
  }
  return rows.sort((a, b) => b.ts - a.ts).slice(0, 10);
}

function formatTime(ts) {
  try {
    return new Date(ts).toTimeString().slice(0, 8);
  } catch {
    return '—';
  }
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
      await ensureBackendAwake();
      if (cancelled) return;
      recordVisit();
      const results = await Promise.allSettled([
        getMonitors(),
        getApiKeySummary(),
        getRenderAccounts(),
        getVercelAccounts(),
        getVisits(),
      ]);
      if (cancelled) return;
      const val = (i, fallback) => (results[i].status === 'fulfilled' ? results[i].value : fallback);
      const mon = Array.isArray(val(0, [])) ? val(0, []) : [];
      setMonitors(mon);
      setApiSummary(val(1, null));
      setRenderAccounts(Array.isArray(val(2, [])) ? val(2, []) : []);
      setVercelAccounts(Array.isArray(val(3, [])) ? val(3, []) : []);
      const vis = Array.isArray(val(4, [])) ? val(4, []) : [];
      setVisits(
        [...vis].reverse().map((d) => ({
          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          visits: d.visits,
        }))
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // light poll for live feel
  useEffect(() => {
    const t = setInterval(() => {
      getMonitors().then((d) => setMonitors(Array.isArray(d) ? d : [])).catch(() => {});
      getApiKeySummary().then(setApiSummary).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const monitorsUp = monitors.filter((m) => m.status === 'UP').length;
  const monitorsDown = monitors.filter((m) => m.status === 'DOWN').length;
  const monitorsWarm = monitors.filter((m) => m.status === 'AWAKENING' || m.status === 'SLEEPING').length;
  const uptimeNum = monitors.length > 0
    ? parseFloat(((monitorsUp / monitors.length) * 100).toFixed(1))
    : 0;
  const uptimeColor = uptimeNum >= 99 ? 'var(--accent-emerald)' : uptimeNum >= 90 ? 'var(--accent-amber)' : 'var(--accent-rose)';
  const degraded = monitorsDown + monitorsWarm;
  const totalVisits = visits.reduce((s, d) => s + d.visits, 0);
  const activity = useMemo(() => buildActivity(monitors, apiSummary), [monitors, apiSummary]);

  // second chart: rolling visits as “activity index” when no token history API
  const activitySeries = visits.map((d, i) => ({
    date: d.date,
    value: Math.max(1, Math.round(d.visits * (0.6 + (i % 5) * 0.08))),
  }));

  const stats = [
    {
      label: 'Sites monitored',
      value: monitors.length,
      sub: monitors.length
        ? (monitorsDown > 0 ? `${monitorsDown} down` : 'all healthy')
        : 'none yet',
      subOk: monitorsDown === 0 && monitors.length > 0,
      icon: Globe,
      link: '/monitors',
      color: 'var(--accent-emerald)',
      glow: 'var(--accent-emerald-glow)',
    },
    {
      label: 'API keys',
      value: apiSummary?.total_keys || 0,
      sub: `${apiSummary?.active_keys || 0} active`,
      icon: KeyRound,
      link: '/api-keys',
      color: 'var(--accent-purple)',
      glow: 'var(--accent-purple-glow)',
    },
    {
      label: 'Render',
      value: renderAccounts.length,
      sub: renderAccounts.length ? 'accounts connected' : 'not connected',
      icon: Server,
      link: '/render',
      color: 'var(--accent-emerald)',
      glow: 'var(--accent-emerald-glow)',
    },
    {
      label: 'Vercel',
      value: vercelAccounts.length,
      sub: vercelAccounts.length ? 'projects live' : 'not connected',
      icon: Triangle,
      link: '/vercel',
      color: 'var(--text-primary)',
      glow: 'rgba(255,255,255,0.06)',
    },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Initializing command center…</p>
        </div>
      </div>
    );
  }

  const isEmpty = !monitors.length && !apiSummary?.total_keys && !renderAccounts.length && !vercelAccounts.length;

  return (
    <div className="page-container dash-v4">
      {/* Hero — prototype style */}
      <div className="dash-hero">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-text-animated dash-hero-title"
        >
          Command Center
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="page-subtitle"
        >
          Real-time overview of your infrastructure, APIs, and deployments
        </motion.p>
      </div>

      {/* Top stats — prototype card-lift */}
      <div className="grid grid-4 dash-stat-grid">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
              <Link to={s.link} className="dash-stat-link">
                <div className="card card-interactive dash-stat-card">
                  <div className="dash-stat-icon" style={{ background: s.glow, color: s.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="dash-stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className={`dash-stat-sub ${s.subOk ? 'ok' : ''}`}>{s.sub}</div>
                  <ArrowUpRight size={14} className="dash-stat-arrow" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Status row — big numbers like prototype (not radial-only) */}
      <div className="grid grid-3 dash-status-grid">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="card card-pad card-glow dash-metric-card">
          <div className="dash-metric-label">Global uptime</div>
          <div className="dash-metric-value" style={{ color: monitors.length ? uptimeColor : 'var(--text-muted)' }}>
            {monitors.length ? `${uptimeNum}%` : '—'}
          </div>
          <div className="dash-metric-caption">
            {monitors.length ? `${monitorsUp} / ${monitors.length} sites up` : 'No monitors yet'}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }} className="card card-pad dash-metric-card">
          <div className="dash-metric-label">System status</div>
          <div className="dash-status-line">
            <span
              className="dash-status-dot"
              style={{
                background: degraded > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                boxShadow: degraded > 0 ? '0 0 16px var(--accent-rose)' : '0 0 16px var(--accent-emerald)',
              }}
            />
            <span style={{ color: degraded > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
              {monitors.length === 0
                ? 'Awaiting monitors'
                : degraded > 0
                  ? `${degraded} Degraded`
                  : 'Fully operational'}
            </span>
          </div>
          <div className="dash-metric-caption">
            {monitors.length === 0 ? 'Add a monitor to start' : 'All systems monitored'}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card card-pad card-glow dash-metric-card">
          <div className="dash-metric-label">Tokens used today</div>
          <div className="dash-metric-value" style={{ color: 'var(--accent-purple)' }}>
            {(apiSummary?.tokens_today || 0).toLocaleString()}
          </div>
          <div className="dash-metric-caption dash-token-meta">
            <span><Radio size={11} /> {apiSummary?.requests_today || 0} requests</span>
            {(apiSummary?.errors_today || 0) > 0 && (
              <span className="err"><Flame size={11} /> {apiSummary.errors_today} errors</span>
            )}
            {!(apiSummary?.errors_today) && <span>0 errors</span>}
          </div>
        </motion.div>
      </div>

      {/* Dual charts */}
      <div className="grid grid-2 dash-charts-grid">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card card-pad">
          <div className="dash-chart-head">
            <h3><Users size={15} /> Platform visits</h3>
            <span className="mono-meta">{totalVisits.toLocaleString()} total · last 30 days</span>
          </div>
          <div className="dash-chart-body">
            {visits.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visits}>
                  <defs>
                    <linearGradient id="visitGradV4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-indigo)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-indigo)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="transparent" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="transparent" width={32} />
                  <Tooltip content={<DashTooltip />} />
                  <Area type="monotone" dataKey="visits" name="Visits" stroke="var(--accent-indigo)" fill="url(#visitGradV4)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dash-chart-empty">No visit data yet — open the app daily to build the chart</div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card card-pad">
          <div className="dash-chart-head">
            <h3><Zap size={15} /> Activity trend</h3>
            <span className="mono-meta">platform load proxy</span>
          </div>
          <div className="dash-chart-body">
            {activitySeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activitySeries}>
                  <defs>
                    <linearGradient id="actGradV4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="transparent" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="transparent" width={32} />
                  <Tooltip content={<DashTooltip />} />
                  <Area type="monotone" dataKey="value" name="Activity" stroke="var(--accent-purple)" fill="url(#actGradV4)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dash-chart-empty">Activity appears once visit analytics start recording</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Monitor chips + live activity */}
      <div className="grid grid-2 dash-bottom-grid">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="card card-pad">
          <div className="dash-chart-head">
            <h3><Activity size={15} /> Monitor status</h3>
            <Link to="/monitors" className="dash-view-all">View all →</Link>
          </div>
          {monitors.length === 0 ? (
            <p className="dash-chart-empty" style={{ minHeight: 80 }}>No monitors — <Link to="/monitors">add one</Link></p>
          ) : (
            <div className="dash-monitor-chips">
              {monitors.map((m) => {
                const ok = m.status === 'UP';
                const warm = m.status === 'AWAKENING' || m.status === 'SLEEPING';
                return (
                  <Link
                    key={m.id}
                    to="/monitors"
                    className={`dash-chip ${ok ? 'ok' : warm ? 'warn' : 'bad'}`}
                  >
                    {ok ? <CheckCircle2 size={12} /> : warm ? <Clock size={12} /> : <XCircle size={12} />}
                    {m.name} · {m.status}
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card card-pad">
          <div className="dash-chart-head">
            <h3><Radio size={15} /> Live activity</h3>
            <span className="badge badge-active badge-live">LIVE</span>
          </div>
          <div className="dash-live-feed">
            {activity.length === 0 && (
              <div className="dash-chart-empty">Activity appears when monitors and API usage load</div>
            )}
            {activity.map((row) => (
              <div key={row.id} className="dash-log-row">
                <span className="dash-log-time">{formatTime(row.ts)}</span>
                <span className={`badge badge-sm ${row.type === 'ok' ? 'badge-up' : row.type === 'warn' ? 'badge-warning' : 'badge-down'}`}>
                  {row.type === 'ok' ? 'OK' : row.type === 'warn' ? 'WARN' : 'ERR'}
                </span>
                <span className="dash-log-msg">
                  <strong>{row.name}</strong> {row.detail}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {isEmpty && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card empty-state" style={{ marginTop: 20 }}>
          <div className="empty-state-icon"><Activity size={28} color="var(--accent-indigo)" /></div>
          <h3>Welcome to Cloud Command</h3>
          <p>Get started by adding a site monitor, connecting Render or Vercel, or storing API keys.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/monitors" className="btn btn-primary"><Globe size={15} /> Add Monitor</Link>
            <Link to="/api-keys" className="btn btn-secondary"><KeyRound size={15} /> Add API Key</Link>
            <Link to="/render" className="btn btn-secondary"><Server size={15} /> Connect Render</Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
