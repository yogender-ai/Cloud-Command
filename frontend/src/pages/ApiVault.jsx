import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, KeyRound, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Trash2, Shield, Zap, X, BarChart3, Lock, Mail, ShieldOff, Tag, Filter
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { getApiKeys, addApiKey, deleteApiKey, checkApiKey, getApiKeySummary, getProfile, requestVaultOtp, verifyVaultOtp } from '../api';

const PROVIDERS = ['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'HuggingFace', 'Groq', 'Mistral', 'xAI', 'Cohere', 'Other'];
const KEY_CATEGORIES = ['AI', 'Dev Tools', 'Infrastructure', 'Analytics', 'Data', 'Monitoring', 'Other'];
const VAULT_LOCK_MS = 15 * 60 * 1000;

const CAT_COLORS = {
  AI:             { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  'Dev Tools':    { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.25)' },
  Infrastructure: { bg: 'rgba(6,182,212,0.12)',  color: '#06b6d4', border: 'rgba(6,182,212,0.25)' },
  Analytics:      { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  Data:           { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.25)' },
  Monitoring:     { bg: 'rgba(244,63,94,0.12)',  color: '#f43f5e', border: 'rgba(244,63,94,0.25)' },
  Other:          { bg: 'rgba(100,100,130,0.1)', color: '#888',    border: 'rgba(100,100,130,0.2)' },
};

function CategoryBadge({ category }) {
  if (!category) return null;
  const c = CAT_COLORS[category] || CAT_COLORS.Other;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <Tag size={9} /> {category}
    </span>
  );
}

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

export default function ApiVault() {
  const [keys, setKeys] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'OpenAI', category: '', key_value: '' });
  const [adding, setAdding] = useState(false);
  const [vaultState, setVaultState] = useState('locked');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const lockTimerRef = useRef(null);

  useEffect(() => {
    getProfile().then(p => {
      setProfile(p);
      if (!p.notification_email) setVaultState('no_email');
      else setVaultState('locked');
    }).catch(() => setVaultState('locked'));
  }, []);

  const loadVaultData = async () => {
    try {
      const [k, s] = await Promise.all([getApiKeys(), getApiKeySummary()]);
      setKeys(k); setSummary(s);
    } catch {} finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    setSending(true); setOtpError('');
    try {
      await requestVaultOtp();
      setVaultState('otp_sent'); setOtpCode('');
      toast.success('OTP sent to your verified email');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to send OTP';
      if (msg.includes('verified email')) setVaultState('no_email');
      else toast.error(msg);
    } finally { setSending(false); }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return;
    setVerifying(true); setOtpError('');
    try {
      await verifyVaultOtp(otpCode);
      setVaultState('unlocked'); setOtpCode('');
      loadVaultData();
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        setVaultState('locked'); setKeys([]); setSummary(null);
        toast.info('Vault locked after 15 minutes');
      }, VAULT_LOCK_MS);
      toast.success('Vault unlocked');
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'Invalid or expired OTP');
    } finally { setVerifying(false); }
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key?')) return;
    await deleteApiKey(id); loadVaultData(); toast.success('Key deleted');
  };

  const handleCheck = async (id) => {
    try { await checkApiKey(id); loadVaultData(); toast.success('Key re-validated'); }
    catch { toast.error('Validation failed'); }
  };

  const handleCheckAll = async () => {
    await Promise.all(keys.map(k => checkApiKey(k.id).catch(() => null)));
    loadVaultData(); toast.success('All keys refreshed');
  };

  if (vaultState === 'no_email') return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">API Vault</h1><p className="page-subtitle">Securely monitor and validate your AI API keys</p></div></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="vault-lock-screen">
        <div className="vault-lock-icon" style={{ background: 'var(--accent-amber-glow)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Mail size={32} color="var(--accent-amber)" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Email Verification Required</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 420, textAlign: 'center', lineHeight: 1.7 }}>
          You must verify an email address before you can access the API Vault.
        </p>
        <a href="/settings" className="btn btn-primary" style={{ marginTop: 8 }}><Mail size={15} /> Verify Email in Settings</a>
      </motion.div>
    </div>
  );

  if (vaultState === 'locked' || vaultState === 'sending') {
    const maskedEmail = profile?.notification_email
      ? profile.notification_email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length))
      : 'your verified email';
    return (
      <div className="page-container">
        <div className="page-header"><div><h1 className="page-title">API Vault</h1><p className="page-subtitle">Securely monitor and validate your AI API keys</p></div></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="vault-lock-screen">
          <div className="vault-lock-icon"><Lock size={32} color="var(--accent-indigo)" /></div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>API Vault is Protected</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 420, textAlign: 'center', lineHeight: 1.7 }}>
            For your security, access requires email verification. We'll send a one-time code to <strong style={{ color: 'var(--text-secondary)' }}>{maskedEmail}</strong>.
          </p>
          <button className="btn btn-primary" onClick={handleSendOtp} disabled={sending} style={{ marginTop: 8 }}>
            {sending ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Shield size={16} /> Send OTP to Unlock</>}
          </button>
          <div className="vault-lock-info"><ShieldOff size={13} style={{ opacity: 0.5 }} /><span>Vault auto-locks after 15 minutes</span></div>
        </motion.div>
      </div>
    );
  }

  if (vaultState === 'otp_sent') return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">API Vault</h1><p className="page-subtitle">Enter the code sent to your email</p></div></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="vault-lock-screen">
        <div className="vault-lock-icon" style={{ background: 'var(--accent-emerald-glow)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Mail size={32} color="var(--accent-emerald)" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Enter Your Code</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28, textAlign: 'center' }}>
          A 6-digit code was sent to your verified email. Expires in{' '}
          <Countdown seconds={600} onExpire={() => { setVaultState('locked'); toast.error('OTP expired'); }} />
        </p>
        <OtpInput value={otpCode} onChange={setOtpCode} />
        {otpError && <p style={{ color: 'var(--accent-rose)', fontSize: 13, marginTop: 12 }}>{otpError}</p>}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => setVaultState('locked')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleVerifyOtp} disabled={verifying || otpCode.length < 6}>
            {verifying ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Shield size={15} /> Unlock Vault</>}
          </button>
        </div>
        <button onClick={handleSendOtp} style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', cursor: 'pointer', fontSize: 13, marginTop: 16 }}>Resend code</button>
      </motion.div>
    </div>
  );

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading API keys...</p></div></div>;

  // Category filter
  const categories = ['All', ...Array.from(new Set(keys.map(k => k.category).filter(Boolean)))];
  const filtered = filterCat === 'All' ? keys : keys.filter(k => k.category === filterCat);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">API Vault</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={13} color="var(--accent-emerald)" /> Vault unlocked · auto-locks in 15 min
          </p>
        </div>
        <div className="header-actions">
          {keys.length > 0 && <button className="btn btn-secondary" onClick={handleCheckAll}><RefreshCw size={14} /> Refresh All</button>}
          {profile?.notification_email
            ? <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Key</button>
            : <button className="btn btn-secondary" disabled title="Verify email first"><Plus size={16} /> Add Key</button>}
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
          {keys.length === 0 && (profile?.notification_email
            ? <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add Your First Key</button>
            : <a href="/settings" className="btn btn-secondary">Verify Email First</a>
          )}
        </div>
      ) : (
        <div className="grid grid-3">
          <AnimatePresence>
            {filtered.map(key => (
              <motion.div key={key.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{key.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key.provider}</div>
                      <CategoryBadge category={key.category} />
                    </div>
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
                  <label className="form-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {KEY_CATEGORIES.map(cat => {
                      const c = CAT_COLORS[cat] || CAT_COLORS.Other;
                      const active = form.category === cat;
                      return (
                        <button key={cat} type="button" onClick={() => setForm({...form, category: active ? '' : cat})}
                          style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${active ? c.border : 'var(--border)'}`, background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text-muted)' }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
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
