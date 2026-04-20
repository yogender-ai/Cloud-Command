import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, KeyRound, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Trash2, Shield, Zap, X, BarChart3, Lock, Mail, ShieldOff, Filter,
  ChevronRight, Calculator, Check, Copy, Activity, TrendingUp,
  Clock, Server, Flame, Hash
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, ComposedChart, Bar, Line, BarChart, PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
import { getApiKeys, addApiKey, deleteApiKey, updateApiKey, checkApiKey, getApiKeySummary, getProfile, requestVaultOtp, verifyVaultOtp } from '../api';
import { CategoryEditor } from '../components/CategoryEditor';

const PROVIDERS = ['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'HuggingFace', 'Groq', 'Mistral', 'xAI', 'Cohere', 'Other'];
const VAULT_LOCK_MS = 15 * 60 * 1000;
const POLL_INTERVAL = 8000; // 8 second live refresh
const TIME_RANGES = [
  { key: '1h', label: '1 Hour' },
  { key: '1d', label: '1 Day' },
  { key: '7d', label: '7 Days' },
  { key: '1m', label: '1 Month' },
  { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All Time' },
];
const KEY_COLORS = ['#a855f7', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

function StatusBadge({ status }) {
  const s = status.toLowerCase();
  if (s.includes('active')) return <span className="badge badge-active badge-live"><CheckCircle2 size={10} /> Active</span>;
  if (s.includes('invalid')) return <span className="badge badge-invalid"><XCircle size={10} /> Invalid</span>;
  if (s.includes('suspend') || s.includes('rate') || s.includes('balance'))
    return <span className="badge badge-warning"><AlertCircle size={10} /> {status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

function OtpInput({ value, onChange, length = 6 }) {
  const inputs = useRef([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      const next = [...digits]; next[idx] = '';
      onChange(next.join(''));
      if (idx > 0) inputs.current[idx - 1]?.focus();
    }
  };
  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/, '');
    if (!val) return;
    const next = [...digits]; next[idx] = val[val.length - 1];
    onChange(next.join(''));
    if (idx < length - 1) inputs.current[idx + 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, '').slice(0, length));
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input key={i} ref={el => inputs.current[i] = el} type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleChange(e, i)} onKeyDown={e => handleKey(e, i)} onPaste={handlePaste}
          style={{ width: 52, height: 60, textAlign: 'center', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)',
            background: 'var(--bg-input)', border: `2px solid ${d ? 'var(--accent-indigo)' : 'var(--border)'}`,
            borderRadius: 12, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }} />
      ))}
    </div>
  );
}

function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const m = Math.floor(left / 60), s = left % 60;
  return <span style={{ fontFamily: 'var(--font-mono)', color: left < 60 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{m}:{String(s).padStart(2, '0')}</span>;
}

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#fff', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{p.name?.includes('%') ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
}

