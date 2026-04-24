import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, LogOut, Shield, Mail, Lock, Eye, EyeOff,
  Calendar, Key, CheckCircle2, Zap, AlertTriangle, ArrowRight,
  Server, Copy, Check, Trash2, X, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { removeToken } from '../auth';
import { requestOtp, verifyOtp, getProfile, changePassword, getGatewayKeys, createGatewayKey, deleteGatewayKey } from '../api';

// Password strength calculator
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--border)' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: 'Too short', color: '#f43f5e' },
    { label: 'Weak', color: '#f43f5e' },
    { label: 'Fair', color: '#f59e0b' },
    { label: 'Good', color: '#10b981' },
    { label: 'Strong', color: '#10b981' },
    { label: 'Very Strong', color: '#06b6d4' },
  ];
  return { score, ...map[Math.min(score, 5)] };
}

function SectionHeader({ icon: Icon, iconBg, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{title}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  
  // Notification & Security
  const [notifEmail, setNotifEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [notifLoading, setNotifLoading] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  
  // Gateway Keys
  const [gatewayKeys, setGatewayKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { 
    getProfile().then(setProfile).catch(() => {}); 
    loadGatewayKeys();
  }, []);

  const loadGatewayKeys = async () => {
    try {
      const keys = await getGatewayKeys();
      setGatewayKeys(keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault(); setNotifLoading(true);
    try { await requestOtp(notifEmail); toast.success(`OTP sent to ${notifEmail}`); setOtpStep(2); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to send OTP'); }
    finally { setNotifLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setNotifLoading(true);
    try {
      await verifyOtp(notifEmail, otp);
      toast.success('Notification email verified!'); setOtpStep(1); setNotifEmail(''); setOtp('');
      getProfile().then(setProfile).catch(() => {});
    }
    catch (err) { toast.error(err.response?.data?.detail || 'Invalid OTP'); }
    finally { setNotifLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPassLoading(true);
    try { await changePassword(currentPass, newPass); toast.success('Password updated!'); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password'); }
    finally { setPassLoading(false); }
  };
  
  const handleCreateGatewayKey = async (e) => {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const res = await createGatewayKey({ name: newKeyName });
      setRevealedKey(res.key_value);
      setNewKeyName('');
      setShowCreateKey(false);
      loadGatewayKeys();
    } catch (err) {
      toast.error('Failed to create Gateway API Key');
    } finally {
      setCreatingKey(false);
    }
  };
  
  const handleDeleteGatewayKey = async (id) => {
    if (!confirm('Are you sure? Any external apps using this key will immediately fail.')) return;
    try {
      await deleteGatewayKey(id);
      toast.success('Gateway API Key revoked');
      loadGatewayKeys();
    } catch (err) {
      toast.error('Failed to revoke key');
    }
  };
  
  const handleCopyKey = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      toast.success("Gateway API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const strength = getStrength(newPass);
  const initials = profile?.email ? profile.email.slice(0, 2).toUpperCase() : '??';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile, notifications, and security</p>
        </div>
      </div>

      <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left Column — Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="card" style={{ padding: 28, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Glow bg */}
            <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            {/* Avatar ring */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 80, height: 80, borderRadius: '50%', marginBottom: 16,
              background: 'conic-gradient(from 0deg, #6366f1, #a855f7, #06b6d4, #6366f1)',
              padding: 3 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 900, color: 'var(--accent-indigo)', letterSpacing: '-0.02em' }}>
                {initials}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {profile?.email?.split('@')[0] || '...'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {profile?.email || 'Loading...'}
            </div>
            {profile?.notification_email && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99,
                background: 'var(--accent-emerald-glow)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>
                <CheckCircle2 size={12} /> Alerts Active
              </div>
            )}
          </motion.div>

          {/* Account metadata */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-muted)', marginBottom: 14 }}>Account Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={14} color="var(--text-muted)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Login Email</div>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email || '...'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Calendar size={14} color="var(--text-muted)" />
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member Since</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
                  </div>
                </div>
              </div>
              {profile?.notification_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={14} color="var(--accent-emerald)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alert Email</div>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent-emerald)' }}>
                      {profile.notification_email}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Security badges */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Shield size={15} color="var(--accent-emerald)" />
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Security</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Argon2id Hashing', 'Fernet AES Encryption', 'JWT Auth', 'HTTPS Only', 'Email OTP Gate'].map(badge => (
                <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'var(--accent-emerald-glow)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                  <CheckCircle2 size={12} color="var(--accent-emerald)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-emerald)' }}>{badge}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Logout */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="card" style={{ padding: 20, borderColor: 'rgba(244,63,94,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-rose)', marginBottom: 12 }}>Danger Zone</div>
            <button className="btn btn-danger" onClick={() => { removeToken(); navigate('/login', { replace: true }); }} style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={14} /> Sign Out
            </button>
          </motion.div>
        </div>

        {/* Right Column — Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Gateway API Keys (Cloud Command Keys) */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <SectionHeader icon={Server} iconBg="var(--accent-indigo-glow)" title="Gateway API Keys" subtitle="Create tokens to securely route your external apps through Cloud Command" />
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateKey(true)}>
                <Plus size={14} /> New Key
              </button>
            </div>
            
            {loadingKeys ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
            ) : gatewayKeys.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No Gateway API keys generated yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gatewayKeys.map(gk => (
                  <div key={gk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{gk.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{gk.prefix}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Created: {new Date(gk.created_at).toLocaleDateString()}
                        {gk.last_used_at && ` • Last used: ${new Date(gk.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteGatewayKey(gk.id)} title="Revoke Key">
                      <Trash2 size={16} color="var(--accent-rose)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Notification Email */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card" style={{ padding: 28 }}>
            <SectionHeader icon={Bell} iconBg="var(--accent-purple-glow)" title="Notification Email" subtitle="Receive downtime alerts and API Vault OTPs" />
            {!profile?.notification_email && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 18, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                <AlertTriangle size={15} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--accent-amber)', lineHeight: 1.5 }}>
                  You need a verified email to receive alerts and unlock the API Vault.
                </p>
              </div>
            )}
            {otpStep === 1 ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input type="email" required className="form-input" placeholder="alerts@example.com"
                    value={notifEmail} onChange={e => setNotifEmail(e.target.value)} style={{ paddingLeft: 38 }} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={notifLoading} style={{ whiteSpace: 'nowrap' }}>
                  {notifLoading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><ArrowRight size={14} /> Send Code</>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--accent-emerald-glow)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle2 size={14} color="var(--accent-emerald)" />
                  <span style={{ fontSize: 13, color: 'var(--accent-emerald)', fontWeight: 600 }}>Code sent to {notifEmail}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" required maxLength={6} className="form-input form-input-mono"
                    placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)}
                    style={{ textAlign: 'center', letterSpacing: '0.3em', maxWidth: 160, fontSize: 18 }} />
                  <button type="submit" className="btn btn-primary" disabled={notifLoading}>
                    {notifLoading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Verify'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setOtpStep(1)}>Back</button>
                </div>
              </form>
            )}
          </motion.div>

          {/* Change Password */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 28 }}>
            <SectionHeader icon={Key} iconBg="var(--accent-amber-glow)" title="Change Password" subtitle="Use a strong password you don't use elsewhere" />
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Current Password */}
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input type={showCurrent ? 'text' : 'password'} required className="form-input"
                    placeholder="Your current password" value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                    style={{ paddingLeft: 38, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input type={showNew ? 'text' : 'password'} required minLength={8} className="form-input"
                    placeholder="At least 8 characters" value={newPass} onChange={e => setNewPass(e.target.value)}
                    style={{ paddingLeft: 38, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPass && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength.score ? strength.color : 'var(--border)', transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</div>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" required minLength={8} className="form-input"
                  placeholder="Repeat new password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  style={{ borderColor: confirmPass && newPass && confirmPass !== newPass ? 'var(--accent-rose)' : '' }} />
                {confirmPass && newPass && confirmPass !== newPass && (
                  <p style={{ fontSize: 12, color: 'var(--accent-rose)', marginTop: 4 }}>Passwords don't match</p>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={passLoading}>
                {passLoading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Zap size={14} /> Update Password</>}
              </button>
            </form>
          </motion.div>

        </div>
      </div>
      
      {/* Create Gateway Key Modal */}
      <AnimatePresence>
        {showCreateKey && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateKey(false)}>
            <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Gateway API Key</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateKey(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateGatewayKey} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Key Name</label>
                  <input required className="form-input" placeholder="e.g. News-Intel Backend" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Use this key in external applications to securely route requests through your Cloud Command vault.</p>
                </div>
                <button type="submit" className="btn btn-primary" disabled={creatingKey} style={{ marginTop: 8 }}>
                  {creatingKey ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Generate Key'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Reveal Gateway Key Modal (One-Time) */}
      <AnimatePresence>
        {revealedKey && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRevealedKey(null)}>
            <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Shield size={20} color="var(--accent-emerald)" /> Key Generated Successfully
                </h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setRevealedKey(null)}><X size={18} /></button>
              </div>
              
              <div style={{ textAlign: 'center', marginBottom: 24, padding: '16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12 }}>
                <AlertTriangle size={24} color="var(--accent-rose)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--accent-rose)', fontSize: 14, fontWeight: 600 }}>
                  Please copy this key now.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  For security reasons, Cloud Command does not store this key in plain text. You will not be able to see it again after closing this window.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ 
                  flex: 1, background: 'var(--bg-input)', padding: '16px 20px', borderRadius: 12, 
                  fontFamily: 'var(--font-mono)', fontSize: 15, wordBreak: 'break-all', 
                  border: '1px solid var(--accent-emerald)', color: 'var(--text-primary)',
                  boxShadow: '0 0 20px rgba(16,185,129,0.15)'
                }}>
                  {revealedKey}
                </div>
                <button className="btn btn-primary btn-icon" style={{ width: 54, height: 54, flexShrink: 0 }} onClick={handleCopyKey} title="Copy Key">
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: 24 }} onClick={() => setRevealedKey(null)}>
                I have copied the key
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
