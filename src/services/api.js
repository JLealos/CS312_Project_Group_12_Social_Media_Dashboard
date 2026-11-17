// Vite forwards same-origin /api requests to Express during local development.
const API_URL = import.meta.env.VITE_API_URL || '/api';
async function request(endpoint, options = {}) {
  const token = sessionStorage.getItem('socialhub_token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Request failed');
  return data.data;
}
export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  sessionStorage.setItem('socialhub_token', data.token);
  return data;
}
export async function register(name, email, password) {
  await request('/auth/register', { method: 'POST', body: JSON.stringify({ display_name: name, email, password }) });
  return login(email, password);
}
export async function logout() {
  try { return await request('/auth/logout', { method: 'POST' }); }
  finally { sessionStorage.removeItem('socialhub_token'); }
}
export async function getCurrentUser() { return { user: await request('/auth/me') }; }