function DetailModal({ apiKey, onClose }) {
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-panel modal-panel-lg" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ marginBottom: 20 }}>
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {apiKey.name}
              <StatusBadge status={apiKey.status} />
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Provider: {apiKey.provider}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Provider Limits</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-emerald)' }}>Unknown</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Standard Tier</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Tokens Used (Est.)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-purple)' }}>{(apiKey.tokens_used || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>In current window</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Last Assessed</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{new Date(apiKey.last_checked).toLocaleTimeString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(apiKey.last_checked).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="chart-container">
            <h3 className="chart-title"><Calculator size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: 'var(--accent-indigo)' }} />Token Usage Calculation</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                AI Model providers rarely disclose granular remaining capacity without paid enterprise accounts. Cloud-Command tracks the volumetric output of the prompts routed through this API key locally on the platform, combined with the successful heuristic validation pings.
            </p>
            <br/>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                Currently, <strong>{apiKey.tokens_used || 0}</strong> tokens have been successfully consumed via Cloud-Command for this API Key. 
            </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ApiVault() {
  const [keys, setKeys] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'OpenAI', category: '', key_value: '' });
  const [adding, setAdding] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const [selectedKey, setSelectedKey] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  
  // OTP Flow States
  const [requireOtpFor, setRequireOtpFor] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const lockTimerRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    getProfile().then(p => setProfile(p)).catch(() => {});
    loadVaultData();
  }, []);

  // Live polling — auto-refresh every 8 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadSummaryOnly();
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [timeRange]);

  const loadSummaryOnly = useCallback(async () => {
    try {
      const s = await getApiKeySummary(timeRange);
      setSummary(s);
    } catch {}
  }, [timeRange]);

  const loadVaultData = async () => {
    try {
      const [k, s] = await Promise.all([getApiKeys(), getApiKeySummary(timeRange)]);
      setKeys(k); setSummary(s);
    } catch {} finally { setLoading(false); }
  };

  // Reload summary when time range changes
  useEffect(() => {
    loadSummaryOnly();
  }, [timeRange, loadSummaryOnly]);

  const handleSendOtp = async (action) => {
    if (!profile?.notification_email) {
      toast.error('Verify your email in Settings first.');
      return;
    }
    setRequireOtpFor(action);
    setSending(true); setOtpError('');
    try {
      await requestVaultOtp();
      setOtpSent(true); setOtpCode('');
      toast.success('OTP sent to your verified email for authorization');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
      setRequireOtpFor(null);
    } finally { setSending(false); }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return;
    setVerifying(true); setOtpError('');
    try {
      await verifyVaultOtp(otpCode);
      setVaultUnlocked(true);
      setOtpSent(false);
      setOtpCode('');
      
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        setVaultUnlocked(false);
        toast.info('Vault relocked for modifying keys');
      }, VAULT_LOCK_MS);
      
      toast.success('Authorized successfully');
      
      if (requireOtpFor === 'add') {
        setShowAdd(true);
      } else if (requireOtpFor?.type === 'delete') {
        executeDelete(requireOtpFor.id);
      }
      setRequireOtpFor(null);
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'Invalid or expired OTP');
    } finally { setVerifying(false); }
  };

  const attemptAdd = () => {
    if (vaultUnlocked) setShowAdd(true);
    else handleSendOtp('add');
  };

  const attemptDelete = (id) => {
    if (vaultUnlocked) executeDelete(id);
    else handleSendOtp({ type: 'delete', id });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await addApiKey(form);
      setShowAdd(false);
      setForm({ name: '', provider: 'OpenAI', category: '', key_value: '' });
      loadVaultData();
      toast.success('API key added & validated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add key');
    } finally { setAdding(false); }
  };

  const executeDelete = async (id) => {
    if (!confirm('Delete this API key?')) return;
    await deleteApiKey(id); 
    loadVaultData(); 
    toast.success('Key deleted');
  };

  const handleCheck = async (e, id) => {
    e.stopPropagation();
    try { await checkApiKey(id); loadVaultData(); toast.success('Key re-validated'); }
    catch { toast.error('Validation failed'); }
  };

  const handleCheckAll = async () => {
    await Promise.all(keys.map(k => checkApiKey(k.id).catch(() => null)));
    loadVaultData(); toast.success('All keys refreshed');
  };

  const handleCategoryChange = async (id, cat) => {
    try {
      const updated = await updateApiKey(id, cat ? { category: cat } : { clear_category: true });
      setKeys(prev => prev.map(k => k.id === id ? { ...k, category: updated.category } : k));
      toast.success(cat ? `Tagged as "${cat}"` : 'Category cleared');
    } catch { toast.error('Failed to update category'); }
  };

  const allCategories = [...new Set(keys.map(k => k.category).filter(Boolean))];
  const categories = ['All', ...allCategories];
  const filtered = filterCat === 'All' ? keys : keys.filter(k => k.category === filterCat);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading API keys...</p></div></div>;

  const processedHistory = (summary?.usage_history || []).map(d => ({
    ...d,
    success_requests: (d.total_requests || 0) - (d.failed_requests || 0),
    success_rate: d.total_requests > 0 ? Math.round(((d.total_requests - d.failed_requests) / d.total_requests) * 100) : 100,
  }));

  const perKey = summary?.per_key || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">API Vault</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={13} color="var(--accent-emerald)" /> {vaultUnlocked ? "Vault unlocked · Modification authorized" : "Vault secure · Modification requires OTP"}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, color: 'var(--accent-emerald)' }}>
              <Activity size={10} /> LIVE
            </span>
          </p>
        </div>
        <div className="header-actions">
          {keys.length > 0 && <button className="btn btn-secondary" onClick={handleCheckAll}><RefreshCw size={14} /> Refresh All</button>}
          <button className="btn btn-primary" onClick={attemptAdd} disabled={sending}>
            {sending && requireOtpFor === 'add' ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }}/>: <Plus size={16} />}
            Add Key
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {summary && (
        <div className="grid grid-3" style={{ marginBottom: 24, gap: 16 }}>
          {[
            { icon: <KeyRound size={20} />, label: 'Total Keys', value: summary.total_keys, color: '#6366f1', glow: 'rgba(99,102,241,0.1)' },
            { icon: <Shield size={20} />, label: 'Active', value: summary.active_keys, color: '#10b981', glow: 'var(--accent-emerald-glow)' },
            { icon: <Zap size={20} />, label: 'Tokens Today', value: (summary.tokens_today || 0).toLocaleString(), color: '#a855f7', glow: 'var(--accent-purple-glow)' },
            { icon: <Server size={20} />, label: 'Requests Today', value: summary.requests_today || 0, color: '#0ea5e9', glow: 'rgba(14,165,233,0.1)' },
            { icon: <AlertCircle size={20} />, label: 'Errors Today', value: summary.errors_today || 0, color: '#f43f5e', glow: 'rgba(244,63,94,0.1)' },
            { icon: <TrendingUp size={20} />, label: 'Success Rate', value: summary.requests_today > 0 ? `${Math.round(((summary.requests_today - summary.errors_today) / summary.requests_today) * 100)}%` : '—', color: '#10b981', glow: 'rgba(16,185,129,0.1)' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="card stat-card" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="stat-icon" style={{ background: s.glow }}>{React.cloneElement(s.icon, { color: s.color })}</div>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Time Range Selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <Clock size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Range:</span>
        {TIME_RANGES.map(tr => (
          <button key={tr.key} onClick={() => setTimeRange(tr.key)} style={{
            padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
            background: timeRange === tr.key ? 'rgba(99,102,241,0.15)' : 'transparent',
            borderColor: timeRange === tr.key ? 'rgba(99,102,241,0.5)' : 'var(--border)',
            color: timeRange === tr.key ? '#818cf8' : 'var(--text-muted)',
            boxShadow: timeRange === tr.key ? '0 0 12px rgba(99,102,241,0.15)' : 'none',
          }}>{tr.label}</button>
        ))}
      </div>

      {/* ── Analytics Grid ── */}
      {processedHistory.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Token Usage — Full Width */}
          <motion.div className="chart-container" style={{ gridColumn: '1 / -1' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><Zap size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#a855f7' }} />Token Usage</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Total: {processedHistory.reduce((s, d) => s + d.total_tokens, 0).toLocaleString()}
              </span>
            </h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processedHistory}>
                  <defs>
                    <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" tickFormatter={d => d.length > 5 ? d.slice(5) : d} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" width={45} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total_tokens" stroke="#a855f7" fill="url(#tokenGrad)" strokeWidth={2.5} name="Tokens" dot={false} activeDot={{ r: 4, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Requests & Success Rate */}
          <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="chart-title"><BarChart3 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#6366f1' }} />API Requests</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" tickFormatter={d => d.length > 5 ? d.slice(5) : d} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" width={30} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" width={35} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="success_requests" stackId="a" fill="rgba(99,102,241,0.4)" radius={[0,0,0,0]} name="Success" barSize={14} />
                  <Bar yAxisId="left" dataKey="failed_requests" stackId="a" fill="rgba(244,63,94,0.6)" radius={[3,3,0,0]} name="Errors" barSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="success_rate" stroke="#10b981" strokeWidth={2} dot={false} name="Success Rate %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* API Errors */}
          <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><Flame size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#f43f5e' }} />API Errors</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#f43f5e', fontFamily: 'var(--font-mono)' }}>
                {processedHistory.reduce((s, d) => s + (d.failed_requests || 0), 0)} total
              </span>
            </h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedHistory}>
                  <defs>
                    <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" tickFormatter={d => d.length > 5 ? d.slice(5) : d} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} stroke="transparent" width={30} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="failed_requests" fill="url(#errorGrad)" radius={[4,4,0,0]} name="Errors" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Per-Key Analytics Table ── */}
      {perKey.length > 0 && (
        <motion.div className="chart-container" style={{ marginBottom: 24 }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="chart-title"><Activity size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#0ea5e9' }} />Per-Key Usage Breakdown</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Key Name</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Project</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Tokens</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Requests</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Errors</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Health</th>
                </tr>
              </thead>
              <tbody>
                {perKey.map((pk, idx) => {
                  const health = pk.total_requests > 0 ? Math.round(((pk.total_requests - pk.failed_requests) / pk.total_requests) * 100) : 100;
                  return (
                    <tr key={pk.id} style={{
                      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: 6,
                          background: KEY_COLORS[idx % KEY_COLORS.length] + '22',
                          color: KEY_COLORS[idx % KEY_COLORS.length],
                          fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
                        }}>{idx + 1}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{pk.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, fontWeight: 600 }}>
                          {pk.provider}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{pk.category || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a855f7' }}>{pk.total_tokens.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#6366f1' }}>{pk.total_requests}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: pk.failed_requests > 0 ? '#f43f5e' : 'var(--text-muted)' }}>{pk.failed_requests}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 50, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 99, transition: 'width 0.5s',
                              width: `${health}%`,
                              background: health >= 80 ? '#10b981' : health >= 50 ? '#f59e0b' : '#f43f5e',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: health >= 80 ? '#10b981' : health >= 50 ? '#f59e0b' : '#f43f5e' }}>{health}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
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

      {/* Key Cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><KeyRound size={28} color="var(--accent-indigo)" /></div>
          <h3>{keys.length === 0 ? 'No API Keys' : `No keys in "${filterCat}"`}</h3>
          <p>{keys.length === 0 ? 'Add your first API key to start monitoring its status and usage.' : 'Try a different category filter.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {(filterCat === 'All' ? [...allCategories, null] : [filterCat === 'Uncategorized' ? null : filterCat]).map(cat => {
            const catKeys = filtered.filter(k => k.category === cat || (!k.category && !cat));
            if (catKeys.length === 0) return null;
            
            return (
              <div key={cat || 'Uncategorized'}>
                {filterCat === 'All' && (
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-indigo)' }} />
                    {cat || 'Uncategorized'} Projects
                  </h2>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingLeft: filterCat === 'All' ? 16 : 0, borderLeft: filterCat === 'All' ? '2px solid var(--border)' : 'none' }}>
                  {[...new Set(catKeys.map(k => k.provider).filter(Boolean))].map(provider => {
                    const providerKeys = catKeys.filter(k => k.provider === provider);
                    return (
                      <div key={provider}>
                        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {provider} API Keys
                        </h3>
                        <div className="grid grid-3">
                          <AnimatePresence>
                            {providerKeys.map((key, keyIdx) => {
                              // Find numeric index for the key
                              const globalIdx = keys.findIndex(k => k.id === key.id);
                              const pkData = perKey.find(pk => pk.id === key.id);
                              return (
                                <motion.div key={key.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                  className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }} onClick={() => setSelectedKey(key)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                        background: KEY_COLORS[globalIdx % KEY_COLORS.length] + '22',
                                        color: KEY_COLORS[globalIdx % KEY_COLORS.length],
                                        fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)',
                                      }}>#{globalIdx + 1}</span>
                                      <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{key.name}</h3>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{key.provider}</div>
                                      </div>
                                    </div>
                                    <StatusBadge status={key.status} />
                                  </div>
                                  <CategoryEditor
                                    category={key.category}
                                    suggestions={allCategories.filter(c => c !== key.category)}
                                    onSave={cat => handleCategoryChange(key.id, cat)}
                                  />
                                  <div onClick={() => setSelectedKey(key)} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <KeyRound size={13} style={{ opacity: 0.5 }} /> ********************
                                  </div>
                                  {/* Mini stats */}
                                  {pkData && (
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                                      <span style={{ color: '#a855f7', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pkData.total_tokens.toLocaleString()} tok</span>
                                      <span style={{ color: '#6366f1', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pkData.total_requests} req</span>
                                      {pkData.failed_requests > 0 && <span style={{ color: '#f43f5e', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pkData.failed_requests} err</span>}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 'auto' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Checked: {new Date(key.last_checked).toLocaleString()}</div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="btn btn-ghost btn-icon" onClick={(e) => handleCheck(e, key.id)} title="Re-validate"><RefreshCw size={14} /></button>
                                      <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); attemptDelete(key.id); }} title="Delete">
                                        {sending && requireOtpFor?.id === key.id ? <div className="spinner" style={{width:14,height:14}}/> : <Trash2 size={14} color="var(--accent-rose)" />}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedKey && <DetailModal apiKey={selectedKey} onClose={() => setSelectedKey(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {otpSent && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setOtpSent(false); setRequireOtpFor(null); }}>
             <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
               <div className="modal-header">
                 <h2 className="modal-title">Authorize Action</h2>
                 <button className="btn btn-ghost btn-icon" onClick={() => { setOtpSent(false); setRequireOtpFor(null); }}><X size={18} /></button>
               </div>
               <div style={{ textAlign: 'center', marginBottom: 24 }}>
                 <div className="vault-lock-icon" style={{ background: 'var(--accent-amber-glow)', border: '1px solid rgba(245,158,11,0.3)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%' }}>
                   <Shield size={32} color="var(--accent-amber)" />
                 </div>
                 <p style={{ color: 'var(--text-muted)' }}>
                   A verification code was sent to your email to perform this action. Expires in{' '}
                   <Countdown seconds={600} onExpire={() => { setOtpSent(false); toast.error('OTP expired'); }} />
                 </p>
               </div>
               <OtpInput value={otpCode} onChange={setOtpCode} />
               {otpError && <p style={{ color: 'var(--accent-rose)', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{otpError}</p>}
               <button className="btn btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={handleVerifyOtp} disabled={verifying || otpCode.length < 6}>
                 {verifying ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Verify & Execute'}
               </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <label className="form-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" placeholder="e.g. News-Intel" value={form.category} onChange={e => setForm({...form, category: e.target.value})} list="api-categories" />
                  <datalist id="api-categories">
                    {allCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
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
