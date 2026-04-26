import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, Play, Plus, RefreshCcw, Trash2, X, CheckCircle2, XCircle, Power } from 'lucide-react';
import { toast } from 'sonner';
import {
  createScheduledJob,
  deleteScheduledJob,
  getScheduledJobLogs,
  getScheduledJobs,
  runScheduledJob,
  updateScheduledJob,
} from '../api';

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

const defaultBody = JSON.stringify({
  topics: ['ai', 'tech', 'markets'],
  regions: ['global'],
  max_articles: 60,
}, null, 2);

export default function ScheduledJobs() {
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: 'NewsIntel ingestion',
    category: 'News-Intel',
    url: 'https://newsintel-xvhe.onrender.com/api/admin/ingest-now',
    method: 'POST',
    interval_seconds: 900,
    timeout_seconds: 90,
    header_name: 'X-Ingest-Secret',
    header_value: '',
    body_json: defaultBody,
    is_enabled: true,
  });

  const load = async () => {
    try {
      const data = await getScheduledJobs();
      setJobs(data);
      setLoading(false);
      data.slice(0, 8).forEach((job) => {
        getScheduledJobLogs(job.id).then((items) => {
          setLogs((prev) => ({ ...prev, [job.id]: items }));
        }).catch(() => {});
      });
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      JSON.parse(form.body_json || '{}');
      await createScheduledJob(form);
      setShowAdd(false);
      toast.success('Scheduled job created');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to create scheduled job');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (job) => {
    try {
      toast.info(`Running ${job.name}`);
      await runScheduledJob(job.id);
      toast.success('Job completed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Run failed');
    }
  };

  const handleToggle = async (job) => {
    try {
      await updateScheduledJob(job.id, { is_enabled: !job.is_enabled });
      toast.success(job.is_enabled ? 'Job paused' : 'Job enabled');
      load();
    } catch {
      toast.error('Failed to update job');
    }
  };

  const handleDelete = async (job) => {
    if (!confirm(`Delete ${job.name}?`)) return;
    await deleteScheduledJob(job.id);
    toast.success('Scheduled job deleted');
    load();
  };

  if (loading) {
    return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading scheduled jobs...</p></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scheduled Jobs</h1>
          <p className="page-subtitle">Run protected HTTP tasks from Cloud Command without paid background workers.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}><RefreshCcw size={16} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Job</button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={28} color="var(--accent-indigo)" /></div>
          <h3>No scheduled jobs</h3>
          <p>Create a 15-minute NewsIntel ingestion trigger and Cloud Command will call it automatically.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Create NewsIntel Job</button>
        </div>
      ) : (
        <div className="grid grid-2">
          {jobs.map((job) => {
            const ok = job.status === 'SUCCESS';
            const failed = job.status === 'FAILED';
            const jobLogs = logs[job.id] || [];
            return (
              <motion.div key={job.id} className="card service-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="service-card-header">
                  <div style={{ minWidth: 0 }}>
                    <div className="service-name">{job.name}</div>
                    <div className="service-meta">
                      <span className={`badge ${job.is_enabled ? 'badge-up' : 'badge-neutral'}`}>
                        {job.is_enabled ? 'Enabled' : 'Paused'}
                      </span>
                      <span className={`badge ${ok ? 'badge-up' : failed ? 'badge-down' : 'badge-warning'}`}>
                        {ok ? <CheckCircle2 size={10} /> : failed ? <XCircle size={10} /> : <Clock size={10} />}
                        {job.status}
                      </span>
                      <span>{Math.round(job.interval_seconds / 60)}m interval</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-icon" title="Run now" onClick={() => handleRun(job)}><Play size={15} /></button>
                    <button className="btn btn-secondary btn-icon" title={job.is_enabled ? 'Pause' : 'Enable'} onClick={() => handleToggle(job)}><Power size={15} /></button>
                    <button className="btn btn-ghost btn-icon" title="Delete" onClick={() => handleDelete(job)}><Trash2 size={15} color="var(--accent-rose)" /></button>
                  </div>
                </div>
                <div className="service-url">{job.method} {job.url}</div>
                <div className="grid grid-3" style={{ gap: 10 }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="label">Last Run</div>
                    <strong>{formatAgo(job.last_run_at)}</strong>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="label">Latency</div>
                    <strong>{job.last_latency_ms ? `${job.last_latency_ms}ms` : '-'}</strong>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="label">HTTP</div>
                    <strong>{job.last_status_code || '-'}</strong>
                  </div>
                </div>
                {job.last_error && <div className="auth-error" style={{ margin: 0 }}>{job.last_error}</div>}
                <div className="table-wrapper" style={{ maxHeight: 220, overflow: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Time</th><th>Status</th><th>HTTP</th><th>Latency</th></tr></thead>
                    <tbody>
                      {jobLogs.slice(0, 6).map((log) => (
                        <tr key={log.id}>
                          <td>{formatAgo(log.created_at)}</td>
                          <td><span className={`badge badge-sm ${log.status === 'SUCCESS' ? 'badge-up' : 'badge-down'}`}>{log.status}</span></td>
                          <td>{log.status_code || '-'}</td>
                          <td>{log.latency_ms ? `${log.latency_ms}ms` : '-'}</td>
                        </tr>
                      ))}
                      {jobLogs.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No runs yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)}>
            <motion.div className="modal-panel modal-panel-lg" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">New Scheduled Job</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="grid grid-2" style={{ gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">URL</label>
                  <input className="form-input form-input-mono" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                <div className="grid grid-3" style={{ gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Method</label>
                    <select className="form-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                      {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Interval</label>
                    <select className="form-input" value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: Number(e.target.value) })}>
                      <option value={900}>15 minutes</option>
                      <option value={1800}>30 minutes</option>
                      <option value={3600}>1 hour</option>
                      <option value={21600}>6 hours</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Timeout seconds</label>
                    <input className="form-input" type="number" min="5" max="300" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-2" style={{ gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Secret Header</label>
                    <input className="form-input form-input-mono" value={form.header_name} onChange={(e) => setForm({ ...form, header_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Secret Value</label>
                    <input className="form-input form-input-mono" type="password" value={form.header_value} onChange={(e) => setForm({ ...form, header_value: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">JSON Body</label>
                  <textarea className="form-input form-input-mono" rows={8} value={form.body_json} onChange={(e) => setForm({ ...form, body_json: e.target.value })} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Activity size={16} /> Create 15m Job</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
