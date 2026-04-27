import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, KeyRound, Server, Triangle, Activity, Zap, Bell, Shield, Radio,
  TrendingUp, AlertTriangle, CheckCircle2, Sparkles, RefreshCw
} from 'lucide-react';
import {
  getMonitors, getApiKeySummary, getRenderAccounts,
  getVercelAccounts, recordVisit, getVisits, getMe, ensureBackendAwake
} from '../api';
import InfraPulseRing from '../components/dashboard/InfraPulseRing';
import WhatChanged from '../components/dashboard/WhatChanged';
import TopHighlights from '../components/dashboard/TopHighlights';
import LiveTrendChart from '../components/dashboard/LiveTrendChart';
import QuickGlance from '../components/dashboard/QuickGlance';
import DetailDrawer from '../components/dashboard/DetailDrawer';

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function greet(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${g}, ${name}` : g;
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [renderAccts, setRenderAccts] = useState([]);
  const [vercelAccts, setVercelAccts] = useState([]);
  const [visits, setVisits] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await ensureBackendAwake();
    recordVisit();
    const r = await Promise.allSettled([
      getMonitors(), getApiKeySummary(), getRenderAccounts(),
      getVercelAccounts(), getVisits(), getMe(),
    ]);
    const v = (i, fb) => r[i].status === 'fulfilled' ? r[i].value : fb;
    setMonitors(v(0, []));
    setApiSummary(v(1, null));
    setRenderAccts(v(2, []));
    setVercelAccts(v(3, []));
    const vis = v(4, []);
    setVisits([...vis].reverse().map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visits: d.visits,
    })));
    setUser(v(5, null));
    setLoadedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  // Derived live data
  const up = monitors.filter(m => m.status === 'UP').length;
  const down = monitors.length - up;
  const uptimePct = monitors.length > 0 ? Math.round((up / monitors.length) * 100) : 0;
  const pulseScore = useMemo(() => {
    if (!monitors.length && !apiSummary && !renderAccts.length && !vercelAccts.length) return 0;
    let s = 0, w = 0;
    if (monitors.length) { s += uptimePct; w += 1; }
    if (apiSummary) { s += (apiSummary.errors_today || 0) === 0 ? 100 : 60; w += 1; }
    if (renderAccts.length) { s += 100; w += 0.5; }
    if (vercelAccts.length) { s += 100; w += 0.5; }
    return w > 0 ? Math.round(s / w) : 0;
  }, [monitors, apiSummary, renderAccts, vercelAccts, uptimePct]);

  const pulseLabel = pulseScore >= 90 ? 'Excellent' : pulseScore >= 70 ? 'Elevated' : pulseScore >= 40 ? 'Degraded' : 'Critical';

  // What Changed items
  const whatChanged = useMemo(() => [
    {
      id: 'monitors', name: 'Site Monitors', icon: Globe,
      iconBg: 'rgba(16,185,129,0.12)', iconColor: '#10b981',
      detail: down > 0 ? `${down} site${down > 1 ? 's' : ''} down` : monitors.length > 0 ? `All ${monitors.length} operational` : 'No monitors yet',
      severity: down > 0 ? 'high' : monitors.length > 0 ? 'stable' : 'low',
      trend: down > 0 ? 'down' : 'up',
      spark: null,
      drawerTitle: 'Site Monitors',
      drawerTag: `${up}/${monitors.length} operational`,
      drawerBody: down > 0
        ? `${down} monitor${down > 1 ? 's are' : ' is'} currently reporting DOWN status. Immediate attention recommended.`
        : monitors.length > 0 ? 'All monitored sites are operational and responding within normal parameters.' : 'No monitors configured yet. Add your first site monitor to track uptime.',
      drawerStats: [
        { label: 'Total Sites', value: monitors.length, color: '#6366f1' },
        { label: 'Up', value: up, color: '#10b981' },
        { label: 'Down', value: down, color: down > 0 ? '#f43f5e' : '#10b981' },
        { label: 'Uptime', value: `${uptimePct}%`, color: uptimePct >= 90 ? '#10b981' : '#f59e0b' },
      ],
      drawerItems: monitors.map(m => ({
        label: m.name, value: m.status, color: m.status === 'UP' ? '#10b981' : '#f43f5e',
      })),
      link: '/monitors',
    },
    {
      id: 'apikeys', name: 'API Vault', icon: KeyRound,
      iconBg: 'rgba(168,85,247,0.12)', iconColor: '#a855f7',
      detail: apiSummary ? `${(apiSummary.tokens_today || 0).toLocaleString()} tokens used` : 'No keys configured',
      severity: (apiSummary?.errors_today || 0) > 0 ? 'medium' : apiSummary?.active_keys ? 'stable' : 'low',
      trend: (apiSummary?.errors_today || 0) > 0 ? 'down' : 'stable',
      spark: null,
      drawerTitle: 'API Vault',
      drawerTag: `${apiSummary?.active_keys || 0} active keys`,
      drawerBody: apiSummary
        ? `${(apiSummary.tokens_today || 0).toLocaleString()} tokens consumed today across ${apiSummary.requests_today || 0} requests.${(apiSummary.errors_today || 0) > 0 ? ` ${apiSummary.errors_today} errors detected.` : ' No errors.'}`
        : 'No API keys configured in the vault.',
      drawerStats: [
        { label: 'Total Keys', value: apiSummary?.total_keys || 0, color: '#a855f7' },
        { label: 'Active', value: apiSummary?.active_keys || 0, color: '#10b981' },
        { label: 'Tokens Today', value: (apiSummary?.tokens_today || 0).toLocaleString(), color: '#6366f1' },
        { label: 'Errors', value: apiSummary?.errors_today || 0, color: (apiSummary?.errors_today || 0) > 0 ? '#f43f5e' : '#10b981' },
      ],
      link: '/api-keys',
    },
    {
      id: 'render', name: 'Render', icon: Server,
      iconBg: 'rgba(52,211,153,0.12)', iconColor: '#34d399',
      detail: renderAccts.length > 0 ? `${renderAccts.length} account${renderAccts.length > 1 ? 's' : ''} connected` : 'Not connected',
      severity: renderAccts.length > 0 ? 'stable' : 'low',
      trend: renderAccts.length > 0 ? 'up' : 'stable',
      spark: null,
      drawerTitle: 'Render Platform',
      drawerTag: `${renderAccts.length} connected`,
      drawerBody: renderAccts.length > 0
        ? `${renderAccts.length} Render account${renderAccts.length > 1 ? 's are' : ' is'} connected. Manage services, deployments, and environment variables.`
        : 'No Render accounts connected. Connect one to manage your cloud services.',
      drawerStats: [{ label: 'Accounts', value: renderAccts.length, color: '#34d399' }],
      drawerItems: renderAccts.map(a => ({ label: a.name || a.email || 'Account', value: 'Connected', color: '#34d399' })),
      link: '/render',
    },
    {
      id: 'vercel', name: 'Vercel', icon: Triangle,
      iconBg: 'rgba(255,255,255,0.06)', iconColor: '#e0e0e8',
      detail: vercelAccts.length > 0 ? `${vercelAccts.length} account${vercelAccts.length > 1 ? 's' : ''} connected` : 'Not connected',
      severity: vercelAccts.length > 0 ? 'stable' : 'low',
      trend: vercelAccts.length > 0 ? 'up' : 'stable',
      spark: null,
      drawerTitle: 'Vercel Platform',
      drawerTag: `${vercelAccts.length} connected`,
      drawerBody: vercelAccts.length > 0
        ? `${vercelAccts.length} Vercel account${vercelAccts.length > 1 ? 's are' : ' is'} connected. Deploy, monitor, and manage your frontend projects.`
        : 'No Vercel accounts connected yet.',
      drawerStats: [{ label: 'Accounts', value: vercelAccts.length, color: '#e0e0e8' }],
      drawerItems: vercelAccts.map(a => ({ label: a.name || a.email || 'Account', value: 'Connected', color: '#e0e0e8' })),
      link: '/vercel',
    },
  ], [monitors, apiSummary, renderAccts, vercelAccts, up, down, uptimePct]);

  // Top 3 highlights (dynamically computed)
  const highlights = useMemo(() => {
    const items = [];
    if (down > 0) {
      const downNames = monitors.filter(m => m.status !== 'UP').map(m => m.name).join(', ');
      items.push({
        id: 'h-down', tag: 'MONITORS', icon: AlertTriangle,
        tagBg: 'rgba(244,63,94,0.15)', tagColor: '#f43f5e',
        title: `${down} site${down > 1 ? 's' : ''} reporting DOWN`,
        body: `${downNames} ${down > 1 ? 'are' : 'is'} currently unreachable. Check connectivity and server status.`,
        impact: 'high', time: 'Now', link: '/monitors',
        drawerTitle: 'Sites Down', iconColor: '#f43f5e',
        drawerBody: `The following sites are currently down: ${downNames}. Investigate immediately.`,
        drawerStats: [{ label: 'Down', value: down, color: '#f43f5e' }, { label: 'Up', value: up, color: '#10b981' }],
      });
    }
    if ((apiSummary?.tokens_today || 0) > 0) {
      items.push({
        id: 'h-tokens', tag: 'API VAULT', icon: Zap,
        tagBg: 'rgba(168,85,247,0.15)', tagColor: '#a855f7',
        title: `${(apiSummary.tokens_today).toLocaleString()} tokens consumed today`,
        body: `${apiSummary.requests_today || 0} API requests processed across ${apiSummary.active_keys || 0} active keys.`,
        impact: (apiSummary.errors_today || 0) > 0 ? 'medium' : 'low', time: 'Today', link: '/api-keys',
        drawerTitle: 'Token Usage', icon: Zap, iconColor: '#a855f7',
        drawerBody: `Today's gateway activity: ${(apiSummary.tokens_today).toLocaleString()} tokens, ${apiSummary.requests_today || 0} requests, ${apiSummary.errors_today || 0} errors.`,
        drawerStats: [
          { label: 'Tokens', value: (apiSummary.tokens_today).toLocaleString(), color: '#a855f7' },
          { label: 'Requests', value: apiSummary.requests_today || 0, color: '#6366f1' },
        ],
      });
    }
    if (monitors.length > 0 && down === 0) {
      items.push({
        id: 'h-allup', tag: 'INFRASTRUCTURE', icon: CheckCircle2,
        tagBg: 'rgba(16,185,129,0.15)', tagColor: '#10b981',
        title: `All ${monitors.length} sites fully operational`,
        body: `Every monitored endpoint is responding. System health is at ${uptimePct}%.`,
        impact: 'low', time: 'Now', link: '/monitors',
        drawerTitle: 'All Systems Go', icon: Shield, iconColor: '#10b981',
        drawerBody: `All ${monitors.length} monitored sites are healthy and responding normally.`,
        drawerStats: [{ label: 'Uptime', value: `${uptimePct}%`, color: '#10b981' }],
      });
    }
    if (renderAccts.length > 0) {
      items.push({
        id: 'h-render', tag: 'RENDER', icon: Server,
        tagBg: 'rgba(52,211,153,0.15)', tagColor: '#34d399',
        title: `${renderAccts.length} Render account${renderAccts.length > 1 ? 's' : ''} active`,
        body: 'Cloud services connected and manageable from the command center.',
        impact: 'low', time: 'Connected', link: '/render',
        drawerTitle: 'Render Services', icon: Server, iconColor: '#34d399',
        drawerBody: `${renderAccts.length} Render account(s) are connected. Manage deploys and services.`,
      });
    }
    if (vercelAccts.length > 0) {
      items.push({
        id: 'h-vercel', tag: 'VERCEL', icon: Triangle,
        tagBg: 'rgba(255,255,255,0.08)', tagColor: '#e0e0e8',
        title: `${vercelAccts.length} Vercel account${vercelAccts.length > 1 ? 's' : ''} linked`,
        body: 'Frontend deployments tracked and managed.',
        impact: 'low', time: 'Connected', link: '/vercel',
        drawerTitle: 'Vercel Deployments', icon: Triangle, iconColor: '#e0e0e8',
        drawerBody: `${vercelAccts.length} Vercel account(s) connected for deployment management.`,
      });
    }
    if ((apiSummary?.errors_today || 0) > 0) {
      items.push({
        id: 'h-errors', tag: 'GATEWAY', icon: AlertTriangle,
        tagBg: 'rgba(245,158,11,0.15)', tagColor: '#f59e0b',
        title: `${apiSummary.errors_today} API errors detected today`,
        body: 'Some gateway requests returned errors. Review the API vault for details.',
        impact: 'medium', time: 'Today', link: '/api-keys',
        drawerTitle: 'API Errors', icon: AlertTriangle, iconColor: '#f59e0b',
        drawerBody: `${apiSummary.errors_today} error(s) detected in today's gateway traffic.`,
      });
    }
    return items.slice(0, 3);
  }, [monitors, apiSummary, renderAccts, vercelAccts, up, down, uptimePct]);

  // Quick Glance
  const quickGlance = useMemo(() => [
    { id: 'qg-sites', icon: Globe, label: 'Sites Monitored', value: monitors.length,
      delta: down > 0 ? `${down} down` : null, deltaColor: down > 0 ? '#f43f5e' : '#10b981',
      color: '#10b981', link: '/monitors' },
    { id: 'qg-keys', icon: KeyRound, label: 'API Keys', value: apiSummary?.total_keys || 0,
      delta: apiSummary?.active_keys ? `${apiSummary.active_keys} active` : null, deltaColor: '#10b981',
      color: '#a855f7', link: '/api-keys' },
    { id: 'qg-alerts', icon: AlertTriangle, label: 'Errors Today', value: apiSummary?.errors_today || 0,
      delta: (apiSummary?.errors_today || 0) > 0 ? 'View' : null, deltaColor: '#f43f5e',
      color: (apiSummary?.errors_today || 0) > 0 ? '#f43f5e' : '#10b981', link: '/api-keys' },
    { id: 'qg-tokens', icon: Zap, label: 'Tokens Today', value: (apiSummary?.tokens_today || 0).toLocaleString(),
      color: '#6366f1', link: '/api-keys' },
  ], [monitors, apiSummary, down]);

  // Loading
  if (loading) {
    return (
      <div className="cc-dashboard">
        <div className="cc-loading">
          <div className="cc-loading-ring" />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            Initializing command center...
          </motion.p>
        </div>
      </div>
    );
  }

  const totalVisits = visits.reduce((s, d) => s + d.visits, 0);
  const userName = user?.email ? user.email.split('@')[0] : '';

  return (
    <div className="cc-dashboard">
      {/* Header */}
      <motion.header className="cc-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="cc-header-left">
          <h1 className="cc-greeting">{greet(userName)}</h1>
          <p className="cc-greeting-sub">Here's what's moving your infrastructure right now.</p>
        </div>
        <div className="cc-header-right">
          <button className="cc-refresh-btn" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'cc-spin' : ''} />
            {loadedAt && <span>Updated {timeAgo(loadedAt)}</span>}
          </button>
          <div className="cc-header-avatar">{userName ? userName[0].toUpperCase() : '?'}</div>
        </div>
      </motion.header>

      {/* Main Grid */}
      <div className="cc-grid">
        <div className="cc-primary">
          {/* Pulse + What Changed */}
          <div className="cc-top-row">
            <InfraPulseRing
              score={pulseScore}
              label={pulseLabel}
              detail={`Overall health across all ${monitors.length + (apiSummary ? 1 : 0) + renderAccts.length + vercelAccts.length} connected systems.`}
            />
            <WhatChanged items={whatChanged} onSelect={setDrawerItem} />
          </div>

          {/* Top Highlights */}
          <TopHighlights items={highlights} onSelect={setDrawerItem} />
        </div>

        {/* Right Panel */}
        <aside className="cc-right">
          <LiveTrendChart
            data={visits}
            title={`Live Platform Pulse · ${totalVisits.toLocaleString()} visits`}
          />
          <QuickGlance items={quickGlance} />

          {/* Quote */}
          <motion.div
            className="cc-quote"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Sparkles size={16} className="cc-quote-icon" />
            <blockquote>
              <p>"Your infrastructure is not random.<br />It's connected.<br />We help you command it."</p>
              <cite>— Cloud Command</cite>
            </blockquote>
          </motion.div>
        </aside>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
}
