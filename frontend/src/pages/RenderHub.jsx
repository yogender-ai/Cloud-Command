import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Server, Rocket, Pause, Play, RefreshCw, ExternalLink,
  GitBranch, X, Trash2, Variable, ShieldOff, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getRenderAccounts, connectRenderAccount, disconnectRenderAccount, updateRenderAccount,
  getRenderServices, getRenderDeploys, triggerRenderDeploy,
  suspendRenderService, resumeRenderService, getRenderEnvVars
} from '../api';
import { CategoryBadge, CategoryEditor } from '../components/CategoryEditor';

export default function RenderHub() {
  const [accounts, setAccounts] = useState([]);
  const [activeAcct, setActiveAcct] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ account_name: '', api_token: '', category: '' });
  const [filterCat, setFilterCat] = useState('All');
  const [connecting, setConnecting] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [deploys, setDeploys] = useState([]);
  const [envVars, setEnvVars] = useState([]);
  const [showEnv, setShowEnv] = useState(false);

  const loadAccounts = async () => {
    try {
      const accts = await getRenderAccounts();
      setAccounts(accts);
      if (accts.length > 0 && !activeAcct) setActiveAcct(accts[0]);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (activeAcct) {
      getRenderServices(activeAcct.id).then(data => {
        setServices(Array.isArray(data) ? data : data?.map?.(d => d.service || d) || []);
      }).catch(() => setServices([]));
    }
  }, [activeAcct]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const acct = await connectRenderAccount(connectForm);
      setShowConnect(false);
    setConnectForm({ account_name: '', api_token: '', category: '' });
      await loadAccounts();
      setActiveAcct(acct);
      toast.success('Render account connected');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to connect');
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async (id) => {
    if (!confirm('Disconnect this Render account?')) return;
    await disconnectRenderAccount(id);
    if (activeAcct?.id === id) setActiveAcct(null);
    loadAccounts();
    toast.success('Account disconnected');
  };

  const handleCategoryChange = async (id, cat) => {
    try {
      const updated = await updateRenderAccount(id, cat ? { category: cat } : { clear_category: true });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, category: updated.category } : a));
      if (activeAcct?.id === id) setActiveAcct({ ...activeAcct, category: updated.category });
      toast.success(cat ? `Tagged as "${cat}"` : 'Category cleared');
    } catch { toast.error('Failed to update category'); }
  };

  const allCategories = [...new Set(accounts.map(a => a.category).filter(Boolean))];
  const visibleServices = filterCat === 'All'
    ? services
    : services.filter(s => (s.service || s).category === filterCat || activeAcct?.category === filterCat);

  const deployCommit = (dep) => {
    const commit = dep.commit || dep.gitCommit || dep.commitInfo || {};
    return commit.id || commit.sha || dep.commitId || dep.gitCommitId || dep.commit?.hash || '';
  };

  const deployMessage = (dep) => {
    const commit = dep.commit || dep.gitCommit || dep.commitInfo || {};
    return commit.message || dep.commitMessage || dep.gitCommitMessage || '';
  };

  const openServiceDetail = async (svc) => {
    const svcData = svc.service || svc;
    setSelectedService(svcData);
    try {
      const d = await getRenderDeploys(activeAcct.id, svcData.id);
      const list = Array.isArray(d) ? d : d?.map?.(x => x.deploy || x) || [];
      setDeploys(list);
      const failed = list.find(dep => (dep.deploy || dep).status === 'build_failed');
      if (failed) toast.error(`${svcData.name} has a failed deploy. Open details for logs.`);
    } catch { setDeploys([]); }
  };

  const loadEnvVars = async (serviceId) => {
    try {
      const ev = await getRenderEnvVars(activeAcct.id, serviceId);
      setEnvVars(Array.isArray(ev) ? ev : ev?.map?.(x => x.envVar || x) || []);
      setShowEnv(true);
    } catch { toast.error('Failed to load env vars'); }
  };

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading Render...</p></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={28} color="#34d399" /> Render Hub
          </h1>
          <p className="page-subtitle">Manage your Render services, deploys, and environment</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowConnect(true)}><Plus size={16} /> Connect Account</button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--accent-emerald-glow)' }}><Server size={28} color="var(--accent-emerald)" /></div>
          <h3>No Render Accounts Connected</h3>
          <p>Connect your Render account to manage services, view deploys, and control your infrastructure.</p>
          <button className="btn btn-primary" onClick={() => setShowConnect(true)}>Connect Render Account</button>
        </div>
      ) : (
        <>
          {/* Category Filter */}
          {allCategories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={14} color="var(--text-muted)" />
              {['All', ...allCategories].map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid', transition: 'all 0.15s',
                  background: filterCat === cat ? 'var(--accent-indigo-glow)' : 'transparent',
                  borderColor: filterCat === cat ? 'rgba(99,102,241,0.4)' : 'var(--border)',
                  color: filterCat === cat ? 'var(--accent-indigo)' : 'var(--text-muted)',
                }}>{cat}</button>
              ))}
            </div>
          )}
          {/* Account Tabs */}
          <div className="account-tabs">
            {accounts.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className={`account-tab ${activeAcct?.id === a.id ? 'active' : ''}`} onClick={() => setActiveAcct(a)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '8px 14px', gap: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Server size={14} /> {a.account_name}</span>
                  <div onClick={e => e.stopPropagation()}>
                    <CategoryEditor category={a.category} suggestions={allCategories.filter(c => c !== a.category)} onSave={cat => handleCategoryChange(a.id, cat)} />
                  </div>
                </button>
                <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleDisconnect(a.id)}>
                  <Trash2 size={12} color="var(--accent-rose)" />
                </button>
              </div>
            ))}
            {accounts.length < 10 && (
              <button className="account-tab" onClick={() => setShowConnect(true)}><Plus size={14} /> Add</button>
            )}
          </div>

          {/* Services Grid */}
          {services.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No services found for this account</div>
          ) : (
            <div className="grid grid-3">
              {visibleServices.map((s, i) => {
                const svc = s.service || s;
                const isLive = svc.suspended !== 'suspended';
                return (
                  <motion.div key={svc.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="card card-interactive service-card" onClick={() => openServiceDetail(s)}>
                    <div className="service-card-header">
                      <div>
                        <div className="service-name">{svc.name}</div>
                        <div className="service-meta">
                          <span>{svc.type || 'web_service'}</span>
                          {svc.repo && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><GitBranch size={10} /> {svc.repo?.split('/')?.pop()}</span>}
                        </div>
                      </div>
                      <span className={`badge ${isLive ? 'badge-up badge-live' : 'badge-warning'}`}>{isLive ? 'Live' : 'Suspended'}</span>
                    </div>
                    {svc.serviceDetails?.url && (
                      <div className="service-url">{svc.serviceDetails.url}</div>
                    )}
                    <div className="service-actions">
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); triggerRenderDeploy(activeAcct.id, svc.id).then(() => toast.success('Deploy triggered')).catch((err) => toast.error(err.response?.data?.detail || 'Deploy failed')); }}>
                        <Rocket size={12} /> Deploy
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => {
                        e.stopPropagation();
                        if (isLive) suspendRenderService(activeAcct.id, svc.id).then(() => { toast.success('Suspended'); }).catch(() => toast.error('Failed'));
                        else resumeRenderService(activeAcct.id, svc.id).then(() => { toast.success('Resumed'); }).catch(() => toast.error('Failed'));
                      }}>
                        {isLive ? <><Pause size={12} /> Suspend</> : <><Play size={12} /> Resume</>}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); loadEnvVars(svc.id); }}>
                        <Variable size={12} /> Env
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedService(null)}>
            <motion.div className="modal-panel modal-panel-lg" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">{selectedService.name}</h2>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span className="badge badge-neutral">{selectedService.type || 'web_service'}</span>
                    {selectedService.serviceDetails?.url && (
                      <a href={selectedService.serviceDetails.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={12} /> {selectedService.serviceDetails.url}
                      </a>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedService(null)}><X size={18} /></button>
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent Deploys</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Deploy ID</th><th>Status</th><th>Commit</th><th>Created</th><th>Logs</th></tr></thead>
                  <tbody>
                    {deploys.slice(0, 15).map((d, i) => {
                      const dep = d.deploy || d;
                      const commit = deployCommit(dep);
                      const message = deployMessage(dep);
                      const logUrl = dep.logsUrl || dep.logUrl || dep.deployLogUrl || dep.dashboardUrl;
                      return (
                        <tr key={dep.id || i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(dep.id || '').slice(0, 12)}...</td>
                          <td><span className={`badge ${dep.status === 'live' ? 'badge-up' : dep.status === 'build_failed' ? 'badge-down' : 'badge-neutral'}`}>{dep.status}</span></td>
                          <td style={{ fontSize: 12, maxWidth: 260 }}>
                            {commit ? <span style={{ fontFamily: 'var(--font-mono)' }}>{commit.slice(0, 7)}</span> : '-'}
                            {message && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{message.slice(0, 48)}</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>{dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '-'}</td>
                          <td style={{ fontSize: 12 }}>
                            {logUrl ? <a href={logUrl} target="_blank" rel="noreferrer">Open logs</a> : dep.status === 'build_failed' ? 'Check Render logs' : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {deploys.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No deploys found</td></tr>}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Env Vars Modal */}
      <AnimatePresence>
        {showEnv && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEnv(false)}>
            <motion.div className="modal-panel modal-panel-lg" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Environment Variables</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldOff size={12} /> Values are hidden for security — you can only view names
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowEnv(false)}><X size={18} /></button>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Variable Name</th></tr></thead>
                  <tbody>
                    {envVars.map((ev, i) => {
                      const envVar = ev.envVar || ev;
                      return (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-indigo)' }}>{envVar.key}</td>
                        </tr>
                      );
                    })}
                    {envVars.length === 0 && <tr><td style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No env vars found</td></tr>}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connect Modal */}
      <AnimatePresence>
        {showConnect && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConnect(false)}>
            <motion.div className="modal-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Connect Render Account</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowConnect(false)}><X size={18} /></button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                Get your API key from <a href="https://dashboard.render.com/u/settings#api-keys" target="_blank" rel="noreferrer">Render Settings → API Keys</a>
              </p>
              <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Account Label</label>
                  <input required className="form-input" placeholder="My Render Account" value={connectForm.account_name} onChange={e => setConnectForm({...connectForm, account_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" placeholder="e.g. News-Intel" value={connectForm.category} onChange={e => setConnectForm({...connectForm, category: e.target.value})} list="render-categories" />
                  <datalist id="render-categories">
                    {allCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input required type="password" className="form-input form-input-mono" placeholder="rnd_..." value={connectForm.api_token} onChange={e => setConnectForm({...connectForm, api_token: e.target.value})} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={connecting} style={{ marginTop: 8 }}>
                  {connecting ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Connect & Verify'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
