import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Bell, LogOut, Shield, Mail, Lock, Eye, EyeOff, Calendar, Key } from 'lucide-react';
import { toast } from 'sonner';
import { removeToken } from '../auth';
import { requestOtp, verifyOtp, getProfile, changePassword } from '../api';

export default function SettingsPage() {
  const navigate = useNavigate();

  // Profile
  const [profile, setProfile] = useState(null);

  // Notification email
  const [notifEmail, setNotifEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [notifLoading, setNotifLoading] = useState(false);

  // Change Password
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setNotifLoading(true);
    try {
      await requestOtp(notifEmail);
      toast.success(`OTP sent to ${notifEmail}`);
      setOtpStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally { setNotifLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setNotifLoading(true);
    try {
      await verifyOtp(notifEmail, otp);
      toast.success('Notification email updated!');
      setOtpStep(1);
      setNotifEmail('');
      setOtp('');
      getProfile().then(setProfile).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP');
    } finally { setNotifLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPass.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPassLoading(true);
    try {
      await changePassword(currentPass, newPass);
      toast.success('Password changed successfully');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally { setPassLoading(false); }
  };

  const handleLogout = () => {
    removeToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile, notifications, and security</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-indigo-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} color="var(--accent-indigo)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Your Profile</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account information</p>
            </div>
          </div>

          {profile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <Mail size={15} color="var(--text-muted)" />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{profile.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <Calendar size={15} color="var(--text-muted)" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member Since</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
                {profile.notification_email && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--accent-emerald-glow)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <Bell size={15} color="var(--accent-emerald)" />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--accent-emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alerts Email</div>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{profile.notification_email}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ height: 54, flex: 1, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', animation: 'pulse-dot 1.5s ease infinite' }} />
              <div style={{ height: 54, flex: 1, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', animation: 'pulse-dot 1.5s ease infinite' }} />
            </div>
          )}
        </motion.div>

        {/* Notification Email */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color="var(--accent-purple)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Notification Email</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Receive alerts when monitors go down or recover</p>
            </div>
          </div>

          {otpStep === 1 ? (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email" required className="form-input" placeholder="alerts@example.com"
                  value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={notifLoading}>
                {notifLoading ? '...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--accent-emerald)' }}>✔ OTP sent to {notifEmail}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" required maxLength={6} className="form-input form-input-mono"
                  placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '0.3em', maxWidth: 180 }}
                />
                <button type="submit" className="btn btn-primary" disabled={notifLoading}>
                  {notifLoading ? '...' : 'Verify'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setOtpStep(1)}>Back</button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Change Password */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-amber-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={20} color="var(--accent-amber)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Change Password</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Update your login credentials</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showCurrent ? 'text' : 'password'} required className="form-input"
                  placeholder="Your current password" value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showNew ? 'text' : 'password'} required minLength={8} className="form-input"
                  placeholder="At least 8 characters" value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password" required minLength={8} className="form-input"
                placeholder="Repeat new password" value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                style={{ borderColor: confirmPass && newPass && confirmPass !== newPass ? 'var(--accent-rose)' : '' }}
              />
              {confirmPass && newPass && confirmPass !== newPass && (
                <p style={{ fontSize: 12, color: 'var(--accent-rose)', marginTop: 4 }}>Passwords don't match</p>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={passLoading} style={{ marginTop: 4 }}>
              {passLoading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Update Password'}
            </button>
          </form>
        </motion.div>

        {/* Security Info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-emerald-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="var(--accent-emerald)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Security</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>How we protect your data</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-up">Argon2id Hashing</span>
            <span className="badge badge-up">Fernet AES Encryption</span>
            <span className="badge badge-up">JWT Auth</span>
            <span className="badge badge-up">HTTPS Only</span>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card" style={{ padding: 28, borderColor: 'rgba(244,63,94,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-rose-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={20} color="var(--accent-rose)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Danger Zone</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign out of your current session</p>
            </div>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </motion.div>

      </div>
    </div>
  );
}
