import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, KeyRound, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Trash2, Shield, Zap, X, BarChart3
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { getApiKeys, addApiKey, deleteApiKey, checkApiKey, getApiKeySummary } from '../api';

const PROVIDERS = ['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'HuggingFace', 'Groq', 'Mistral', 'Other'];

function StatusBadge({ status }) {
  const s = status.toLowerCase();
  if (s.includes('active')) return <span className="badge badge-active badge-live"><CheckCircle2 size={10} /> Active</span>;
  if (s.includes('invalid')) return <span className="badge badge-invalid"><XCircle size={10} /> Invalid</span>;
  if (s.includes('suspend') || s.includes('rate') || s.includes('balance'))
    return <span className="badge badge-warning"><AlertCircle size={10} /> {status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

export default function ApiVault() {
  const [keys, setKeys] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'OpenAI', key_value: '' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const [k, s] = await Promise.all([getApiKeys(), getApiKeySummary()]);
      setKeys(k);
      setSummary(s);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await addApiKey(form);
      setShowAdd(false);
      setForm({ name: '', provider: 'OpenAI', key_value: '' });
      load();
      toast.success('API key added & validated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add key');
    } finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key?')) return;
    await deleteApiKey(id);
    load();
    toast.success('Key deleted');
  };

  const handleCheck = async (id) => {
    try {
      await checkApiKey(id);
      load();
      toast.success('Key re-validated');
    } catch { toast.error('Validation failed'); }
  };

  const handleCheckAll = async () => {
    await Promise.all(keys.map(k => checkApiKey(k.id).catch(() => null)));
    load();
    toast.success('All keys refreshed');
  };

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading API keys...</p></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">API Vault</h1>
          <p className="page-subtitle">Securely monitor and validate your AI API keys</p>
        </div>
        <div className="header-actions">
          {keys.length > 0 && (
            <button className="btn btn-secondary" onClick={handleCheckAll}><RefreshCw size={14} /> Refresh All</button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Key</button>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-3" style={{ marginBottom: 24 }}>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.1)' }}><KeyRound size={20} color="var(--accent-indigo)" /></div>
            <div><div className="stat-label">Total Keys</div><div className="stat-value">{summary.total_keys}</div></div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-emerald-glow)' }}><Shield size={20} color="var(--accent-emerald)" /></div>
            <div><div className="stat-label">Active</div><div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>{summary.active_keys}</div></div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-purple-glow)' }}><Zap size={20} color="var(--accent-purple)" /></div>
            <div><div className="stat-label">Tokens Today</div><div className="stat-value" style={{ color: 'var(--accent-purple)' }}>{summary.tokens_today.toLocaleString()}</div></div>
          </div>
        </div>
      )}

      {/* Usage chart */}
      {summary?.usage_history?.length > 0 && (
        <div className="chart-container" style={{ marginBottom: 24 }}>
          <h3 className="chart-title"><BarChart3 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />7-Day Token Usage</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.usage_history}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={50} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Area type="monotone" dataKey="total_tokens" stroke="#a855f7" fill="url(#tokenGrad)" strokeWidth={2.5} name="Tokens" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Key Cards */}
      {keys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><KeyRound size={28} color="var(--accent-indigo)" /></div>
          <h3>No API Keys</h3>
          <p>Add your first API key to start monitoring its status and usage.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add Your First Key</button>
        </div>
      ) : (
        <div className="grid grid-3">
          <AnimatePresence>
            {keys.map(key => (
              <motion.div key={key.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{key.name}</h3>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{key.provider}</div>
                  </div>
                  <StatusBadge status={key.status} />
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <KeyRound size={13} style={{ opacity: 0.5 }} /> {key.masked_key}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 'auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Checked: {new Date(key.last_checked).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleCheck(key.id)} title="Re-validate"><RefreshCw size={14} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(key.id)} title="Delete"><Trash2 size={14} color="var(--accent-rose)" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)}>
            <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Add API Key</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Key Name</label>
                  <input required className="form-input" placeholder="My OpenAI Key" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select className="form-select" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})}>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input required type="password" className="form-input form-input-mono" placeholder="sk-..." value={form.key_value} onChange={e => setForm({...form, key_value: e.target.value})} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={adding} style={{ marginTop: 8 }}>
                  {adding ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Validate & Save'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
