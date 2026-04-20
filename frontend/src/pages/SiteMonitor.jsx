import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Globe, CheckCircle2, XCircle, Trash2, Clock, ChevronRight,
  Download, Activity, X
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { getMonitors, addMonitor, deleteMonitor, getMonitorLogs, exportMonitorCSV } from '../api';

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

function MonitorCard({ monitor, onDelete, onClick }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    getMonitorLogs(monitor.id).then(d => setLogs(d.reverse())).catch(() => {});
  }, [monitor.id]);

  const isUp = monitor.status === 'UP';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card card-interactive"
      onClick={() => onClick(monitor, logs)}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{monitor.name}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Globe size={12} /> {monitor.url}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${isUp ? 'badge-up badge-live' : 'badge-down'}`}>
            {isUp ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {monitor.status}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); onDelete(monitor.id); }}>
            <Trash2 size={14} color="var(--accent-rose)" />
          </button>
        </div>
      </div>

      <div style={{ height: 80, width: '100%', margin: '8px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={logs}>
            <defs>
              <linearGradient id={`g-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ display: 'none' }}
              formatter={(v) => [`${v}ms`, 'Latency']}
            />
            <Area type="monotone" dataKey="latency" stroke={isUp ? '#10b981' : '#f43f5e'} fill={`url(#g-${monitor.id})`} strokeWidth={2} />
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

  useEffect(() => {
    const intv = setInterval(() => {
      getMonitorLogs(monitor.id).then(d => setLogs(d.reverse())).catch(() => {});
    }, 5000);
    return () => clearInterval(intv);
  }, [monitor.id]);

  const isUp = monitor.status === 'UP';

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-panel modal-panel-xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {monitor.name}
              <span className={`badge ${isUp ? 'badge-up' : 'badge-down'}`}>{monitor.status}</span>
            </h2>
            <a href={monitor.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Globe size={14} /> {monitor.url}
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              exportMonitorCSV(monitor.id).then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `monitor-${monitor.id}-logs.csv`;
                a.click();
              });
            }}>
              <Download size={14} /> CSV
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Big chart */}
        <div className="chart-container" style={{ marginBottom: 24 }}>
          <h3 className="chart-title">Response Time History</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={logs}>
                <defs>
                  <linearGradient id="colorBig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="created_at" tickFormatter={t => t ? new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => `${v}ms`} width={50} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}
                  labelFormatter={l => new Date(l).toLocaleString()}
                  formatter={v => [`${v} ms`, 'Latency']}
                />
                <Area type="monotone" dataKey="latency" stroke={isUp ? '#10b981' : '#f43f5e'} fill="url(#colorBig)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Logs table */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice().reverse().slice(0, 30).map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td><span className={`badge badge-sm ${log.status === 'UP' ? 'badge-up' : 'badge-down'}`}>{log.status}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{log.latency} ms</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No pings recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SiteMonitor() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', url: 'https://', interval_seconds: 60 });
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

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addMonitor(form);
      setShowAdd(false);
      setForm({ name: '', url: 'https://', interval_seconds: 60 });
      load();
      toast.success('Monitor deployed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add monitor');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this monitor?')) return;
    await deleteMonitor(id);
    load();
    if (selected?.monitor?.id === id) setSelected(null);
    toast.success('Monitor removed');
  };

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading monitors...</p></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Site Monitor</h1>
          <p className="page-subtitle">Real-time uptime tracking and latency analytics</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Monitor
        </button>
      </div>

      {monitors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Activity size={28} color="var(--accent-indigo)" /></div>
          <h3>No active monitors</h3>
          <p>Deploy your first health check to start tracking uptime and latency.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add Your First Monitor</button>
        </div>
      ) : (
        <div className="grid grid-3">
          <AnimatePresence>
            {monitors.map(m => (
              <MonitorCard key={m.id} monitor={m} onDelete={handleDelete} onClick={(mon, logs) => setSelected({ monitor: mon, logs })} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && <DetailModal monitor={selected.monitor} logs={selected.logs} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {/* Add Modal */}
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
                  <label className="form-label">Polling Interval</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {[30, 60, 120, 300].map(v => (
                      <button key={v} type="button" onClick={() => setForm({...form, interval_seconds: v})}
                        className={`btn ${form.interval_seconds === v ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'center', fontSize: 12 }}>
                        {v < 60 ? `${v}s` : `${v / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>Deploy Monitor</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
