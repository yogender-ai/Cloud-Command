import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Triangle, Rocket, ExternalLink, GitBranch, X, Trash2,
  Variable, Globe, CheckCircle2, ShieldOff, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getVercelAccounts, connectVercelAccount, disconnectVercelAccount, updateVercelAccount,
  getVercelProjects, getVercelDeployments, getVercelDeploymentEvents, redeployVercelProject, getVercelEnvVars
} from '../api';
import { CategoryBadge, CategoryEditor } from '../components/CategoryEditor';

export default function VercelHub() {
  const [accounts, setAccounts] = useState([]);
  const [activeAcct, setActiveAcct] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ account_name: '', api_token: '', category: '' });
  const [filterCat, setFilterCat] = useState('All');
  const [connecting, setConnecting] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [deploymentEvents, setDeploymentEvents] = useState({});
  const [envVars, setEnvVars] = useState([]);
  const [showEnv, setShowEnv] = useState(false);

  const loadAccounts = async () => {
    try {
      const accts = await getVercelAccounts();
      setAccounts(accts);
      if (accts.length > 0 && !activeAcct) setActiveAcct(accts[0]);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (activeAcct) {
      getVercelProjects(activeAcct.id).then(data => {
        setProjects(data?.projects || data || []);
      }).catch(() => setProjects([]));
    }
  }, [activeAcct]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const acct = await connectVercelAccount(connectForm);
      setShowConnect(false);
      setConnectForm({ account_name: '', api_token: '', category: '' });
      await loadAccounts();
      setActiveAcct(acct);
      toast.success('Vercel account connected');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to connect');
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async (id) => {
    if (!confirm('Disconnect this Vercel account?')) return;
    await disconnectVercelAccount(id);
    if (activeAcct?.id === id) setActiveAcct(null);
    loadAccounts();
    toast.success('Account disconnected');
  };

  const handleCategoryChange = async (id, cat) => {
    try {
      const updated = await updateVercelAccount(id, cat ? { category: cat } : { clear_category: true });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, category: updated.category } : a));
      if (activeAcct?.id === id) setActiveAcct({ ...activeAcct, category: updated.category });
      toast.success(cat ? `Tagged as "${cat}"` : 'Category cleared');
    } catch { toast.error('Failed to update category'); }
  };

  const allCategories = [...new Set(accounts.map(a => a.category).filter(Boolean))];
  const visibleProjects = filterCat === 'All'
    ? projects
    : projects.filter(p => p.category === filterCat || activeAcct?.category === filterCat);

  const openProjectDetail = async (proj) => {
    setSelectedProject(proj);
    setDeploymentEvents({});
    try {
      const data = await getVercelDeployments(activeAcct.id, proj.id);
      const list = data?.deployments || data || [];
      setDeployments(list);
      const failed = list.find(d => (d.state || d.readyState) === 'ERROR');
      if (failed?.uid) {
        toast.error(`${proj.name} has a failed deployment. Logs are loading.`);
        loadDeploymentEvents(failed.uid);
      }
    } catch { setDeployments([]); }
  };

  const loadDeploymentEvents = async (deploymentId) => {
    try {
      const data = await getVercelDeploymentEvents(activeAcct.id, deploymentId);
      setDeploymentEvents(prev => ({ ...prev, [deploymentId]: data?.events || data || [] }));
    } catch {
      toast.error('Failed to load deployment logs');
    }
  };

  const loadEnvVars = async (projectId) => {
    try {
      const data = await getVercelEnvVars(activeAcct.id, projectId);
      setEnvVars(data?.envs || data || []);
      setShowEnv(true);
    } catch { toast.error('Failed to load env vars'); }
  };

  const getDeployStatus = (state) => {
    if (state === 'READY') return 'badge-up';
    if (state === 'ERROR') return 'badge-down';
    if (state === 'BUILDING' || state === 'QUEUED') return 'badge-warning';
    return 'badge-neutral';
  };

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner" /><p>Loading Vercel...</p></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Triangle size={28} fill="var(--text-primary)" color="var(--text-primary)" /> Vercel Hub
          </h1>
          <p className="page-subtitle">Manage projects, deployments, and domains</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowConnect(true)}><Plus size={16} /> Connect Account</button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'rgba(255,255,255,0.05)' }}><Triangle size={28} fill="var(--text-primary)" color="var(--text-primary)" /></div>
          <h3>No Vercel Accounts Connected</h3>
          <p>Connect your Vercel account to manage projects, view deployments, and monitor builds.</p>
          <button className="btn btn-primary" onClick={() => setShowConnect(true)}>Connect Vercel Account</button>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Triangle size={12} fill="currentColor" /> {a.account_name}</span>
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

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No projects found for this account</div>
          ) : (
            <div className="grid grid-3">
              {visibleProjects.map((proj, i) => (
                <motion.div key={proj.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="card card-interactive service-card" onClick={() => openProjectDetail(proj)}>
                  <div className="service-card-header">
                    <div>
                      <div className="service-name">{proj.name}</div>
                      <div className="service-meta">
                        {proj.framework && <span>{proj.framework}</span>}
                        {proj.link?.repo && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><GitBranch size={10} /> {proj.link.repo.split('/').pop()}</span>}
                      </div>
                    </div>
                    <span className="badge badge-up badge-live"><CheckCircle2 size={10} /> Live</span>
                  </div>

                  {proj.targets?.production?.url && (
                    <a href={`https://${proj.targets.production.url}`} className="service-url" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                      <Globe size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      {proj.targets.production.url}
                    </a>
                  )}

                  <div className="service-actions">
                    <button className="btn btn-secondary btn-sm" onClick={(e) => {
                      e.stopPropagation();
                      redeployVercelProject(activeAcct.id, proj.id).then(() => toast.success('Redeployment triggered')).catch((err) => toast.error(err.response?.data?.detail || 'Redeploy failed'));
                    }}>
                      <Rocket size={12} /> Redeploy
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); loadEnvVars(proj.id); }}>
                      <Variable size={12} /> Env
                    </button>
                    {proj.targets?.production?.url && (
                      <a href={`https://${proj.targets.production.url}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={12} /> Visit
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Project Detail Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)}>
            <motion.div className="modal-panel modal-panel-lg" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">{selectedProject.name}</h2>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {selectedProject.framework && <span className="badge badge-neutral">{selectedProject.framework}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedProject(null)}><X size={18} /></button>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent Deployments</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>URL</th><th>State</th><th>Commit</th><th>Created</th><th>Logs</th></tr></thead>
                  <tbody>
                    {deployments.slice(0, 15).map((d, i) => {
                      const commitSha = d.meta?.githubCommitSha || d.meta?.githubCommitRef || '';
                      const events = deploymentEvents[d.uid] || [];
                      const lastError = events.find(e => e.type === 'stderr' || e.level === 'error' || e.payload?.text)?.payload?.text;
                      return (
                        <tr key={d.uid || i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {d.url ? <a href={`https://${d.url}`} target="_blank" rel="noreferrer">{d.url.slice(0, 40)}...</a> : '-'}
                          </td>
                          <td><span className={`badge ${getDeployStatus(d.state || d.readyState)}`}>{d.state || d.readyState || 'unknown'}</span></td>
                          <td style={{ fontSize: 12, maxWidth: 280 }}>
                            {commitSha ? <span style={{ fontFamily: 'var(--font-mono)' }}>{commitSha.slice(0, 7)}</span> : '-'}
                            {d.meta?.githubCommitMessage && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{d.meta.githubCommitMessage.slice(0, 52)}</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>{d.created ? new Date(d.created).toLocaleString() : '-'}</td>
                          <td style={{ fontSize: 12 }}>
                            {d.uid ? <button className="btn btn-secondary btn-sm" onClick={() => loadDeploymentEvents(d.uid)}>Logs</button> : '-'}
                            {lastError && <div style={{ color: 'var(--accent-rose)', marginTop: 6, maxWidth: 320 }}>{lastError.slice(0, 120)}</div>}
                          </td>
                        </tr>
                      );
                    })}
                    {deployments.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No deployments found</td></tr>}
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
                  <thead><tr><th>Variable Name</th><th>Environment</th></tr></thead>
                  <tbody>
                    {envVars.map((ev, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-indigo)' }}>{ev.key}</td>
                        <td style={{ fontSize: 12 }}>{(ev.target || []).join(', ')}</td>
                      </tr>
                    ))}
                    {envVars.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No env vars found</td></tr>}
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
                <h2 className="modal-title">Connect Vercel Account</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowConnect(false)}><X size={18} /></button>
              </div>

              {/* Token How-To Guide */}
              <div style={{ background: 'var(--accent-indigo-glow)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-indigo)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔑</span> How to get your Vercel Token
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', lineHeight: 2.2 }}>
                  <li>Go to <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)' }}>vercel.com/account/tokens</a></li>
                  <li>Click <strong style={{ color: 'var(--text-secondary)' }}>Create Token</strong></li>
                  <li>Give it a name (e.g. "Cloud Command") and set <strong style={{ color: 'var(--text-secondary)' }}>Full Account</strong> scope</li>
                  <li>Copy the token — <strong style={{ color: 'var(--accent-rose)' }}>it won't be shown again</strong></li>
                  <li>Paste it below</li>
                </ol>
              </div>

              <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Account Label</label>
                  <input required className="form-input" placeholder="My Vercel Account" value={connectForm.account_name} onChange={e => setConnectForm({...connectForm, account_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" placeholder="e.g. News-Intel" value={connectForm.category} onChange={e => setConnectForm({...connectForm, category: e.target.value})} list="vercel-categories" />
                  <datalist id="vercel-categories">
                    {allCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Vercel Token</label>
                  <input required type="password" className="form-input form-input-mono" placeholder="..." value={connectForm.api_token} onChange={e => setConnectForm({...connectForm, api_token: e.target.value})} />
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
