/** Single fetch wrapper. Cookies only — no token ever touches localStorage. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Request failed');
    this.status = status;
    this.code = body?.error?.code || 'error';
    this.fields = body?.error?.details?.fields || [];
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (res.status === 204) return null;

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

export const auth = {
  me: () => api('/auth/me'),
  login: (body) => api('/auth/login', { method: 'POST', body }),
  register: (body) => api('/auth/register', { method: 'POST', body }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  updatePreferences: (body) => api('/auth/preferences', { method: 'PATCH', body }),
  deleteAccount: () => api('/auth/account', { method: 'DELETE' }),
};

export const conversations = {
  list: (params = {}) => api(`/conversations?${new URLSearchParams(params)}`),
  create: (body) => api('/conversations', { method: 'POST', body }),
  get: (id) => api(`/conversations/${id}`),
  rename: (id, title) => api(`/conversations/${id}`, { method: 'PATCH', body: { title } }),
  remove: (id) => api(`/conversations/${id}`, { method: 'DELETE' }),
};

export const answers = {
  create: (body) => api('/answers', { method: 'POST', body }),
  get: (id) => api(`/answers/${id}`),
  followUp: (id, body) => api(`/answers/${id}/follow-up`, { method: 'POST', body }),
  regenerate: (id) => api(`/answers/${id}/regenerate`, { method: 'POST' }),
  cancel: (id) => api(`/answers/${id}/cancel`, { method: 'POST' }),
};

export const system = { providers: () => api('/providers/status') };
