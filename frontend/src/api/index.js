import axios from 'axios';
import { getToken, removeToken } from '../auth';

// Normalise: strip trailing slash, then always append /api
// So VITE_API_URL can be "https://cloud-command.onrender.com" OR ".../api" — both work
const _raw = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const API_URL = _raw
  ? (_raw.endsWith('/api') ? _raw : `${_raw}/api`)
  : '/api';

// Base URL without /api suffix for health checks
const BASE_URL = _raw ? _raw.replace(/\/api$/, '') : '';

const api = axios.create({ baseURL: API_URL, timeout: 45000 });

// ── Backend wake-up system ──
// Render free tier sleeps the backend after 15min of inactivity.
// Cold start takes ~30s. We ping /api/keep-alive first and wait for
// a response before sending real API requests.
let _backendReady = null; // null = unknown, Promise = waking, true = ready

export async function ensureBackendAwake() {
  if (_backendReady === true) return;
  if (_backendReady && typeof _backendReady.then === 'function') return _backendReady;

  _backendReady = (async () => {
    const url = `${BASE_URL || ''}/api/keep-alive`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await axios.get(url, { timeout: 40000 });
        _backendReady = true;
        return;
      } catch {
        // Backend still waking up, wait a bit then retry
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
    // Give up waiting but don't block — let requests try anyway
    _backendReady = true;
  })();
  return _backendReady;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      removeToken();
      if (!['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    // Auto-retry once on timeout/network error (cold start recovery)
    const config = err.config;
    if (!config._retried && (err.code === 'ECONNABORTED' || !err.response)) {
      config._retried = true;
      _backendReady = null; // force re-check
      await ensureBackendAwake();
      return api(config);
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──
export const loginRequest = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);
export const registerRequest = (email, password) =>
  api.post('/auth/register', { email, password }).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);

export const getMonitors = () => api.get('/monitors').then(r => r.data);
export const addMonitor = (data) => api.post('/monitors', data).then(r => r.data);
export const deleteMonitor = (id) => api.delete(`/monitors/${id}`);
export const updateMonitor = (id, data) => api.patch(`/monitors/${id}`, data).then(r => r.data);
export const getMonitorLogs = (id) => api.get(`/monitors/${id}/logs`).then(r => r.data);
export const getMonitorAnalytics = (id) => api.get(`/monitors/${id}/analytics`).then(r => r.data);
export const inspectMonitor = (id) => api.get(`/monitors/${id}/inspect`).then(r => r.data);
export const exportMonitorCSV = (id) =>
  api.get(`/monitors/${id}/logs/csv`, { responseType: 'blob' }).then(r => r.data);

// ── Scheduled Jobs ──
export const getScheduledJobs = () => api.get('/scheduled-jobs').then(r => r.data);
export const createScheduledJob = (data) => api.post('/scheduled-jobs', data).then(r => r.data);
export const updateScheduledJob = (id, data) => api.patch(`/scheduled-jobs/${id}`, data).then(r => r.data);
export const deleteScheduledJob = (id) => api.delete(`/scheduled-jobs/${id}`);
export const runScheduledJob = (id) => api.post(`/scheduled-jobs/${id}/run`).then(r => r.data);
export const getScheduledJobLogs = (id) => api.get(`/scheduled-jobs/${id}/logs`).then(r => r.data);

// ── API Keys ──
export const getApiKeys = () => api.get('/apikeys').then(r => r.data);
export const addApiKey = (data) => api.post('/apikeys', data).then(r => r.data);
export const deleteApiKey = (id) => api.delete(`/apikeys/${id}`);
export const updateApiKey = (id, data) => api.patch(`/apikeys/${id}`, data).then(r => r.data);
export const checkApiKey = (id) => api.post(`/apikeys/${id}/check`).then(r => r.data);
export const getApiKeySummary = (range = '7d') => api.get('/apikeys/summary', { params: { range } }).then(r => r.data);
export const getApiKeyUsage = (id) => api.get(`/apikeys/${id}/usage`).then(r => r.data);
export const revealApiKey = (id) => api.post(`/apikeys/${id}/reveal`).then(r => r.data);
export const requestVaultOtp = () => api.post('/apikeys/request-view-otp').then(r => r.data);
export const verifyVaultOtp = (code) => api.post('/apikeys/verify-view-otp', { code }).then(r => r.data);

// ── Key Groups ──
export const getKeyGroups = () => api.get('/keygroups').then(r => r.data);
export const createKeyGroup = (data) => api.post('/keygroups', data).then(r => r.data);
export const updateKeyGroup = (id, data) => api.patch(`/keygroups/${id}`, data).then(r => r.data);
export const deleteKeyGroup = (id) => api.delete(`/keygroups/${id}`);
export const addGroupMember = (groupId, data) => api.post(`/keygroups/${groupId}/members`, data).then(r => r.data);
export const removeGroupMember = (groupId, memberId) => api.delete(`/keygroups/${groupId}/members/${memberId}`);
export const updateGroupMember = (groupId, memberId, data) => api.patch(`/keygroups/${groupId}/members/${memberId}`, data).then(r => r.data);

// ── Gateway API Keys (Cloud Command Keys) ──
export const getGatewayKeys = () => api.get('/gateway-keys').then(r => r.data);
export const createGatewayKey = (data) => api.post('/gateway-keys', data).then(r => r.data);
export const deleteGatewayKey = (id) => api.delete(`/gateway-keys/${id}`);

// ── Render ──
export const getRenderAccounts = () => api.get('/render/accounts').then(r => r.data);
export const connectRenderAccount = (data) => api.post('/render/accounts', { provider: 'render', ...data }).then(r => r.data);
export const disconnectRenderAccount = (id) => api.delete(`/render/accounts/${id}`);
export const updateRenderAccount = (id, data) => api.patch(`/render/accounts/${id}`, data).then(r => r.data);
export const getRenderServices = (accountId) => api.get(`/render/accounts/${accountId}/services`).then(r => r.data);
export const getRenderService = (accountId, serviceId) => api.get(`/render/accounts/${accountId}/services/${serviceId}`).then(r => r.data);
export const getRenderDeploys = (accountId, serviceId) => api.get(`/render/accounts/${accountId}/services/${serviceId}/deploys`).then(r => r.data);
export const triggerRenderDeploy = (accountId, serviceId) => api.post(`/render/accounts/${accountId}/services/${serviceId}/deploys`).then(r => r.data);
export const suspendRenderService = (accountId, serviceId) => api.post(`/render/accounts/${accountId}/services/${serviceId}/suspend`).then(r => r.data);
export const resumeRenderService = (accountId, serviceId) => api.post(`/render/accounts/${accountId}/services/${serviceId}/resume`).then(r => r.data);
export const getRenderEnvVars = (accountId, serviceId) => api.get(`/render/accounts/${accountId}/services/${serviceId}/env`).then(r => r.data);

// ── Vercel ──
export const getVercelAccounts = () => api.get('/vercel/accounts').then(r => r.data);
export const connectVercelAccount = (data) => api.post('/vercel/accounts', { provider: 'vercel', ...data }).then(r => r.data);
export const disconnectVercelAccount = (id) => api.delete(`/vercel/accounts/${id}`);
export const updateVercelAccount = (id, data) => api.patch(`/vercel/accounts/${id}`, data).then(r => r.data);
export const getVercelProjects = (accountId) => api.get(`/vercel/accounts/${accountId}/projects`).then(r => r.data);
export const getVercelDeployments = (accountId, projectId) => api.get(`/vercel/accounts/${accountId}/deployments`, { params: { project_id: projectId } }).then(r => r.data);
export const getVercelDeploymentEvents = (accountId, deploymentId) => api.get(`/vercel/accounts/${accountId}/deployments/${deploymentId}/events`).then(r => r.data);
export const redeployVercelProject = (accountId, projectId) => api.post(`/vercel/accounts/${accountId}/projects/${projectId}/redeploy`).then(r => r.data);
export const getVercelEnvVars = (accountId, projectId) => api.get(`/vercel/accounts/${accountId}/projects/${projectId}/env`).then(r => r.data);

// ── Analytics ──
export const recordVisit = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localDate = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  return api.post('/analytics/visit', { local_date: localDate }).catch(() => {});
};
export const getVisits = () => api.get('/analytics/visits').then(r => r.data).catch(() => []);

// ── Settings ──
export const requestOtp = (email) => api.post('/settings/notification-email/request-otp', { email }).then(r => r.data);
export const verifyOtp = (email, code) => api.post('/settings/notification-email/verify-otp', { email, code }).then(r => r.data);
export const getProfile = () => api.get('/settings/profile').then(r => r.data);
export const changePassword = (current_password, new_password) => api.post('/settings/change-password', { current_password, new_password }).then(r => r.data);
