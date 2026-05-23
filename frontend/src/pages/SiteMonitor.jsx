import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Globe, CheckCircle2, XCircle, Trash2, Clock, ChevronRight,
  Download, Activity, X, Shield, Code, Copy, Check, AlertTriangle,
  ExternalLink, Server, Lock, Filter
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';
import { getMonitors, addMonitor, deleteMonitor, updateMonitor, getMonitorLogs, exportMonitorCSV, inspectMonitor, getMonitorAnalytics, API_URL, ensureBackendAwake } from '../api';
import { CategoryBadge, CategoryEditor, getCategoryColor } from '../components/CategoryEditor';

const MONITOR_INTERVAL_OPTIONS = [
  { value: 840, label: '14m' },
  { value: 1800, label: '30m' },
  { value: 3600, label: '1h' },
  { value: 21600, label: '6h' },
];

function formatAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
      {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function MonitorCard({ monitor, onDelete, onClick, onCategoryChange, allCategories }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    getMonitorLogs(monitor.id).then(d => setLogs(d.reverse())).catch(() => {});
    const interval = setInterval(() => {
      getMonitorLogs(monitor.id).then(d => setLogs(d.reverse())).catch(() => {});
    }, 60000);  // 60s — reduced from 15s to prevent backend overload
    return () => clearInterval(interval);
  }, [monitor.id]);

  const isUp = monitor.status === 'UP';
  const isAwakening = monitor.status === 'AWAKENING';
  const isSleeping = monitor.status === 'SLEEPING';
  const borderColor = monitor.category ? getCategoryColor(monitor.category)?.border : undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', borderColor: borderColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div onClick={() => onClick(monitor, logs)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{monitor.name}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
            <Globe size={12} /> {monitor.url}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
          <span className={`badge ${isUp ? 'badge-up badge-live' : (isAwakening || isSleeping) ? 'badge-warning' : 'badge-down'}`}>
            {isUp ? <CheckCircle2 size={10} /> : (isAwakening || isSleeping) ? <Clock size={10} /> : <XCircle size={10} />} {monitor.status}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); onDelete(monitor.id); }}>
            <Trash2 size={14} color="var(--accent-rose)" />
          </button>
        </div>
      </div>
      {/* Inline category editor */}
      <div style={{ marginBottom: 8 }} onClick={e => e.stopPropagation()}>
        <CategoryEditor
          category={monitor.category}
          suggestions={allCategories.filter(c => c !== monitor.category)}
          onSave={async (cat) => {
            await onCategoryChange(monitor.id, cat);
          }}
        />
      </div>
      <div style={{ height: 80, width: '100%', margin: '8px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={logs}>
            <defs>
              <linearGradient id={`g-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ display: 'none' }} formatter={(v) => [`${v}ms`, 'Latency']} />
            <Area type="monotone" dataKey="latency" stroke={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} fill={`url(#g-${monitor.id})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 'auto' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {formatAgo(monitor.last_checked)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-indigo)' }}>Details <ChevronRight size={11} /></span>
      </div>
    </motion.div>
  );
}

function DetailModal({ monitor, logs: initialLogs, onClose }) {
  const [logs, setLogs] = useState(initialLogs);
  const [activeTab, setActiveTab] = useState('uptime');
  const [inspect, setInspect] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const isUp = monitor.status === 'UP';
  const isAwakening = monitor.status === 'AWAKENING';
  const isSleeping = monitor.status === 'SLEEPING';

  useEffect(() => {
    const intv = setInterval(() => {
      getMonitorLogs(monitor.id).then(d => setLogs(d.reverse())).catch(() => {});
    }, 30000);  // 30s — reduced from 5s to prevent backend overload
    return () => clearInterval(intv);
  }, [monitor.id]);

  useEffect(() => {
    if (activeTab === 'inspect' && !inspect) {
      setInspecting(true);
      inspectMonitor(monitor.id).then(d => setInspect(d)).catch(() => setInspect({ error: 'Failed to inspect' })).finally(() => setInspecting(false));
    }
    if (activeTab === 'tracking' && !analytics) {
      getMonitorAnalytics(monitor.id).then(d => setAnalytics(d)).catch(() => setAnalytics({ dailyVisits: [], hourlyVisits: [] }));
    }
  }, [activeTab]);

  const avgLatency = logs.length > 0 ? Math.round(logs.slice(0, 10).reduce((s, l) => s + (l.latency || 0), 0) / Math.min(logs.length, 10)) : 0;
  const uptimePct = logs.length > 0 ? ((logs.filter(l => l.status === 'UP').length / logs.length) * 100).toFixed(1) : '–';

  const trackingSnippet = `<!-- Cloud Command Visitor Tracking -->
<script>
(function(){
  fetch('${API_URL}/track/${monitor.id}', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ path: location.pathname, ref: document.referrer })
  }).catch(function(){});
})();
</script>`;

  const tabs = [
    { id: 'uptime', label: 'Uptime', icon: Activity },
    { id: 'inspect', label: 'Inspect', icon: Shield },
    { id: 'tracking', label: 'Visitors', icon: Globe },
  ];

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-panel modal-panel-xl" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {monitor.name}
              <span className={`badge ${isUp ? 'badge-up' : (isAwakening || isSleeping) ? 'badge-warning' : 'badge-down'}`}>{monitor.status}</span>
              <CategoryBadge category={monitor.category} />
            </h2>
            <a href={monitor.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Globe size={14} /> {monitor.url}
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exportMonitorCSV(monitor.id).then(blob => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `monitor-${monitor.id}-logs.csv`; a.click();
            })}><Download size={14} /> CSV</button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="monitor-detail-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Status', value: monitor.status, color: isUp ? 'var(--accent-emerald)' : (isAwakening || isSleeping) ? 'var(--accent-amber)' : 'var(--accent-rose)' },
            { label: 'Avg Latency', value: `${avgLatency}ms`, color: 'var(--accent-indigo)' },
            { label: 'Uptime', value: `${uptimePct}%`, color: 'var(--accent-emerald)' },
            { label: 'Total Checks', value: logs.length, color: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              color: activeTab === id ? 'var(--accent-indigo)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === id ? 'var(--accent-indigo)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.2s',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'uptime' && (
          <>
            <div className="chart-container" style={{ marginBottom: 24 }}>
              <h3 className="chart-title">Response Time History</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={logs}>
                    <defs>
                      <linearGradient id="colorBig" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="created_at" tickFormatter={t => t ? new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => `${v}ms`} width={50} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}
                      labelFormatter={l => new Date(l).toLocaleString()} formatter={v => [`${v} ms`, 'Latency']} />
                    <Area type="monotone" dataKey="latency" stroke={isUp ? '#10b981' : (isAwakening || isSleeping) ? '#f59e0b' : '#f43f5e'} fill="url(#colorBig)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Timestamp</th><th>Status</th><th>Latency</th></tr></thead>
                <tbody>
                  {logs.slice().reverse().slice(0, 30).map(log => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td><span className={`badge badge-sm ${log.status === 'UP' ? 'badge-up' : (log.status === 'AWAKENING' || log.status === 'SLEEPING') ? 'badge-warning' : 'badge-down'}`}>{log.status}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{log.latency} ms</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No pings recorded yet</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'inspect' && (
          <div>
            {inspecting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, color: 'var(--text-muted)' }}>
                <div className="spinner" />
                <p>Inspecting site security & headers...</p>
              </div>
            ) : inspect?.error ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--accent-rose)' }}><AlertTriangle size={24} style={{ marginBottom: 8 }} /><p>{inspect.error}</p></div>
            ) : inspect && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card" style={{ borderColor: inspect.ssl?.valid ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Lock size={16} color={inspect.ssl?.valid ? 'var(--accent-emerald)' : 'var(--accent-rose)'} />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>SSL Certificate</h3>
                    {inspect.ssl?.valid === true && <span className="badge badge-up">Valid</span>}
                    {inspect.ssl?.valid === false && <span className="badge badge-down">Invalid</span>}
                    {inspect.ssl === null && <span className="badge badge-neutral">HTTP only</span>}
                  </div>
                  {inspect.ssl?.valid !== null && inspect.ssl && (
                    <div className="inspect-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                      <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ISSUER</div><div style={{ fontSize: 13, fontWeight: 600 }}>{inspect.ssl.issuer || '–'}</div></div>
                      <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>EXPIRES</div><div style={{ fontSize: 13, fontWeight: 600 }}>{inspect.ssl.expires || '–'}</div></div>
                      <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>DAYS LEFT</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: inspect.ssl.days_left < 30 ? 'var(--accent-rose)' : inspect.ssl.days_left < 60 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                          {inspect.ssl.days_left ?? '–'} days
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Server size={16} color="var(--accent-indigo)" />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>HTTP Headers</h3>
                    {inspect.status_code && <span className={`badge ${inspect.status_code < 400 ? 'badge-up' : 'badge-down'}`}>HTTP {inspect.status_code}</span>}
                  </div>
                  {Object.keys(inspect.headers || {}).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No headers captured</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(inspect.headers).map(([k, v]) => (
                        <div key={k} className="header-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-indigo)', fontWeight: 600 }}>{k}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {inspect.redirect_chain?.length > 0 && (
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <ExternalLink size={16} color="var(--accent-amber)" />
                      <h3 style={{ fontSize: 14, fontWeight: 700 }}>Redirect Chain ({inspect.redirect_chain.length})</h3>
                    </div>
                    {inspect.redirect_chain.map((r, i) => (
                      <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span className="badge badge-warning" style={{ marginRight: 8 }}>{r.status}</span> {r.from}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Code size={16} color="var(--accent-indigo)" />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Visitor Tracking Snippet</h3>
                </div>
                <CopyButton text={trackingSnippet} />
              </div>
              <pre style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a0a0c8', overflow: 'auto', margin: 0, lineHeight: 1.7 }}>
                {trackingSnippet}
              </pre>
            </div>
            {!analytics ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
            ) : analytics.dailyVisits?.length > 0 ? (
              <div className="chart-container">
                <h3 className="chart-title">Daily Visitors (Last 30 Days)</h3>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...analytics.dailyVisits].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-muted)" tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={35} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Bar dataKey="visits" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Globe size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>No visitor data yet. Embed the snippet above on your site to start tracking.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function SiteMonitor() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', url: 'https://', category: '', interval_seconds: 840 });
  const [adding, setAdding] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const prevStatuses = useRef({});

  const load = () => {
    getMonitors().then(data => {
      data.forEach(m => {
        const prev = prevStatuses.current[m.id];
        if (prev && prev !== m.status) {
          if (m.status === 'DOWN') toast.error(`${m.name} went DOWN!`);
          else if (m.status === 'UP') toast.success(`${m.name} is back UP!`);
        }
        prevStatuses.current[m.id] = m.status;
      });
      setMonitors(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { ensureBackendAwake().then(load); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);  // wake first, then poll 30s

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      await addMonitor(form);
      setShowAdd(false);
      setForm({ name: '', url: 'https://', category: '', interval_seconds: 840 });
      load();
      toast.success('Monitor deployed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add monitor');
    } finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this monitor?')) return;
    await deleteMonitor(id);
    load();
    if (selected?.monitor?.id === id) setSelected(null);
    toast.success('Monitor removed');
  };

  const handleCategoryChange = async (id, cat) => {
    try {
      const updated = await updateMonitor(id, cat ? { category: cat } : { clear_category: true });
      setMonitors(prev => prev.map(m => m.id === id ? { ...m, category: updated.category } : m));
      toast.success(cat ? `Tagged as "${cat}"` : 'Category cleared');
    } catch {
      toast.error('Failed to update category');
    }
  };

  // Derived: unique categories + filtered list
  const allCategories = [...new Set(monitors.map(m => m.category).filter(Boolean))];
  const categories = ['All', ...allCategories];
  const filtered = filterCat === 'All' ? monitors : monitors.filter(m => m.category === filterCat);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading monitors...</p></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Site Monitor</h1>
          <p className="page-subtitle">Real-time uptime tracking, security inspection & visitor analytics</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Monitor</button>
      </div>

      {/* Category filter bar */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={14} color="var(--text-muted)" />
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
              background: filterCat === cat ? 'var(--accent-indigo-glow)' : 'transparent',
              borderColor: filterCat === cat ? 'rgba(99,102,241,0.4)' : 'var(--border)',
              color: filterCat === cat ? 'var(--accent-indigo)' : 'var(--text-muted)',
            }}>{cat}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Activity size={28} color="var(--accent-indigo)" /></div>
          <h3>{monitors.length === 0 ? 'No active monitors' : `No monitors in "${filterCat}"`}</h3>
          <p>{monitors.length === 0 ? 'Deploy your first health check to start tracking uptime and latency.' : 'Try a different category filter.'}</p>
          {monitors.length === 0 && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add Your First Monitor</button>}
        </div>
      ) : (
        <div>
          <AnimatePresence>
            {['Uncategorized', ...allCategories].map(cat => {
              const catMonitors = filtered.filter(m => cat === 'Uncategorized' ? !m.category : m.category === cat);
              if (catMonitors.length === 0) return null;
              return (
                <motion.div key={cat} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    {cat !== 'Uncategorized' && <div style={{ width: 12, height: 12, borderRadius: '50%', background: getCategoryColor(cat)?.bg, border: `1px solid ${getCategoryColor(cat)?.border}` }} />}
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{cat}</h2>
                    <span className="badge badge-neutral">{catMonitors.length}</span>
                  </div>
                  <div className="grid grid-3">
                    {catMonitors.map(m => (
                      <MonitorCard key={m.id} monitor={m} onDelete={handleDelete}
                        onClick={(mon, logs) => setSelected({ monitor: mon, logs })}
                        onCategoryChange={handleCategoryChange}
                        allCategories={allCategories}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selected && <DetailModal monitor={selected.monitor} logs={selected.logs} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)}>
            <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">New Monitor</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input required className="form-input" placeholder="Production API" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">URL</label>
                  <input required type="url" className="form-input form-input-mono" placeholder="https://api.example.com" value={form.url} onChange={e => setForm({...form, url: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" placeholder="e.g. News-Intel" value={form.category} onChange={e => setForm({...form, category: e.target.value})} list="site-categories" />
                  <datalist id="site-categories">
                    {allCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Polling Interval</label>
                  <div className="interval-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {MONITOR_INTERVAL_OPTIONS.map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => setForm({...form, interval_seconds: value})}
                        className={`btn ${form.interval_seconds === value ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'center', fontSize: 12 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={adding} style={{ marginTop: 8 }}>
                  {adding ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Deploy Monitor'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
