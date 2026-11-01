const configuredBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '');
let csrfToken = null;

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: 'The server returned an unreadable response.' }; }
}

async function refreshCsrf() {
  const response = await fetch(`${configuredBase}/api/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await readResponse(response);
  if (!response.ok || !body.csrfToken) {
    const error = new Error(body.message || 'Could not initialize a secure session.');
    error.status = response.status;
    throw error;
  }
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  let body = options.body;
  if (body !== undefined && !isFormData(body) && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && options.csrf !== false) {
    if (!csrfToken) await refreshCsrf();
    headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`${configuredBase}${path}`, {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined ? { body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const payload = await readResponse(response);
  if (payload.csrfToken) csrfToken = payload.csrfToken;
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.fieldErrors = payload.errors || {};
    throw error;
  }
  return payload;
}

export const api = {
  initializeCsrf: refreshCsrf,
  getSession: () => request('/api/auth/me'),
  getReports: (filters = {}, options = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
    return request(`/api/reports${params.size ? `?${params}` : ''}`, options);
  },
  getReport: (id) => request(`/api/reports/${encodeURIComponent(id)}`),
  getMyReports: () => request('/api/reports/mine'),
  createReport: (formData) => request('/api/reports', { method: 'POST', body: formData }),
  updateReportStatus: (id, status) => request(`/api/reports/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
  getMyClaims: () => request('/api/claims/mine'),
  getAllClaims: () => request('/api/claims'),
  createClaim: (reportId, explanation) => request('/api/claims', { method: 'POST', body: { reportId, explanation } }),
  updateClaimStatus: (id, status) => request(`/api/claims/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status: status.toLowerCase() } }),
  getCategories: () => request('/api/categories'),
  addCategory: (name, description = '') => request('/api/categories', { method: 'POST', body: { name, description } }),
  removeCategory: (id) => request(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getUsers: () => request('/api/users'),
  getStatistics: () => request('/api/admin/statistics'),
  register: (fields) => request('/api/auth/register', { method: 'POST', body: fields }),
  login: (fields) => request('/api/auth/login', { method: 'POST', body: fields }),
  logout: async () => {
    const result = await request('/api/auth/logout', { method: 'POST' });
    csrfToken = null;
    return result;
  },
};
