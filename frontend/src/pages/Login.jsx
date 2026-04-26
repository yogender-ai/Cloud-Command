import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Globe, KeyRound, Server, Zap, Shield } from 'lucide-react';
import { loginRequest, ensureBackendAwake } from '../api';
import { setToken } from '../auth';

const features = [
  { icon: Globe, label: 'Site Monitor', desc: 'Real-time uptime & latency tracking with SSL inspection' },
  { icon: KeyRound, label: 'API Vault', desc: 'OTP-protected key management with live token tracking' },
  { icon: Server, label: 'Render & Vercel', desc: 'Full deployment control & service management' },
  { icon: Zap, label: 'API Gateway', desc: 'Centralized AI proxy with load balancing' },
];

const CODE_LINES = [
  'kubectl apply -f deployment.yaml',
  'docker-compose up --build -d',
  'git push origin main --force-with-lease',
  'npm run deploy -- --production',
  'curl -X POST /api/gateway/gemini',
  'SELECT * FROM api_usage_logs',
  'render deploy --service cloud-cmd',
  'vercel --prod --force',
  'openssl s_client -connect :443',
  'ping -c 4 api.openai.com',
  'ssh root@10.0.0.1 "systemctl restart"',
  'python -m uvicorn main:app --reload',
  'certbot renew --dry-run',
  'redis-cli MONITOR | head -50',
  'terraform plan -out=tfplan',
  'helm upgrade --install cloud-cmd .',
  'aws s3 sync ./dist s3://bucket',
  'gcloud run deploy --region us-central1',
  'GATEWAY_SECRET=*** uvicorn main:app',
  'tail -f /var/log/nginx/access.log',
  'psql -U admin -d cloudcommand -c "\\dt"',
  'export RENDER_API_TOKEN=rnd_***',
  'pytest tests/ -v --cov=routers',
  'docker logs cloud-cmd-api --tail 100',
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Generate code rain lines with random positions
  const codeRainLines = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      text: CODE_LINES[i % CODE_LINES.length],
      x: `${5 + Math.random() * 88}%`,
      speed: `${14 + Math.random() * 18}s`,
      delay: `${-Math.random() * 20}s`,
    }));
  }, []);

  // Pre-wake the backend while user types credentials
  useEffect(() => { ensureBackendAwake(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await ensureBackendAwake();
      const data = await loginRequest(email, password);
      setToken(data.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed — backend may still be waking up. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-left-glow" />

        {/* Code Rain Animation */}
        <div className="auth-code-rain">
          {codeRainLines.map((line, i) => (
            <div
              key={i}
              className="auth-code-line"
              style={{
                '--x': line.x,
                '--speed': line.speed,
                '--delay': line.delay,
                top: 0,
              }}
            >
              {line.text}
            </div>
          ))}
        </div>

        <div className="auth-left-content">
          <div className="auth-left-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <text x="2" y="21" fontSize="20" fontWeight="900" fontFamily="monospace" fill="#fff">&gt;_</text>
            </svg>
          </div>
          <h1 className="auth-left-title">Cloud Command</h1>
          <p className="auth-left-sub">Your unified DevOps command center. Monitor, manage, and deploy — all in one place.</p>
          <div className="auth-features">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="auth-feature-label">{label}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-blob auth-blob-1" />
          <div className="auth-blob auth-blob-2" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-card animate-fade-in">
          <div className="auth-form-logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <text x="1" y="15" fontSize="14" fontWeight="900" fontFamily="monospace" fill="#fff">&gt;_</text>
            </svg>
          </div>
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to your command center</p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="form-input" placeholder="you@example.com" style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input" placeholder="••••••••"
                  style={{ paddingLeft: 40, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'inherit' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Shield size={12} /> Enterprise-grade Argon2id security
          </p>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
