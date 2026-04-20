import axios from 'axios';
import { getToken, removeToken } from '../auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      removeToken();
      if (!['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
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

// ── Monitors ──
export const getMonitors = () => api.get('/monitors').then(r => r.data);
export const addMonitor = (data) => api.post('/monitors', data).then(r => r.data);
export const deleteMonitor = (id) => api.delete(`/monitors/${id}`);
export const getMonitorLogs = (id) => api.get(`/monitors/${id}/logs`).then(r => r.data);
export const getMonitorAnalytics = (id) => api.get(`/monitors/${id}/analytics`).then(r => r.data);
export const exportMonitorCSV = (id) =>
  api.get(`/monitors/${id}/logs/csv`, { responseType: 'blob' }).then(r => r.data);

// ── API Keys ──
export const getApiKeys = () => api.get('/apikeys').then(r => r.data);
export const addApiKey = (data) => api.post('/apikeys', data).then(r => r.data);
export const deleteApiKey = (id) => api.delete(`/apikeys/${id}`);
export const checkApiKey = (id) => api.post(`/apikeys/${id}/check`).then(r => r.data);
export const getApiKeySummary = () => api.get('/apikeys/summary').then(r => r.data);
export const getApiKeyUsage = (id) => api.get(`/apikeys/${id}/usage`).then(r => r.data);

// ── Render ──
export const getRenderAccounts = () => api.get('/render/accounts').then(r => r.data);
export const connectRenderAccount = (data) => api.post('/render/accounts', { provider: 'render', ...data }).then(r => r.data);
export const disconnectRenderAccount = (id) => api.delete(`/render/accounts/${id}`);
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
export const getVercelProjects = (accountId) => api.get(`/vercel/accounts/${accountId}/projects`).then(r => r.data);
export const getVercelDeployments = (accountId, projectId) => api.get(`/vercel/accounts/${accountId}/deployments`, { params: { project_id: projectId } }).then(r => r.data);
export const getVercelDeploymentEvents = (accountId, deploymentId) => api.get(`/vercel/accounts/${accountId}/deployments/${deploymentId}/events`).then(r => r.data);
export const redeployVercelProject = (accountId, projectId) => api.post(`/vercel/accounts/${accountId}/projects/${projectId}/redeploy`).then(r => r.data);
export const getVercelEnvVars = (accountId, projectId) => api.get(`/vercel/accounts/${accountId}/projects/${projectId}/env`).then(r => r.data);

// ── Analytics ──
export const recordVisit = () => api.post('/analytics/visit').catch(() => {});
export const getVisits = () => api.get('/analytics/visits').then(r => r.data).catch(() => []);

// ── Settings ──
export const requestOtp = (email) => api.post('/settings/notification-email/request-otp', { email }).then(r => r.data);
export const verifyOtp = (email, code) => api.post('/settings/notification-email/verify-otp', { email, code }).then(r => r.data);
export const getProfile = () => api.get('/settings/profile').then(r => r.data);
export const changePassword = (current_password, new_password) => api.post('/settings/change-password', { current_password, new_password }).then(r => r.data);
