import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Bell, LogOut, Shield, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { removeToken } from '../auth';
import { requestOtp, verifyOtp } from '../api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [notifEmail, setNotifEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtp(notifEmail);
      toast.success(`OTP sent to ${notifEmail}`);
      setOtpStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(notifEmail, otp);
      toast.success('Notification email updated!');
      setOtpStep(1);
      setNotifEmail('');
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP');
    } finally { setLoading(false); }
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
        {/* Notification Email */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color="var(--accent-purple)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Notification Email</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Receive alerts when monitors go down or up</p>
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
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--accent-emerald)' }}>OTP sent to {notifEmail}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" required maxLength={6} className="form-input form-input-mono"
                  placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '0.3em', maxWidth: 180 }}
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '...' : 'Verify'}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Security */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-emerald-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="var(--accent-emerald)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Security</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your passwords are hashed with Argon2id. API keys are encrypted with AES.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-up">Argon2id Hashing</span>
            <span className="badge badge-up">Fernet AES Encryption</span>
            <span className="badge badge-up">JWT Auth</span>
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
