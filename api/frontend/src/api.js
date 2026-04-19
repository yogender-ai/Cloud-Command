const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || 'API request failed');
  }

  return data;
};

export const login = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Login failed');
  return data;
};

export const register = async (username, password) => {
    return request('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
};

export const getKeys = () => request('/keys');
export const addKey = (data) => request('/keys', { method: 'POST', body: JSON.stringify(data) });
export const deleteKey = (id) => request(`/keys/${id}`, { method: 'DELETE' });
export const checkKey = (id) => request(`/keys/${id}/check`, { method: 'POST' });
export const getUsageSummary = () => request('/usage/summary');
export const getKeyUsage = (id) => request(`/keys/${id}/usage`);
